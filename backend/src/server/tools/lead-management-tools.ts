/**
 * Lead Management Tools for Chat Agent
 *
 * Tools that allow the AI agent to search, analyze, and manage leads
 * Designed to work within the chat interface
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { Env } from 'cloudflare:workers';
import { searchLeads, getLeadStats } from '../services/unified-lead-service';
import {
  getAnalyticsSummary,
  getCampaignAnalytics,
  getSourceAnalytics,
} from '../services/lead-analytics';

/**
 * Search leads across all platforms
 */
export function createSearchLeadsTool(env: Env) {
  return tool({
    description:
      'Search for leads across TikTok, Facebook, and WhatsApp. Can filter by source, classification, date range, and search query.',
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe(
          'Search query to filter by name, email, phone, company, or campaign'
        ),
      sources: z
        .array(z.enum(['tiktok', 'facebook', 'whatsapp']))
        .optional()
        .describe('Filter by specific platforms'),
      classifications: z
        .array(z.enum(['hot', 'warm', 'cold', 'unqualified', 'new']))
        .optional()
        .describe('Filter by lead classification'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of results to return'),
    }),
    execute: async ({ query, sources, classifications, limit }) => {
      const leads = await searchLeads(env, {
        searchQuery: query,
        sources,
        classifications,
        limit,
      });

      return {
        success: true,
        count: leads.length,
        leads: leads.map((lead) => ({
          id: lead.id,
          source: lead.source,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          classification: lead.classification,
          score: lead.qualificationScore,
          campaign: lead.campaignName,
          timestamp: lead.timestamp,
        })),
      };
    },
  });
}

/**
 * Get lead statistics
 */
export function createGetLeadStatsTool(env: Env) {
  return tool({
    description:
      'Get overall lead statistics including totals by source, classification, and recent activity.',
    inputSchema: z.object({}),
    execute: async () => {
      const stats = await getLeadStats(env);

      return {
        success: true,
        stats: {
          total: stats.total,
          bySource: stats.bySource,
          byClassification: stats.byClassification,
          newToday: stats.newToday,
          newThisWeek: stats.newThisWeek,
          averageScore: stats.averageScore,
        },
      };
    },
  });
}

/**
 * Get analytics summary
 */
export function createGetAnalyticsTool(env: Env) {
  return tool({
    description:
      'Get comprehensive analytics summary including conversion rates, top campaigns, and trends over the last 7 days.',
    inputSchema: z.object({}),
    execute: async () => {
      const summary = await getAnalyticsSummary(env);

      return {
        success: true,
        analytics: {
          totalLeads: summary.totalLeads,
          totalQualified: summary.totalQualified,
          conversionRate: summary.overallConversionRate,
          bySource: {
            tiktok: {
              total: summary.bySource.tiktok.totalLeads,
              qualified: summary.bySource.tiktok.qualifiedLeads,
              conversionRate: summary.bySource.tiktok.conversionRate,
            },
            facebook: {
              total: summary.bySource.facebook.totalLeads,
              qualified: summary.bySource.facebook.qualifiedLeads,
              conversionRate: summary.bySource.facebook.conversionRate,
            },
            whatsapp: {
              total: summary.bySource.whatsapp.totalLeads,
              qualified: summary.bySource.whatsapp.qualifiedLeads,
              conversionRate: summary.bySource.whatsapp.conversionRate,
            },
          },
          last7Days: summary.last7Days,
        },
      };
    },
  });
}

/**
 * Get campaign performance
 */
