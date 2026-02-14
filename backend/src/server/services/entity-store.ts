/**
 * Entity Store - Type-safe persistence layer
 * Following "Ship Types, Not Docs" philosophy
 */

import {
  ContactSchema,
  OpportunitySchema,
  CreateContactSchema,
  CreateOpportunitySchema,
  validateSchema,
  prepareForPersistence,
  type Contact,
  type Opportunity,
  type CreateContactInput,
  type CreateOpportunityInput,
  STAGE_CONFIG,
} from '../schemas/entities';

// ============================================================================
// STORE INTERFACE
// ============================================================================

export interface EntityStore<T, TCreate> {
  create(data: TCreate): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }>;
  get(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<{ success: true; data: T } | { success: false; errors: Record<string, string> }>;
  delete(id: string): Promise<boolean>;
  list(options?: { limit?: number; offset?: number }): Promise<T[]>;
  search(query: string): Promise<T[]>;
}

// ============================================================================
// CONTACT STORE
// ============================================================================

export function createContactStore(
  storage: DurableObjectStorage | KVNamespace,
  orgId: string
): EntityStore<Contact, CreateContactInput> {
  const prefix = `contact:${orgId}`;
  const isKV = 'get' in storage && 'put' in storage && !('sql' in storage);

  return {
    async create(input: CreateContactInput) {
      const validation = validateSchema(CreateContactSchema, input);
      if (!validation.success) {
        return { success: false as const, errors: validation.errors! };
      }

      const id = generateId();
      const now = Date.now();
      const contact: Contact = {
        ...validation.data!,
        id,
        leadScore: 0,
        status: 'active',
        tags: validation.data!.tags || [],
        customFields: {},
        createdAt: now,
        updatedAt: now,
      };

      if (isKV) {
        await (storage as KVNamespace).put(`${prefix}:${id}`, JSON.stringify(contact));
      } else {
        await (storage as DurableObjectStorage).put(`${prefix}:${id}`, contact);
      }

      return { success: true as const, data: contact };
    },

    async get(id: string) {
      if (isKV) {
        const data = await (storage as KVNamespace).get(`${prefix}:${id}`, 'json');
        if (!data) return null;
        const result = ContactSchema.safeParse(data);
        return result.success ? result.data : null;
      } else {
        const data = await (storage as DurableObjectStorage).get(`${prefix}:${id}`);
        if (!data) return null;
        const result = ContactSchema.safeParse(data);
        return result.success ? result.data : null;
      }
    },

    async update(id: string, updates: Partial<Contact>) {
      const existing = await this.get(id);
      if (!existing) {
        return { success: false as const, errors: { id: 'Contact not found' } };
      }

      const updated: Contact = {
        ...existing,
        ...updates,
        id,
        updatedAt: Date.now(),
      };

      const validation = validateSchema(ContactSchema, updated);
      if (!validation.success) {
        return { success: false as const, errors: validation.errors! };
      }

      if (isKV) {
        await (storage as KVNamespace).put(`${prefix}:${id}`, JSON.stringify(validation.data!));
      } else {
        await (storage as DurableObjectStorage).put(`${prefix}:${id}`, validation.data!);
      }

      return { success: true as const, data: validation.data! };
    },

    async delete(id: string) {
      if (isKV) {
        await (storage as KVNamespace).delete(`${prefix}:${id}`);
      } else {
        await (storage as DurableObjectStorage).delete(`${prefix}:${id}`);
      }
      return true;
    },

    async list(options = {}) {
      const { limit = 50, offset = 0 } = options;
      const contacts: Contact[] = [];

      if (isKV) {
        const keys = await (storage as KVNamespace).list({ prefix: `${prefix}:`, limit: limit + offset });
        const keysToFetch = keys.keys.slice(offset, offset + limit);
        for (const key of keysToFetch) {
          const data = await (storage as KVNamespace).get(key.name, 'json');
          if (data) {
            const result = ContactSchema.safeParse(data);
            if (result.success) contacts.push(result.data);
          }
        }
      } else {
        const map = await (storage as DurableObjectStorage).list({ prefix: `${prefix}:` });
        let index = 0;
        for (const [, value] of map) {
          if (index >= offset && contacts.length < limit) {
            const result = ContactSchema.safeParse(value);
            if (result.success) contacts.push(result.data);
          }
          index++;
        }
      }
      return contacts;
    },

    async search(query: string) {
      const all = await this.list({ limit: 1000 });
      const q = query.toLowerCase();
      return all.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)
      );
    },
  };
}

// ============================================================================
// OPPORTUNITY STORE
// ============================================================================

