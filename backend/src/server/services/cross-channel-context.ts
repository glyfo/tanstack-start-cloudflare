/**
 * Cross-Channel Context Service
 *
 * Aggregates conversation history and context from all channels for a unified customer view.
 * Provides 360° customer context to the AI agent.
 */

import type { Env } from '../types/env';

// ============================================================================
// Types
// ============================================================================

/**
 * Unified message across all channels
 */
export interface UnifiedMessage {
  messageId: string;
  customerId: string;
  channelType: string;
  sessionKey: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Cross-channel context for AI
 */
export interface CrossChannelContext {
  customerId: string;
  displayName?: string;
  primaryEmail?: string;
  primaryPhone?: string;

  // Channel identities
  channels: {
    channelType: string;
    identifier: string;
    lastSeenAt: number;
    messageCount: number;
  }[];

  // Conversation history (last N messages across all channels)
  recentMessages: UnifiedMessage[];

  // Activity summary
  totalMessages: number;
  firstContactAt: number;
  lastActivityAt: number;
  channelActivity: Record<string, number>;

  // Contact info (if linked)
  contactId?: string;
  tags?: string[];
  customFields?: Record<string, any>;
}

/**
 * Channel history query
 */
interface ChannelHistoryQuery {
  sessionKey: string;
  limit?: number;
  before?: number;
}

// ============================================================================
// CrossChannelContextService
// ============================================================================

export class CrossChannelContextService {
  constructor(private env: Env) {}

  /**
   * Get unified context for a customer across all channels
   */
  async getCustomerContext(customerId: string): Promise<CrossChannelContext | null> {
    try {
      // Get customer identity
      const identityDO = await this.getCustomerIdentityDO(customerId);
      const response = await identityDO.fetch(`http://internal/customer?customerId=${customerId}`);

      if (!response.ok) {
        console.error('[CrossChannelContext] Failed to get customer profile');
        return null;
      }

      const profile = await response.json() as any;

      if (!profile) {
        return null;
      }

      // Aggregate messages from all channels
      const recentMessages = await this.aggregateMessages(profile);

      // Build context
      const context: CrossChannelContext = {
        customerId: profile.customerId,
        displayName: profile.displayName,
        primaryEmail: profile.primaryEmail,
        primaryPhone: profile.primaryPhone,

        channels: profile.identities.map((identity: any) => ({
          channelType: identity.channelType,
          identifier: identity.identifier,
          lastSeenAt: identity.lastSeenAt,
          messageCount: identity.messageCount,
        })),

        recentMessages,

        totalMessages: profile.totalMessages,
        firstContactAt: profile.firstContactAt,
        lastActivityAt: profile.lastActivityAt,
        channelActivity: profile.channelActivity,

        contactId: profile.contactId,
        tags: profile.tags,
        customFields: profile.customFields,
      };

      return context;
    } catch (error) {
      console.error('[CrossChannelContext] Error getting customer context:', error);
      return null;
    }
  }

  /**
   * Aggregate messages from all channels for a customer
   */
  private async aggregateMessages(customerProfile: any): Promise<UnifiedMessage[]> {
    const allMessages: UnifiedMessage[] = [];

    // For each channel identity, get recent messages
    for (const identity of customerProfile.identities) {
      try {
        const sessionKey = this.computeSessionKey(
          customerProfile.orgId,
          identity.channelType,
          identity.identifier,
        );

        const messages = await this.getChannelMessages(sessionKey, 20);
        allMessages.push(...messages);
      } catch (error) {
        console.error(`[CrossChannelContext] Error getting messages for ${identity.channelType}:`, error);
        // Continue with other channels
      }
    }

    // Sort by timestamp (most recent first)
    allMessages.sort((a, b) => b.timestamp - a.timestamp);

    // Return last 50 messages across all channels
    return allMessages.slice(0, 50);
  }

