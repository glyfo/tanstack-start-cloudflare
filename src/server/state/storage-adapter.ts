/**
 * [STATE] Storage Adapter
 *
 * Adapts plain objects or ChatState to provide Durable Object-like interface.
 * Provides get/put/delete/list methods for MemoryManager compatibility.
 *
 * USED BY: SkillGroup initialization
 * DEPENDS ON: None
 */

export class StorageAdapter {
  private storage: Map<string, any> = new Map();

  /**
   * Get value by key
   */
  async get(key: string): Promise<any> {
    return this.storage.get(key) ?? null;
  }

  /**
   * Put value by key
   */
  async put(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * List all keys, optionally filtered by prefix
   */
  async list(options?: { prefix?: string }): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    if (options?.prefix) {
      return keys.filter((k) => k.startsWith(options.prefix!));
    }
    return keys;
  }

  /**
   * Get all entries
   */
  async getAll(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    for (const [key, value] of this.storage.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }
}