export function createGetCampaignPerformanceTool(env: Env) {
  return tool({
    description:
      'Get detailed performance metrics for a specific campaign including lead count, qualification rate, and conversion metrics.',
    inputSchema: z.object({
      source: z
        .enum(['tiktok', 'facebook', 'whatsapp'])
        .describe('The platform where the campaign runs'),
      campaignId: z.string().describe('The campaign ID to analyze'),
    }),
    execute: async ({ source, campaignId }) => {
      const analytics = await getCampaignAnalytics(env, source, campaignId);

      if (!analytics) {
        return {
          success: false,
          error: 'Campaign not found or has no data',
        };
      }

      return {
        success: true,
        campaign: {
          id: analytics.campaignId,
          name: analytics.campaignName,
          source: analytics.source,
          totalLeads: analytics.totalLeads,
          qualifiedLeads: analytics.qualifiedLeads,
          hotLeads: analytics.hotLeads,
          conversionRate: analytics.conversionRate,
          averageScore: analytics.averageScore,
        },
      };
    },
  });
}

/**
 * Get source performance
 */
export function createGetSourcePerformanceTool(env: Env) {
  return tool({
    description:
      'Get detailed performance metrics for a specific platform (TikTok, Facebook, or WhatsApp) including top campaigns.',
    inputSchema: z.object({
      source: z
        .enum(['tiktok', 'facebook', 'whatsapp'])
        .describe('The platform to analyze'),
    }),
    execute: async ({ source }) => {
      const analytics = await getSourceAnalytics(env, source);

      return {
        success: true,
        source: analytics.source,
        metrics: {
          totalLeads: analytics.totalLeads,
          qualifiedLeads: analytics.qualifiedLeads,
          conversionRate: analytics.conversionRate,
          averageScore: analytics.averageScore,
        },
        topCampaigns: analytics.topCampaigns.map((c) => ({
          id: c.campaignId,
          name: c.campaignName,
          leadCount: c.leadCount,
        })),
      };
    },
  });
}

/**
 * Find hot leads
 */
export function createFindHotLeadsTool(env: Env) {
  return tool({
    description:
      'Find all hot leads that require immediate attention. Returns leads with high qualification scores and hot classification.',
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of hot leads to return'),
    }),
    execute: async ({ limit }) => {
      const leads = await searchLeads(env, {
        classifications: ['hot'],
        limit,
      });

      return {
        success: true,
        count: leads.length,
        hotLeads: leads.map((lead) => ({
          id: lead.id,
          source: lead.source,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          score: lead.qualificationScore,
          campaign: lead.campaignName,
          timestamp: lead.timestamp,
          minutesAgo: Math.floor((Date.now() - lead.timestamp) / 1000 / 60),
        })),
      };
    },
  });
}

/**
 * Get recent leads
 */
export function createGetRecentLeadsTool(env: Env) {
  return tool({
    description:
      'Get the most recent leads from the last 24 hours across all platforms.',
    inputSchema: z.object({
      hours: z
        .number()
        .optional()
        .default(24)
        .describe('Number of hours to look back'),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum number of leads to return'),
    }),
    execute: async ({ hours, limit }) => {
      const startDate = Date.now() - hours * 60 * 60 * 1000;

      const leads = await searchLeads(env, {
        startDate,
        limit,
      });

      return {
        success: true,
        count: leads.length,
        timeRange: `Last ${hours} hours`,
        leads: leads.map((lead) => ({
          id: lead.id,
          source: lead.source,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          classification: lead.classification,
          score: lead.qualificationScore,
          campaign: lead.campaignName,
          timestamp: lead.timestamp,
          hoursAgo: Math.floor((Date.now() - lead.timestamp) / 1000 / 60 / 60),
        })),
      };
    },
  });
}

/**
 * Export all tools
 */
export function createLeadManagementTools(env: Env) {
  return {
    searchLeads: createSearchLeadsTool(env),
    getLeadStats: createGetLeadStatsTool(env),
    getAnalytics: createGetAnalyticsTool(env),
    getCampaignPerformance: createGetCampaignPerformanceTool(env),
    getSourcePerformance: createGetSourcePerformanceTool(env),
    findHotLeads: createFindHotLeadsTool(env),
    getRecentLeads: createGetRecentLeadsTool(env),
  };
}
