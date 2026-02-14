/**
 * Lead Analytics Service
 *
 * Tracks and analyzes lead performance across platforms
 * Provides ROI metrics, conversion rates, and campaign analytics
 */

import type { Env } from 'cloudflare:workers';
import type { LeadSource, LeadClassification } from './unified-lead-service';

export interface CampaignAnalytics {
  campaignId: string;
  campaignName: string;
  source: LeadSource;
  totalLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  conversionRate: number;
  averageScore: number;
  leadsByDay: Array<{ date: string; count: number }>;
}

export interface SourceAnalytics {
  source: LeadSource;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  averageScore: number;
  averageResponseTime?: number;
  topCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    leadCount: number;
  }>;
}

export interface DailyMetrics {
  date: string;
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  bySource: Record<LeadSource, number>;
}

/**
 * Track lead event for analytics
 */
export async function trackLeadEvent(
  env: Env,
  event: {
    leadId: string;
    source: LeadSource;
    eventType: 'created' | 'qualified' | 'contacted' | 'converted' | 'lost';
    campaignId?: string;
    campaignName?: string;
    classification?: LeadClassification;
    score?: number;
    timestamp?: number;
  }
): Promise<void> {
  const timestamp = event.timestamp || Date.now();
  const date = new Date(timestamp).toISOString().split('T')[0];

  if (!env.LEAD_INDEX_KV) return;
  // Store event in KV with TTL (90 days)
  const eventKey = `analytics:event:${event.leadId}:${event.eventType}:${timestamp}`;
  await env.LEAD_INDEX_KV.put(
    eventKey,
    JSON.stringify({
      ...event,
      timestamp,
      date,
    }),
    {
      expirationTtl: 90 * 24 * 60 * 60,
    }
  );

  // Update daily metrics
  await updateDailyMetrics(env, date, event.source, event.eventType);

  // Update campaign metrics if campaign data provided
  if (event.campaignId) {
    await updateCampaignMetrics(env, event.campaignId, event);
  }
}

/**
 * Update daily metrics
 */
