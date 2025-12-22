/**
 * Memory Manager
 * Handles persistence and loading of agent memory blocks
 * Uses KV storage for scalability (like Cloudflare's KV)
 */

import {
  MemoryBlock,
  AgentMemoryState,
  getDefaultMemoryBlocks,
} from "../types/agent-memory";

export interface MemoryManagerConfig {
  kvNamespace?: any; // Cloudflare KV namespace
  storagePrefix?: string;
  enableLocalCache?: boolean;
}

class MemoryManager {
  private config: MemoryManagerConfig;
  private cache: Map<string, AgentMemoryState> = new Map();
  private kvNamespace: any = null;

  constructor(config: MemoryManagerConfig = {}) {
    this.config = {
      storagePrefix: "agent_memory:",
      enableLocalCache: true,
      ...config,
    };

    if (config.kvNamespace) {
      this.kvNamespace = config.kvNamespace;
    }
  }

  /**
   * Get the memory key for an agent and conversation
   */
  private getMemoryKey(agentRole: string, sessionId: string): string {
    return `${this.config.storagePrefix}${sessionId}:${agentRole}`;
  }

  /**
   * Load memory for an agent in a specific conversation
   */
  async loadMemory(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string
  ): Promise<AgentMemoryState> {
    const key = this.getMemoryKey(agentRole, sessionId);

    // Check cache first
    if (this.config.enableLocalCache && this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Check KV storage
    if (this.kvNamespace) {
      try {
        const stored = await this.kvNamespace.get(key);
        if (stored) {
          const state = JSON.parse(stored) as AgentMemoryState;
          if (this.config.enableLocalCache) {
            this.cache.set(key, state);
          }
          return state;
        }
      } catch (error) {
        console.error(`Failed to load memory from KV for ${key}:`, error);
      }
    }

    // Return default memory
    return this.createDefaultMemory(agentRole, sessionId);
  }

  /**
   * Save memory state
   */
  async saveMemory(state: AgentMemoryState, sessionId: string): Promise<void> {
    const key = this.getMemoryKey(state.agentRole, sessionId);

    // Update cache
    if (this.config.enableLocalCache) {
      this.cache.set(key, state);
    }

    // Save to KV if available
    if (this.kvNamespace) {
      try {
        await this.kvNamespace.put(key, JSON.stringify(state), {
          expirationTtl: 7 * 24 * 60 * 60, // 7 days TTL
        });
      } catch (error) {
        console.error(`Failed to save memory to KV for ${key}:`, error);
      }
    }
  }

  /**
   * Update a specific memory block
   */
  async updateMemoryBlock(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string,
    blockLabel: string,
    newValue: string
  ): Promise<void> {
    const state = await this.loadMemory(agentRole, sessionId);
    const block = state.blocks.find((b) => b.label === blockLabel);

    if (block) {
      block.value = newValue;
      block.lastUpdated = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await this.saveMemory(state, sessionId);
    }
  }

  /**
   * Replace text within a memory block
   */
  async replaceInMemoryBlock(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string,
    blockLabel: string,
    oldText: string,
    newText: string
  ): Promise<void> {
    const state = await this.loadMemory(agentRole, sessionId);
    const block = state.blocks.find((b) => b.label === blockLabel);

    if (block) {
      block.value = block.value.replace(oldText, newText);
      block.lastUpdated = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await this.saveMemory(state, sessionId);
    }
  }

  /**
   * Append text to a memory block
   */
  async appendToMemoryBlock(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string,
    blockLabel: string,
    textToAppend: string
  ): Promise<void> {
    const state = await this.loadMemory(agentRole, sessionId);
    const block = state.blocks.find((b) => b.label === blockLabel);

    if (block) {
      block.value = block.value + "\n" + textToAppend;
      block.lastUpdated = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await this.saveMemory(state, sessionId);
    }
  }

  /**
   * Create default memory for an agent
   */
  private createDefaultMemory(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string
  ): AgentMemoryState {
    return {
      agentRole,
      blocks: getDefaultMemoryBlocks(agentRole),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clear memory (for testing or reset)
   */
  async clearMemory(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string
  ): Promise<void> {
    const key = this.getMemoryKey(agentRole, sessionId);

    if (this.config.enableLocalCache) {
      this.cache.delete(key);
    }

    if (this.kvNamespace) {
      try {
        await this.kvNamespace.delete(key);
      } catch (error) {
        console.error(`Failed to clear memory from KV for ${key}:`, error);
      }
    }
  }

  /**
   * Clear all memory for a session (nuclear option)
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    const agents = ["router", "support", "csm", "ae", "sdr"] as const;
    for (const agent of agents) {
      await this.clearMemory(agent, sessionId);
    }
  }

  /**
   * Get memory state for debugging
   */
  async getMemoryState(
    agentRole: "router" | "support" | "csm" | "ae" | "sdr",
    sessionId: string
  ): Promise<AgentMemoryState> {
    return this.loadMemory(agentRole, sessionId);
  }
}

// Create and export singleton instance
let memoryManager: MemoryManager | null = null;

export function initializeMemoryManager(
  config?: MemoryManagerConfig
): MemoryManager {
  memoryManager = new MemoryManager(config);
  return memoryManager;
}

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}

export { MemoryManager };
