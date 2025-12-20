/**
 * Cloudflare Workers environment and bindings types
 */

export interface AIModel {
  run(
    model: string,
    options: {
      prompt: string;
      max_tokens?: number;
      temperature?: number;
      top_p?: number;
    }
  ): Promise<{ response: string }>;
}

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<{ keys: { name: string }[] }>;
}

export interface D1Database {
  prepare(query: string): {
    bind(...params: any[]): {
      run(): Promise<{ success: boolean }>;
      all(): Promise<{ results: any[] }>;
      first(column?: string): Promise<any>;
    };
  };
}

export interface R2Bucket {
  put(key: string, data: ArrayBuffer | string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
  list(): Promise<{ objects: { key: string }[] }>;
}

export interface DurableObjectNamespace {
  get(id: string): DurableObjectStub;
  newUniqueId(): string;
  idFromName(name: string): string;
}

export interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export interface DurableObjectState {
  id: DurableObjectId;
  storage?: DurableObjectStorage;
  waitUntil(promise: Promise<any>): void;
  blockConcurrencyWhile(fn: () => Promise<any>): Promise<any>;
}

export interface DurableObjectId {
  toString(): string;
  toHexString(): string;
}

export interface DurableObjectStorage {
  get(key: string): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<Map<string, any>>;
  deleteMultiple(keys: string[]): Promise<void>;
  transaction(
    callback: (txn: DurableObjectTransaction) => Promise<any>
  ): Promise<any>;
}

export interface DurableObjectTransaction {
  get(key: string): Promise<any>;
  put(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  getAndDelete(key: string): Promise<any>;
}

export interface Env {
  // AI binding
  AI: AIModel;

  // Environment variables
  AI_MODEL: string;
  ENVIRONMENT: "production" | "staging" | "development";
}
