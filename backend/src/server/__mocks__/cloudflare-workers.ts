/**
 * Mock for cloudflare:workers module
 * Used in tests to simulate Cloudflare Durable Object environment
 */

export class DurableObject {
  ctx: any;
  env: any;

  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }
}

export interface DurableObjectState {
  id: DurableObjectId;
  storage: DurableObjectStorage;
}

export interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T>(key: string, value: T): Promise<void>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(options?: {
    prefix?: string;
    start?: string;
    end?: string;
    limit?: number;
  }): Promise<Map<string, T>>;
  sql: SqlStorage;
}

export interface SqlStorage {
  exec(query: string, ...bindings: any[]): { toArray(): any[] };
}
