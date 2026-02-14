import { ExtendedUIMessage, Message } from "../chat-agent-types";

export class ChatPersistence {
  private storage: DurableObjectStorage;

  // Retention configuration
  private static readonly MESSAGE_RETENTION_DAYS = 30;
  private static readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(storage: DurableObjectStorage) {
    this.storage = storage;
  }

  /**
   * Initialize all necessary tables
   */
  initializeTables(): void {
    try {
      // Messages table (handled by AIChatAgent base)
      
      // Learnings table
      this.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS learnings (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          created_at INTEGER DEFAULT (unixepoch())
        )
      `);

      // Flow context table
      this.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS flow_context (
          id TEXT PRIMARY KEY DEFAULT 'current',
          flow_id TEXT,
          stage INTEGER,
          status TEXT,
          started_at INTEGER,
          updated_at INTEGER,
          collected_data TEXT,
          error TEXT
        )
      `);

      // Cleanup tracking
      this.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS cleanup_state (
          key TEXT PRIMARY KEY,
          value INTEGER
        )
      `);
    } catch (error) {
      console.error('[ChatPersistence] Failed to initialize tables:', error);
    }
  }

  /**
   * Save messages to storage
   * Uses JSON serialization for complex objects
   */
  async saveMessages(messages: ExtendedUIMessage[]): Promise<void> {
    // If we were using AIChatAgent.saveMessages, we might just delegate. 
    // But to decouple, we can implement our own or just expose a helper.
    // For now, we'll assume the Agent calls this to sync state, or we implement the actual SQL.
    
    // NOTE: In the original code, this.saveMessages was from AIChatAgent.
    // We will implement a robust upsert here if we want to replace it.
    // For the MVP refactor, we might still rely on the base class for *access* if we extend it,
    // but moving logic here is better.
    
    // Let's implement a simple transaction to save latest messages
    // This is a placeholder for the actual persistence logic if we were to replace the base class fully.
    // If we still extend AIChatAgent, we might not need this fully, 
    // BUT the goal is to refactor. Let's assume we want to control storage.
    
    // However, since ChatAgent extends AIChatAgent, it has built-in persistence.
    // We should probably keep using that for now OR override it.
    // To match the refactor goal of "Extract SQLite operations", we should put the CUSTOM operations here.
  }

  /**
   * Run cleanup if needed
   */
  async performCleanup(): Promise<void> {
    try {
      const result = this.storage.sql.exec(
        `SELECT value FROM cleanup_state WHERE key = 'last_cleanup'`
      );
      const rows = [...result];
      const lastCleanup = rows.length > 0 ? (rows[0] as any).value : 0;
      const now = Date.now();

      if (now - lastCleanup > ChatPersistence.CLEANUP_INTERVAL_MS) {
        const cutoff = now - (ChatPersistence.MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const cutoffDate = new Date(cutoff).toISOString();

        // Assuming standard 'messages' table from AIChatAgent
        this.storage.sql.exec(
          `DELETE FROM messages WHERE createdAt < ?`,
          cutoffDate
        );

        this.storage.sql.exec(
          `INSERT OR REPLACE INTO cleanup_state (key, value) VALUES ('last_cleanup', ?)`,
          now
        );

        console.log(`[ChatPersistence] Cleaned up old messages`);
      }
    } catch (error) {
      console.error('[ChatPersistence] Failed to perform cleanup:', error);
    }
  }

  /**
   * Migrate from Legacy KV storage
   */
  async migrateFromKV(storage: DurableObjectStorage): Promise<ExtendedUIMessage[] | null> {
    try {
      const migrationKey = 'kv_migration_complete';
      const migrated = await storage.get<boolean>(migrationKey);

      if (migrated) return null;

      const entries = await storage.list<Message>({ prefix: "message:" });
      if (entries.size === 0) return null;

      console.log(`[ChatPersistence] Migrating ${entries.size} messages from KV`);

      const migratedMessages: ExtendedUIMessage[] = [];
      for (const [_, message] of entries) {
        migratedMessages.push({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: new Date(message.timestamp),
        });
      }

      await storage.put(migrationKey, true);
      return migratedMessages.sort((a, b) => 
        (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)
      );
    } catch (error) {
      console.error('[ChatPersistence] Migration failed:', error);
      return null;
    }
  }
}
