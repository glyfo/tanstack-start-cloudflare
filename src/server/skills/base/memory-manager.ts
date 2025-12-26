/**
 * [INFRASTRUCTURE] Memory Manager
 *
 * Handles skill memory persistence across sessions.
 * Uses Durable Objects for per-skill and per-domain memory storage.
 * Supports TTL (time-to-live), statistics, and batch operations.
 *
 * USED BY: SkillGroup, BaseSkill (via context)
 * DEPENDS ON: None (state is passed in)
 */

export interface MemoryEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export interface MemoryStats {
  totalEntries: number;
  memorySize: number;
  oldestEntry: number;
  newestEntry: number;
}

export class MemoryManager {
  private state: any; // Durable Object state

  constructor(state: any) {
    this.state = state;
  }

  /**
   * Get memory entry
   */
  async get(key: string): Promise<any | null> {
    try {
      const entry = await this.state.get(key);
      if (!entry) return null;

      // Check if expired
      if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
        await this.state.delete(key);
        return null;
      }

      return entry.data;
    } catch (error: any) {
      console.error(`Error getting memory ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set memory entry
   */
  async set(key: string, data: any, ttl?: number): Promise<void> {
    try {
      const entry: MemoryEntry = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
      };

      await this.state.put(key, entry);
    } catch (error: any) {
      console.error(`Error setting memory ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete memory entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.state.delete(key);
    } catch (error: any) {
      console.error(`Error deleting memory ${key}:`, error.message);
    }
  }

  /**
   * Get all entries for a prefix
   */
  async getByPrefix(prefix: string): Promise<Record<string, any>> {
    try {
      const result: Record<string, any> = {};
      const keys = await this.state.list({ prefix });

      for (const key of keys) {
        const entry = await this.get(key);
        if (entry) {
          result[key] = entry;
        }
      }

      return result;
    } catch (error: any) {
      console.error(`Error getting memory by prefix ${prefix}:`, error.message);
      return {};
    }
  }

  /**
   * Initialize skill memory
   */
  async initializeSkill(skillId: string, initialData?: any): Promise<void> {
    const memoryKey = `skill-memory:${skillId}`;
    const existing = await this.get(memoryKey);

    if (!existing) {
      await this.set(memoryKey, initialData || {});
    }
  }

  /**
   * Initialize domain memory
   */
  async initializeDomain(domain: string, initialData?: any): Promise<void> {
    const memoryKey = `domain-memory:${domain}`;
    const existing = await this.get(memoryKey);

    if (!existing) {
      await this.set(memoryKey, initialData || {});
    }
  }

  /**
   * Get skill memory
   */
  async getSkillMemory(skillId: string): Promise<any> {
    return this.get(`skill-memory:${skillId}`);
  }

  /**
   * Update skill memory
   */
  async updateSkillMemory(skillId: string, data: any): Promise<void> {
    await this.set(`skill-memory:${skillId}`, data);
  }

  /**
   * Get domain memory
   */
  async getDomainMemory(domain: string): Promise<any> {
    return this.get(`domain-memory:${domain}`);
  }

  /**
   * Update domain memory
   */
  async updateDomainMemory(domain: string, data: any): Promise<void> {
    await this.set(`domain-memory:${domain}`, data);
  }

  /**
   * Clear all memory
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.state.list();
      for (const key of keys) {
        await this.state.delete(key);
      }
    } catch (error: any) {
      console.error("Error clearing memory:", error.message);
    }
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    try {
      const keys = await this.state.list();
      let totalSize = 0;
      let oldestTime = Date.now();
      let newestTime = 0;

      for (const key of keys) {
        const entry = await this.state.get(key);
        if (entry) {
          totalSize += JSON.stringify(entry).length;
          oldestTime = Math.min(oldestTime, entry.timestamp || Date.now());
          newestTime = Math.max(newestTime, entry.timestamp || Date.now());
        }
      }

      return {
        totalEntries: keys.length,
        memorySize: totalSize,
        oldestEntry: oldestTime,
        newestEntry: newestTime,
      };
    } catch (error: any) {
      console.error("Error getting memory stats:", error.message);
      return {
        totalEntries: 0,
        memorySize: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }

  /**
   * Append to array in memory
   */
  async append(key: string, item: any): Promise<void> {
    try {
      let data = await this.get(key);
      if (!Array.isArray(data)) {
        data = [];
      }

      data.push(item);
      await this.set(key, data);
    } catch (error: any) {
      console.error(`Error appending to ${key}:`, error.message);
      throw error;
    }
  }

  /**
   * Increment counter in memory
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      let value = await this.get(key);
      if (typeof value !== "number") {
        value = 0;
      }

      value += amount;
      await this.set(key, value);
      return value;
    } catch (error: any) {
      console.error(`Error incrementing ${key}:`, error.message);
      throw error;
    }
  }
}