async function updateDailyMetrics(
  env: Env,
  date: string,
  source: LeadSource,
  eventType: string
): Promise<void> {
  if (!env.LEAD_INDEX_KV) return;
  const metricsKey = `analytics:daily:${date}`;

  // Get existing metrics
  const existing = await env.LEAD_INDEX_KV.get(metricsKey, 'json');
  const metrics = (existing as any) || {
    date,
    newLeads: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    bySource: {
      tiktok: 0,
      facebook: 0,
      whatsapp: 0,
    },
  };

  // Update counters
  if (eventType === 'created') {
    metrics.newLeads++;
    metrics.bySource[source]++;
  } else if (eventType === 'qualified') {
    metrics.qualifiedLeads++;
  }

  // Store updated metrics (30 days retention)
  await env.LEAD_INDEX_KV.put(metricsKey, JSON.stringify(metrics), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
}

/**
 * Update campaign metrics
 */
async function updateCampaignMetrics(
  env: Env,
  campaignId: string,
  event: {
    source: LeadSource;
    campaignName?: string;
    eventType: string;
    classification?: LeadClassification;
    score?: number;
  }
): Promise<void> {
  if (!env.LEAD_INDEX_KV) return;
  const metricsKey = `analytics:campaign:${event.source}:${campaignId}`;

  // Get existing metrics
  const existing = await env.LEAD_INDEX_KV.get(metricsKey, 'json');
  const metrics = (existing as any) || {
    campaignId,
    campaignName: event.campaignName,
    source: event.source,
    totalLeads: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    totalScore: 0,
    scoredLeads: 0,
  };

  // Update counters
  if (event.eventType === 'created') {
    metrics.totalLeads++;
    if (event.score) {
      metrics.totalScore += event.score;
      metrics.scoredLeads++;
    }
  } else if (event.eventType === 'qualified') {
    metrics.qualifiedLeads++;
    if (event.classification === 'hot') {
      metrics.hotLeads++;
    }
  }

  // Store updated metrics (90 days retention)
  await env.LEAD_INDEX_KV.put(metricsKey, JSON.stringify(metrics), {
    expirationTtl: 90 * 24 * 60 * 60,
  });
}

/**
 * Get analytics for a specific campaign
 */
export async function getCampaignAnalytics(
  env: Env,
  source: LeadSource,
  campaignId: string
): Promise<CampaignAnalytics | null> {
  if (!env.LEAD_INDEX_KV) return null;
  const metricsKey = `analytics:campaign:${source}:${campaignId}`;
  const metrics = await env.LEAD_INDEX_KV.get(metricsKey, 'json');

  if (!metrics) {
    return null;
  }

  const data = metrics as any;

  return {
    campaignId: data.campaignId,
    campaignName: data.campaignName || campaignId,
    source: data.source,
    totalLeads: data.totalLeads || 0,
    qualifiedLeads: data.qualifiedLeads || 0,
    hotLeads: data.hotLeads || 0,
    conversionRate:
      data.totalLeads > 0
        ? Math.round((data.qualifiedLeads / data.totalLeads) * 100)
        : 0,
    averageScore:
      data.scoredLeads > 0
        ? Math.round(data.totalScore / data.scoredLeads)
        : 0,
    leadsByDay: [], // TODO: Implement daily breakdown
  };
}

/**
 * Get analytics for a specific source
 */
export async function getSourceAnalytics(
  env: Env,
  source: LeadSource
): Promise<SourceAnalytics> {
  if (!env.LEAD_INDEX_KV) {
    return { source, totalLeads: 0, qualifiedLeads: 0, conversionRate: 0, averageScore: 0, topCampaigns: [] };
  }
  // Get all campaign metrics for this source
  const campaigns = await env.LEAD_INDEX_KV.list({
    prefix: `analytics:campaign:${source}:`,
  });

  let totalLeads = 0;
  let qualifiedLeads = 0;
  let totalScore = 0;
  let scoredLeads = 0;
  const campaignData: Array<{
    campaignId: string;
    campaignName: string;
    leadCount: number;
  }> = [];

  for (const key of campaigns.keys) {
    const metrics = await env.LEAD_INDEX_KV.get(key.name, 'json');
    if (metrics) {
      const data = metrics as any;
      totalLeads += data.totalLeads || 0;
      qualifiedLeads += data.qualifiedLeads || 0;
      totalScore += data.totalScore || 0;
      scoredLeads += data.scoredLeads || 0;

      campaignData.push({
        campaignId: data.campaignId,
        campaignName: data.campaignName || data.campaignId,
        leadCount: data.totalLeads || 0,
      });
    }
  }

  // Sort campaigns by lead count
  campaignData.sort((a, b) => b.leadCount - a.leadCount);

  return {
    source,
    totalLeads,
    qualifiedLeads,
    conversionRate:
      totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0,
    averageScore: scoredLeads > 0 ? Math.round(totalScore / scoredLeads) : 0,
    topCampaigns: campaignData.slice(0, 5),
  };
}

/**
 * Get daily metrics for a date range
 */
export async function getDailyMetrics(
  env: Env,
  startDate: string,
  endDate: string
): Promise<DailyMetrics[]> {
  const metrics: DailyMetrics[] = [];

  // Generate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  // Fetch metrics for each date
  for (const date of dates) {
    const metricsKey = `analytics:daily:${date}`;
    const data = env.LEAD_INDEX_KV ? await env.LEAD_INDEX_KV.get(metricsKey, 'json') : null;

    if (data) {
      metrics.push(data as DailyMetrics);
    } else {
      // Return empty metrics for missing dates
      metrics.push({
        date,
        newLeads: 0,
        qualifiedLeads: 0,
        hotLeads: 0,
        bySource: {
          tiktok: 0,
          facebook: 0,
          whatsapp: 0,
        },
      });
    }
  }

  return metrics;
}

/**
 * Get overall analytics summary
 */
export async function getAnalyticsSummary(env: Env) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [dailyMetrics, tiktokAnalytics, facebookAnalytics, whatsappAnalytics] =
    await Promise.all([
      getDailyMetrics(env, sevenDaysAgo, today),
      getSourceAnalytics(env, 'tiktok'),
      getSourceAnalytics(env, 'facebook'),
      getSourceAnalytics(env, 'whatsapp'),
    ]);

  const totalLeads =
    tiktokAnalytics.totalLeads +
    facebookAnalytics.totalLeads +
    whatsappAnalytics.totalLeads;
  const totalQualified =
    tiktokAnalytics.qualifiedLeads +
    facebookAnalytics.qualifiedLeads +
    whatsappAnalytics.qualifiedLeads;

  return {
    totalLeads,
    totalQualified,
    overallConversionRate:
      totalLeads > 0 ? Math.round((totalQualified / totalLeads) * 100) : 0,
    bySource: {
      tiktok: tiktokAnalytics,
      facebook: facebookAnalytics,
      whatsapp: whatsappAnalytics,
    },
    last7Days: dailyMetrics,
  };
}
