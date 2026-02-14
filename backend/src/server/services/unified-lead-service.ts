/**
 * Unified Lead Service
 *
 * Aggregates and manages leads from all platforms (TikTok, Facebook, WhatsApp)
 * Provides cross-platform search, deduplication, and analytics
 */

import type { Env } from 'cloudflare:workers';

export type LeadSource = 'tiktok' | 'facebook' | 'whatsapp';
export type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified' | 'new';

export interface UnifiedLead {
  id: string;
  source: LeadSource;
  timestamp: number;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  classification?: LeadClassification;
  qualificationScore?: number;
  campaignName?: string;
  campaignId?: string;
  adName?: string;
  formName?: string;
  // Platform-specific data stored as JSON
  platformData: Record<string, any>;
}

export interface LeadSearchOptions {
  sources?: LeadSource[];
  classifications?: LeadClassification[];
  searchQuery?: string;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface LeadStats {
  total: number;
  bySource: Record<LeadSource, number>;
  byClassification: Record<LeadClassification, number>;
  newToday: number;
  newThisWeek: number;
  averageScore: number;
}

/**
 * Fetch leads from TikTok Lead DO
 */
async function fetchTikTokLeads(
  env: Env,
  _options: LeadSearchOptions
): Promise<UnifiedLead[]> {
  if (!env.LEAD_INDEX_KV) return [];
  // TikTok leads are stored in TikTokLeadDO
  // We'll use KV to store a list of all lead IDs
  const leadIds = await env.LEAD_INDEX_KV.list({ prefix: 'tiktok:' });

  const leads: UnifiedLead[] = [];

  for (const key of leadIds.keys) {
    const leadData = await env.LEAD_INDEX_KV.get(key.name, 'json') as any;
    if (leadData) {
      leads.push({
        id: leadData.leadId,
        source: 'tiktok',
        timestamp: new Date(leadData.createdTime).getTime(),
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        company: leadData.company,
        classification: leadData.classification,
        qualificationScore: leadData.qualificationScore,
        campaignName: leadData.campaignName,
        campaignId: leadData.campaignId,
        platformData: leadData,
      });
    }
  }

  return leads;
}

/**
 * Fetch leads from Facebook Lead DO
 */
async function fetchFacebookLeads(
  env: Env,
  _options: LeadSearchOptions
): Promise<UnifiedLead[]> {
  if (!env.LEAD_INDEX_KV) return [];
  const leadIds = await env.LEAD_INDEX_KV.list({ prefix: 'facebook:' });

  const leads: UnifiedLead[] = [];

  for (const key of leadIds.keys) {
    const leadData = await env.LEAD_INDEX_KV.get(key.name, 'json') as any;
    if (leadData) {
      leads.push({
        id: leadData.leadId,
        source: 'facebook',
        timestamp: new Date(leadData.createdTime).getTime(),
        name: leadData.userDetails.name,
        email: leadData.userDetails.email,
        phone: leadData.userDetails.phone,
        company: leadData.userDetails.company,
        classification: leadData.classification,
        qualificationScore: leadData.qualificationScore,
        campaignName: leadData.campaignName,
        campaignId: leadData.campaignId,
        formName: leadData.formName,
        platformData: leadData,
      });
    }
  }

  return leads;
}

/**
 * Fetch conversations from WhatsApp DO
 */
async function fetchWhatsAppLeads(
  env: Env,
  _options: LeadSearchOptions
): Promise<UnifiedLead[]> {
  if (!env.LEAD_INDEX_KV) return [];
  const leadIds = await env.LEAD_INDEX_KV.list({ prefix: 'whatsapp:' });

  const leads: UnifiedLead[] = [];

  for (const key of leadIds.keys) {
    const leadData = await env.LEAD_INDEX_KV.get(key.name, 'json') as any;
    if (leadData) {
      leads.push({
        id: leadData.conversationId,
        source: 'whatsapp',
        timestamp: leadData.firstMessageTime,
        name: leadData.contactName,
        phone: leadData.phoneNumber,
        classification: leadData.classification,
        qualificationScore: leadData.qualificationScore,
        platformData: leadData,
      });
    }
  }

  return leads;
}

/**
 * Search leads across all platforms
 */
export async function searchLeads(
  env: Env,
  options: LeadSearchOptions = {}
): Promise<UnifiedLead[]> {
  const { sources = ['tiktok', 'facebook', 'whatsapp'], searchQuery } = options;

  // Fetch from all requested sources in parallel
  const leadPromises: Promise<UnifiedLead[]>[] = [];

  if (sources.includes('tiktok')) {
    leadPromises.push(fetchTikTokLeads(env, options));
  }
  if (sources.includes('facebook')) {
    leadPromises.push(fetchFacebookLeads(env, options));
  }
  if (sources.includes('whatsapp')) {
    leadPromises.push(fetchWhatsAppLeads(env, options));
  }

  const results = await Promise.all(leadPromises);
  let allLeads = results.flat();

  // Apply filters
  if (options.classifications && options.classifications.length > 0) {
    allLeads = allLeads.filter((lead) =>
      options.classifications!.includes(lead.classification || 'new')
    );
  }

  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    allLeads = allLeads.filter(
      (lead) =>
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.company?.toLowerCase().includes(query) ||
        lead.campaignName?.toLowerCase().includes(query)
    );
  }

