import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListGmailEmails } = vi.hoisted(() => ({
  mockListGmailEmails: vi.fn(),
}));

vi.mock("@/server/tools/gmail-tools", () => ({
  listGmailEmails: mockListGmailEmails,
}));

import {
  getGmailAutonomousConfig,
  runGmailAutonomousReview,
} from "../gmail-autonomous-review";

describe("gmail-autonomous-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses config from env", () => {
    const config = getGmailAutonomousConfig({
      GMAIL_AUTONOMOUS_ENABLED: "true",
      GMAIL_AUTONOMOUS_ORGS: "org-a, org-b",
      GMAIL_AUTONOMOUS_QUERY: "in:inbox is:unread newer_than:1d",
      GMAIL_AUTONOMOUS_MAX_RESULTS: "25",
    });

    expect(config.enabled).toBe(true);
    expect(config.orgIds).toEqual(["org-a", "org-b"]);
    expect(config.query).toBe("in:inbox is:unread newer_than:1d");
    expect(config.maxResults).toBe(20);
  });

  it("skips when disabled", async () => {
    const summary = await runGmailAutonomousReview({
      GMAIL_AUTONOMOUS_ENABLED: "false",
      GMAIL_AUTONOMOUS_ORGS: "default-org",
    });

    expect(summary.enabled).toBe(false);
    expect(summary.orgsProcessed).toBe(0);
    expect(mockListGmailEmails).not.toHaveBeenCalled();
  });

  it("runs per org and aggregates unread counts", async () => {
    mockListGmailEmails
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: "1" }, { id: "2" }],
      })
      .mockResolvedValueOnce({
        success: false,
        error: "not connected",
      });

    const summary = await runGmailAutonomousReview({
      GMAIL_AUTONOMOUS_ENABLED: "true",
      GMAIL_AUTONOMOUS_ORGS: "org-1,org-2",
      GMAIL_AUTONOMOUS_QUERY: "in:inbox is:unread",
      GMAIL_AUTONOMOUS_MAX_RESULTS: "5",
    });

    expect(mockListGmailEmails).toHaveBeenCalledTimes(2);
    expect(summary.enabled).toBe(true);
    expect(summary.orgsConfigured).toBe(2);
    expect(summary.orgsProcessed).toBe(2);
    expect(summary.totalUnreadEmails).toBe(2);
    expect(summary.results[0]).toMatchObject({
      orgId: "org-1",
      success: true,
      unreadCount: 2,
    });
    expect(summary.results[1]).toMatchObject({
      orgId: "org-2",
      success: false,
      unreadCount: 0,
      error: "not connected",
    });
  });
});
