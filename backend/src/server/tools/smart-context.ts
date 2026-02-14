export interface SmartContext {
  user: {
    timezone?: string;
    locale?: string;
    lastSeen: number;
    preferences: Record<string, any>;
    deviceInfo?: {
      platform: string;
      language: string;
      userAgent: string;
    };
  };
  session: {
    toolsUsed: Array<{
      tool: string;
      timestamp: number;
      success: boolean;
      params?: any;
    }>;
    conversationContext: string[];
    totalInteractions: number;
  };
  capabilities: {
    available: string[];
    lastRefresh: number;
  };
}

export class SmartContextManager {
  private context: SmartContext;

  constructor(_sessionId: string) {
    this.context = {
      user: {
        lastSeen: Date.now(),
        preferences: {},
      },
      session: {
        toolsUsed: [],
        conversationContext: [],
        totalInteractions: 0,
      },
      capabilities: {
        available: [],
        lastRefresh: Date.now(),
      },
    };
  }

  async load(storage: any): Promise<void> {
    const stored = await storage.get("smart-context");
    if (stored) {
      this.context = stored;
      this.context.user.lastSeen = Date.now();
    }
  }

  async save(storage: any): Promise<void> {
    await storage.put("smart-context", this.context);
  }

  updateUserInfo(info: Partial<SmartContext["user"]>): void {
    this.context.user = {
      ...this.context.user,
      ...info,
      lastSeen: Date.now(),
    };
  }

  recordToolUsage(toolId: string, success: boolean, params?: any): void {
    this.context.session.toolsUsed.push({
      tool: toolId,
      timestamp: Date.now(),
      success,
      params,
    });

    // Keep only last 50 tool uses
    if (this.context.session.toolsUsed.length > 50) {
      this.context.session.toolsUsed =
        this.context.session.toolsUsed.slice(-50);
    }
  }

  addConversationContext(context: string): void {
    this.context.session.conversationContext.push(context);

    // Keep only last 10 contexts
    if (this.context.session.conversationContext.length > 10) {
      this.context.session.conversationContext =
        this.context.session.conversationContext.slice(-10);
    }
  }

  incrementInteractions(): void {
    this.context.session.totalInteractions++;
  }

  resetInteractions(): void {
    this.context.session.totalInteractions = 0;
    this.context.session.conversationContext = [];
  }

  updateCapabilities(capabilities: string[]): void {
    this.context.capabilities.available = capabilities;
    this.context.capabilities.lastRefresh = Date.now();
  }

  getContext(): SmartContext {
    return this.context;
  }

  getContextSummary(): string {
    const user = this.context.user;
    const session = this.context.session;

    const parts: string[] = [];

    if (user.timezone) {
      parts.push(`User Timezone: ${user.timezone}`);
    }

    if (user.locale) {
      parts.push(`User Locale: ${user.locale}`);
    }

    if (user.deviceInfo) {
      parts.push(`Device: ${user.deviceInfo.platform}`);
    }

    if (session.toolsUsed.length > 0) {
      const recentTools = session.toolsUsed.slice(-5).map((t) => t.tool);
      parts.push(`Recent Tools Used: ${recentTools.join(", ")}`);
    }

    if (session.conversationContext.length > 0) {
      parts.push(
        `Recent Context: ${session.conversationContext.slice(-3).join("; ")}`
      );
    }

    parts.push(`Total Interactions: ${session.totalInteractions}`);

    return parts.join("\n");
  }

  getPreference(key: string, defaultValue?: any): any {
    return this.context.user.preferences[key] ?? defaultValue;
  }

  setPreference(key: string, value: any): void {
    this.context.user.preferences[key] = value;
  }

  getMostUsedTools(limit: number = 5): string[] {
    const toolCounts = new Map<string, number>();

    for (const usage of this.context.session.toolsUsed) {
      if (usage.success) {
        toolCounts.set(usage.tool, (toolCounts.get(usage.tool) || 0) + 1);
      }
    }

    return Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tool]) => tool);
  }
}
