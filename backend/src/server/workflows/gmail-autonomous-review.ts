import { createLogger } from "@/server/utils/logger";
import { listGmailEmails } from "@/server/tools/gmail-tools";

const logger = createLogger("GmailAutonomousReview");

const DEFAULT_QUERY = "in:inbox is:unread";
const DEFAULT_MAX_RESULTS = 10;
const MAX_RESULTS_LIMIT = 20;

export interface GmailAutonomousConfig {
  enabled: boolean;
  orgIds: string[];
  query: string;
  maxResults: number;
}

export interface GmailAutonomousReviewSummary {
  enabled: boolean;
  ranAt: string;
  orgsConfigured: number;
  orgsProcessed: number;
  totalUnreadEmails: number;
  results: Array<{
    orgId: string;
    success: boolean;
    unreadCount: number;
    error?: string;
  }>;
}

function parseBoolean(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseOrgIds(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMaxResults(raw: unknown): number {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_RESULTS;
  return Math.min(value, MAX_RESULTS_LIMIT);
}

export function getGmailAutonomousConfig(env: Record<string, unknown>): GmailAutonomousConfig {
  return {
    enabled: parseBoolean(env.GMAIL_AUTONOMOUS_ENABLED),
    orgIds: parseOrgIds(env.GMAIL_AUTONOMOUS_ORGS),
    query:
      typeof env.GMAIL_AUTONOMOUS_QUERY === "string" && env.GMAIL_AUTONOMOUS_QUERY.trim().length > 0
        ? env.GMAIL_AUTONOMOUS_QUERY.trim()
        : DEFAULT_QUERY,
    maxResults: parseMaxResults(env.GMAIL_AUTONOMOUS_MAX_RESULTS),
  };
}

export async function runGmailAutonomousReview(
  env: Record<string, unknown>,
  meta?: { cron?: string; scheduledTime?: number }
): Promise<GmailAutonomousReviewSummary> {
  const config = getGmailAutonomousConfig(env);
  const now = new Date().toISOString();

  if (!config.enabled) {
    logger.info("Skipped Gmail autonomous review (disabled)");
    return {
      enabled: false,
      ranAt: now,
      orgsConfigured: config.orgIds.length,
      orgsProcessed: 0,
      totalUnreadEmails: 0,
      results: [],
    };
  }

  if (config.orgIds.length === 0) {
    logger.warn("Gmail autonomous review enabled but no org IDs configured");
    return {
      enabled: true,
      ranAt: now,
      orgsConfigured: 0,
      orgsProcessed: 0,
      totalUnreadEmails: 0,
      results: [],
    };
  }

  logger.info("Running scheduled Gmail autonomous review", {
    orgCount: config.orgIds.length,
    query: config.query,
    maxResults: config.maxResults,
    cron: meta?.cron,
    scheduledTime: meta?.scheduledTime,
  });

  const results: GmailAutonomousReviewSummary["results"] = [];
  let totalUnreadEmails = 0;

  for (const orgId of config.orgIds) {
    try {
      const listed = await listGmailEmails(env, orgId, {
        query: config.query,
        maxResults: config.maxResults,
        labelIds: ["INBOX"],
      });

      if (!listed.success) {
        results.push({
          orgId,
          success: false,
          unreadCount: 0,
          error: listed.error || "Unknown Gmail error",
        });
        continue;
      }

      const unreadCount = listed.data?.length || 0;
      totalUnreadEmails += unreadCount;
      results.push({
        orgId,
        success: true,
        unreadCount,
      });

      logger.info("Autonomous Gmail review result", {
        orgId,
        unreadCount,
      });
    } catch (error) {
      logger.error("Autonomous Gmail review failed", { orgId, error });
      results.push({
        orgId,
        success: false,
        unreadCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const summary: GmailAutonomousReviewSummary = {
    enabled: true,
    ranAt: now,
    orgsConfigured: config.orgIds.length,
    orgsProcessed: results.length,
    totalUnreadEmails,
    results,
  };

  logger.info("Completed scheduled Gmail autonomous review", {
    orgsProcessed: summary.orgsProcessed,
    totalUnreadEmails: summary.totalUnreadEmails,
    failures: results.filter((r) => !r.success).length,
  });

  return summary;
}