  if (options.startDate) {
    allLeads = allLeads.filter((lead) => lead.timestamp >= options.startDate!);
  }

  if (options.endDate) {
    allLeads = allLeads.filter((lead) => lead.timestamp <= options.endDate!);
  }

  // Sort by timestamp (newest first)
  allLeads.sort((a, b) => b.timestamp - a.timestamp);

  // Apply pagination
  const offset = options.offset || 0;
  const limit = options.limit || 50;

  return allLeads.slice(offset, offset + limit);
}

/**
 * Get lead statistics
 */
export async function getLeadStats(env: Env): Promise<LeadStats> {
  const allLeads = await searchLeads(env, { limit: 1000 });

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const stats: LeadStats = {
    total: allLeads.length,
    bySource: {
      tiktok: 0,
      facebook: 0,
      whatsapp: 0,
    },
    byClassification: {
      hot: 0,
      warm: 0,
      cold: 0,
      unqualified: 0,
      new: 0,
    },
    newToday: 0,
    newThisWeek: 0,
    averageScore: 0,
  };

  let totalScore = 0;
  let scoredLeads = 0;

  for (const lead of allLeads) {
    // Count by source
    stats.bySource[lead.source]++;

    // Count by classification
    const classification = lead.classification || 'new';
    stats.byClassification[classification]++;

    // Count new leads
    if (lead.timestamp >= oneDayAgo) {
      stats.newToday++;
    }
    if (lead.timestamp >= oneWeekAgo) {
      stats.newThisWeek++;
    }

    // Calculate average score
    if (lead.qualificationScore) {
      totalScore += lead.qualificationScore;
      scoredLeads++;
    }
  }

  stats.averageScore = scoredLeads > 0 ? Math.round(totalScore / scoredLeads) : 0;

  return stats;
}

/**
 * Index a lead for cross-platform search
 */
export async function indexLead(
  env: Env,
  source: LeadSource,
  leadId: string,
  leadData: any
): Promise<void> {
  if (!env.LEAD_INDEX_KV) return;
  const key = `${source}:${leadId}`;
  await env.LEAD_INDEX_KV.put(key, JSON.stringify(leadData), {
    expirationTtl: 90 * 24 * 60 * 60, // 90 days
  });
}

/**
 * Remove a lead from the index
 */
export async function removeLeadFromIndex(
  env: Env,
  source: LeadSource,
  leadId: string
): Promise<void> {
  if (!env.LEAD_INDEX_KV) return;
  const key = `${source}:${leadId}`;
  await env.LEAD_INDEX_KV.delete(key);
}

/**
 * Export leads to CSV format
 */
export function exportLeadsToCSV(leads: UnifiedLead[]): string {
  const headers = [
    'Source',
    'Name',
    'Email',
    'Phone',
    'Company',
    'Classification',
    'Score',
    'Campaign',
    'Date',
  ];

  const rows = leads.map((lead) => [
    lead.source,
    lead.name || '',
    lead.email || '',
    lead.phone || '',
    lead.company || '',
    lead.classification || 'new',
    lead.qualificationScore?.toString() || '',
    lead.campaignName || '',
    new Date(lead.timestamp).toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return csvContent;
}