export function createOpportunityStore(
  storage: DurableObjectStorage | KVNamespace,
  orgId: string
): EntityStore<Opportunity, CreateOpportunityInput> {
  const prefix = `opportunity:${orgId}`;
  const isKV = 'get' in storage && 'put' in storage && !('sql' in storage);

  return {
    async create(input: CreateOpportunityInput) {
      const validation = validateSchema(CreateOpportunitySchema, input);
      if (!validation.success) {
        return { success: false as const, errors: validation.errors! };
      }

      const id = generateId();
      const now = Date.now();
      const stage = validation.data!.stage || 'lead';
      const probability = validation.data!.probability ?? STAGE_CONFIG[stage].probability;

      const opportunity: Opportunity = {
        ...validation.data!,
        id,
        stage,
        probability,
        source: validation.data!.source || 'chat',
        currency: 'USD',
        stageEnteredAt: now,
        qualificationScore: 0,
        isQualified: false,
        lastActivityAt: now,
        isStalled: false,
        createdAt: now,
        updatedAt: now,
      };

      if (isKV) {
        await (storage as KVNamespace).put(`${prefix}:${id}`, JSON.stringify(opportunity));
      } else {
        await (storage as DurableObjectStorage).put(`${prefix}:${id}`, opportunity);
      }

      return { success: true as const, data: opportunity };
    },

    async get(id: string) {
      if (isKV) {
        const data = await (storage as KVNamespace).get(`${prefix}:${id}`, 'json');
        if (!data) return null;
        const result = OpportunitySchema.safeParse(data);
        return result.success ? result.data : null;
      } else {
        const data = await (storage as DurableObjectStorage).get(`${prefix}:${id}`);
        if (!data) return null;
        const result = OpportunitySchema.safeParse(data);
        return result.success ? result.data : null;
      }
    },

    async update(id: string, updates: Partial<Opportunity>) {
      const existing = await this.get(id);
      if (!existing) {
        return { success: false as const, errors: { id: 'Opportunity not found' } };
      }

      const stageChanged = updates.stage && updates.stage !== existing.stage;
      const now = Date.now();

      const updated: Opportunity = {
        ...existing,
        ...updates,
        id,
        updatedAt: now,
        ...(stageChanged ? {
          previousStage: existing.stage,
          stageEnteredAt: now,
          probability: updates.probability ?? STAGE_CONFIG[updates.stage!].probability,
        } : {}),
        lastActivityAt: now,
      };

      const validation = validateSchema(OpportunitySchema, updated);
      if (!validation.success) {
        return { success: false as const, errors: validation.errors! };
      }

      if (isKV) {
        await (storage as KVNamespace).put(`${prefix}:${id}`, JSON.stringify(validation.data!));
      } else {
        await (storage as DurableObjectStorage).put(`${prefix}:${id}`, validation.data!);
      }

      return { success: true as const, data: validation.data! };
    },

    async delete(id: string) {
      if (isKV) {
        await (storage as KVNamespace).delete(`${prefix}:${id}`);
      } else {
        await (storage as DurableObjectStorage).delete(`${prefix}:${id}`);
      }
      return true;
    },

    async list(options = {}) {
      const { limit = 50, offset = 0 } = options;
      const opportunities: Opportunity[] = [];

      if (isKV) {
        const keys = await (storage as KVNamespace).list({ prefix: `${prefix}:`, limit: limit + offset });
        const keysToFetch = keys.keys.slice(offset, offset + limit);
        for (const key of keysToFetch) {
          const data = await (storage as KVNamespace).get(key.name, 'json');
          if (data) {
            const result = OpportunitySchema.safeParse(data);
            if (result.success) opportunities.push(result.data);
          }
        }
      } else {
        const map = await (storage as DurableObjectStorage).list({ prefix: `${prefix}:` });
        let index = 0;
        for (const [, value] of map) {
          if (index >= offset && opportunities.length < limit) {
            const result = OpportunitySchema.safeParse(value);
            if (result.success) opportunities.push(result.data);
          }
          index++;
        }
      }
      return opportunities;
    },

    async search(query: string) {
      const all = await this.list({ limit: 1000 });
      const q = query.toLowerCase();
      return all.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.contactName?.toLowerCase().includes(q) ||
        o.company?.toLowerCase().includes(q)
      );
    },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

export type StoreType = 'contact' | 'opportunity';

export function getEntityStore(
  type: StoreType,
  storage: DurableObjectStorage | KVNamespace,
  orgId: string
) {
  switch (type) {
    case 'contact':
      return createContactStore(storage, orgId);
    case 'opportunity':
      return createOpportunityStore(storage, orgId);
    default:
      throw new Error(`Unknown entity type: ${type}`);
  }
}
