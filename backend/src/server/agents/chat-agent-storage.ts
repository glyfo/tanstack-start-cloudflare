// Storage/context helpers for ChatAgent
import { Message } from "./chat-agent-types";

// Custom error class for storage operations
export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageError';
  }
}

/**
 * ChatAgentStorage - Handles all Durable Object storage operations
 * Uses dependency injection instead of globalThis for better reliability
 */
export class ChatAgentStorage {
  constructor(private storage: DurableObjectStorage) {
    if (!storage) {
      throw new Error('DurableObjectStorage is required');
    }
  }

  /**
   * Save a message to storage
   */
  async saveMessage(message: Message): Promise<void> {
    try {
      await this.storage.put(`message:${message.id}`, message);
    } catch (error) {
      console.error('[Storage] Failed to save message:', {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new StorageError('Failed to save message', { cause: error });
    }
  }

  /**
   * Get messages with pagination support
   */
  async getMessages(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Message[]> {
    try {
      const limit = options?.limit || 50; // Default to 50 messages
      const offset = options?.offset || 0;

      // Fetch more than needed if offset is used
      const entries = await this.storage.list<Message>({
        prefix: "message:",
        limit: limit + offset,
      });

      let messages = Array.from(entries.values())
        .filter((m): m is Message => m != null && typeof m === 'object')
        .map((m: any) => ({
          ...m,
          parts: m.parts || [{ type: "text", text: m.content || "" }],
        })) as Message[];

      // Sort by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      // Apply offset and limit
      if (offset > 0) {
        messages = messages.slice(offset);
      }

      return messages.slice(0, limit);
    } catch (error) {
      console.error('[Storage] Failed to get messages:', error);
      // Return empty array instead of crashing
      return [];
    }
  }

  /**
   * Get total message count
   */
  async getMessageCount(): Promise<number> {
    try {
      const entries = await this.storage.list({ prefix: "message:" });
      return entries.size;
    } catch (error) {
      console.error('[Storage] Failed to get message count:', error);
      return 0;
    }
  }

  /**
   * Clear all messages
   */
  async clearMessages(): Promise<void> {
    try {
      const keys = await this.storage.list({ prefix: "message:" });
      if (keys.size > 0) {
        await this.storage.delete(Array.from(keys.keys()));
      }
    } catch (error) {
      console.error('[Storage] Failed to clear messages:', error);
      throw new StorageError('Failed to clear messages', { cause: error });
    }
  }

  /**
   * Clean up old messages beyond retention period
   * @param daysToKeep Number of days to keep messages (default: 30)
   * @returns Number of messages deleted
   */
  async cleanupOldMessages(daysToKeep = 30): Promise<number> {
    try {
      const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const entries = await this.storage.list<Message>({ prefix: "message:" });

      const toDelete: string[] = [];
      for (const [key, message] of entries) {
        if (message.timestamp < cutoff) {
          toDelete.push(key);
        }
      }

      if (toDelete.length > 0) {
        await this.storage.delete(toDelete);
        console.log(`[Storage] Cleaned up ${toDelete.length} old messages`);
      }

      return toDelete.length;
    } catch (error) {
      console.error('[Storage] Failed to cleanup old messages:', error);
      return 0;
    }
  }

  /**
   * Get learnings (placeholder for future implementation)
   */
  async getLearnings(): Promise<any[]> {
    try {
      const entries = await this.storage.list({ prefix: "learning:" });
      return Array.from(entries.values());
    } catch (error) {
      console.error('[Storage] Failed to get learnings:', error);
      return [];
    }
  }

  /**
   * Get last cleanup timestamp
   */
  async getLastCleanup(): Promise<number> {
    try {
      return await this.storage.get<number>('lastCleanup') || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Set last cleanup timestamp
   */
  async setLastCleanup(timestamp: number): Promise<void> {
    try {
      await this.storage.put('lastCleanup', timestamp);
    } catch (error) {
      console.error('[Storage] Failed to set lastCleanup:', error);
    }
  }
}