  /**
   * Get messages from a specific channel session
   */
  private async getChannelMessages(
    sessionKey: string,
    limit: number = 20,
  ): Promise<UnifiedMessage[]> {
    try {
      // Get ChatAgent DO for this session
      const agentDO = this.env.CHAT_AGENT.idFromName(sessionKey);
      const agent = this.env.CHAT_AGENT.get(agentDO);

      // Request messages from agent
      const response = await agent.fetch('http://internal/messages', {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as any;
      const messages = data.messages || [];

      // Convert to unified format
      return messages.slice(-limit).map((msg: any) => ({
        messageId: msg.metadata?.messageId || crypto.randomUUID(),
        customerId: data.customerId || 'unknown',
        channelType: this.extractChannelFromSessionKey(sessionKey),
        sessionKey,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        metadata: msg.metadata,
      }));
    } catch (error) {
      console.error(`[CrossChannelContext] Error getting channel messages:`, error);
      return [];
    }
  }

  /**
   * Format cross-channel context for AI system prompt
   */
  formatContextForAI(context: CrossChannelContext): string {
    let prompt = `## 360° Customer Context\n\n`;

    // Customer info
    prompt += `**Customer:** ${context.displayName || 'Unknown'}\n`;
    if (context.primaryEmail) {
      prompt += `**Email:** ${context.primaryEmail}\n`;
    }
    if (context.primaryPhone) {
      prompt += `**Phone:** ${context.primaryPhone}\n`;
    }

    // Channel activity
    prompt += `\n**Active Channels:** ${context.channels.length}\n`;
    for (const channel of context.channels) {
      const lastSeen = new Date(channel.lastSeenAt).toLocaleDateString();
      prompt += `- ${channel.channelType}: ${channel.messageCount} messages (last seen: ${lastSeen})\n`;
    }

    // Conversation summary
    prompt += `\n**Total Interactions:** ${context.totalMessages} messages\n`;
    prompt += `**First Contact:** ${new Date(context.firstContactAt).toLocaleDateString()}\n`;
    prompt += `**Last Activity:** ${new Date(context.lastActivityAt).toLocaleDateString()}\n`;

    // Recent activity across channels
    if (context.recentMessages.length > 0) {
      prompt += `\n**Recent Conversation History (All Channels):**\n`;

      // Group by date
      const messagesByDate: Record<string, UnifiedMessage[]> = {};
      for (const msg of context.recentMessages.slice(0, 20)) {
        const date = new Date(msg.timestamp).toLocaleDateString();
        if (!messagesByDate[date]) {
          messagesByDate[date] = [];
        }
        messagesByDate[date].push(msg);
      }

      for (const [date, messages] of Object.entries(messagesByDate)) {
        prompt += `\n### ${date}\n`;
        for (const msg of messages) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const channel = msg.channelType.toUpperCase();
          const role = msg.role === 'user' ? 'Customer' : 'Assistant';
          prompt += `[${time} via ${channel}] ${role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
        }
      }
    }

    // Tags and custom fields
    if (context.tags && context.tags.length > 0) {
      prompt += `\n**Tags:** ${context.tags.join(', ')}\n`;
    }

    if (context.customFields && Object.keys(context.customFields).length > 0) {
      prompt += `\n**Custom Fields:**\n`;
      for (const [key, value] of Object.entries(context.customFields)) {
        prompt += `- ${key}: ${value}\n`;
      }
    }

    prompt += `\n---\n\n`;
    prompt += `**Important:** This customer has communicated via multiple channels. `;
    prompt += `Previous conversations on ${context.channels.map(c => c.channelType).join(', ')} `;
    prompt += `are shown above. Maintain context continuity across all channels.\n`;

    return prompt;
  }

  /**
   * Update customer activity after message
   */
  async updateCustomerActivity(customerId: string, channelType: string): Promise<void> {
    try {
      const identityDO = await this.getCustomerIdentityDO(customerId);
      await identityDO.fetch('http://internal/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, channelType }),
      });
    } catch (error) {
      console.error('[CrossChannelContext] Error updating activity:', error);
    }
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Get CustomerIdentityDO stub
   */
  private async getCustomerIdentityDO(customerId: string): Promise<DurableObjectStub> {
    // Use orgId from customerId (format: customer-orgId-timestamp-random)
    const orgId = customerId.split('-')[1] || 'default-org';
    const id = this.env.CUSTOMER_IDENTITY.idFromName(orgId);
    return this.env.CUSTOMER_IDENTITY.get(id);
  }

  /**
   * Compute session key from components
   */
  private computeSessionKey(orgId: string, channelType: string, identifier: string): string {
    const scope = 'dm'; // For now, assume DM
    return `agent:${orgId}:${channelType}:${scope}:${identifier}`;
  }

  /**
   * Extract channel type from session key
   */
  private extractChannelFromSessionKey(sessionKey: string): string {
    const parts = sessionKey.split(':');
    return parts.length >= 3 ? parts[2] : 'unknown';
  }
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * Resolve customer identity from channel message
 */
export async function resolveCustomerIdentity(
  env: Env,
  orgId: string,
  channelType: string,
  identifier: string,
  displayName?: string,
  metadata?: Record<string, any>,
): Promise<{ customerId: string; isNew: boolean }> {
  try {
    // Get CustomerIdentityDO
    const id = env.CUSTOMER_IDENTITY.idFromName(orgId);
    const identityDO = env.CUSTOMER_IDENTITY.get(id);

    // Find or create customer
    const response = await identityDO.fetch('http://internal/find-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelType,
        identifier,
        orgId,
        displayName,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to resolve identity');
    }

    const customer = await response.json() as any;

    return {
      customerId: customer.customerId,
      isNew: customer.identities.length === 1 && customer.totalMessages === 0,
    };
  } catch (error) {
    console.error('[CrossChannelContext] Error resolving identity:', error);
    // Return fallback customer ID
    return {
      customerId: `customer-${orgId}-${Date.now()}`,
      isNew: true,
    };
  }
}
