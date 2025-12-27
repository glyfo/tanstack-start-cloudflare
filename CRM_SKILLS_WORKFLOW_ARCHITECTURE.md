# CRM Skills & Workflow Architecture - Comprehensive Multi-Entity Support

## Overview

This document defines the architecture for extending the existing **Contact-based workflow skill pattern** to support all new CRM entities (Account, Product, Order, Landing Page, etc.) through a unified Chat UI conversation model.

---

## 1. Architecture Principles

### Core Pattern: Skill-Based Entity Management

Every CRM entity follows the same pattern:

1. **Entity Skill** - Handles CRUD operations conversationally
2. **Repository** - Data access layer with type safety
3. **Types** - Field registry, validation schemas
4. **Handlers** - Generic CRUD operations
5. **Workflows** - Multi-step conversational flows

### Conversation Model

All interactions flow through the Chat UI:

```
User Message → Intent Router → Skill Selection → Workflow Execution → Response
```

---

## 2. New Skill Structure

### Skills Organization

```
src/server/skills/workflows/
├── contact/              # ✅ Existing (reference)
├── tag/                  # ✅ Existing (reference)
├── group/                # ✅ Existing (reference)
├── interaction/          # ✅ Existing (reference)
│
├── account/              # 🆕 Company/Account management
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   ├── schemas.ts
│   └── index.ts
│
├── product/              # 🆕 Store product management
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   ├── schemas.ts
│   └── index.ts
│
├── order/                # 🆕 Order management
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   ├── schemas.ts
│   └── index.ts
│
├── landing-page/         # 🆕 Landing page & form management
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   ├── schemas.ts
│   └── index.ts
│
├── coupon/               # 🆕 Discount coupon management
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   └── index.ts
│
├── opportunity/          # ✅ Existing (expand for Account relationship)
│   ├── skill.ts
│   ├── handlers.ts
│   ├── types.ts
│   └── index.ts
│
└── pipeline/             # 🆕 Sales pipeline & stage management
    ├── skill.ts
    ├── handlers.ts
    ├── types.ts
    ├── schemas.ts
    └── index.ts
```

---

## 3. Improved Unified Entity Skill Pattern - DRY Architecture

### Abstract Base Class for All Entity Skills

**Create a reusable base that eliminates duplication:**

```typescript
// base/generic-entity-skill.ts - REUSABLE FOR ALL ENTITIES

import {
  BaseSkill,
  SkillMetadata,
  SkillResult,
  SkillContext,
} from "@/server/skills/base";
import { IEntityRepository } from "@/server/skills/base";

export interface EntityField<T> {
  name: keyof T;
  label: string;
  type:
    | "text"
    | "number"
    | "currency"
    | "date"
    | "select"
    | "textarea"
    | "color"
    | "email"
    | "url"
    | "slider";
  required: boolean;
  placeholder?: string;
  validation?: (value: any) => boolean | Promise<boolean>;
  errorMessage?: string;
  options?: string[];
  min?: number;
  max?: number;
  default?: any;
}

export interface EntityConfig<T> {
  id: string;
  name: string;
  description: string;
  fields: EntityField<T>[];
  requiredFields: (keyof T)[];
  editableFields: (keyof T)[];
}

export interface CRUDInput {
  action: "create" | "read" | "update" | "delete" | "list" | "search";
  step?: number;
  data?: Partial<any>;
  userId: string;
  query?: string;
  page?: number;
  limit?: number;
  id?: string;
  confirmed?: boolean;
}

/**
 * Generic Entity CRUD Skill - Base for all entity skills
 * Eliminates duplication across Account, Product, Order, Opportunity, etc.
 */
export abstract class GenericEntityCRUDSkill<T> extends BaseSkill {
  abstract config: EntityConfig<T>;
  protected abstract repository: IEntityRepository<T>;

  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
    await this.initializeRepository(context);
  }

  protected abstract initializeRepository(context: SkillContext): Promise<void>;

  canHandle(input: any): boolean {
    if (!input || typeof input !== "object") return false;
    const { action } = input;
    return ["create", "read", "update", "delete", "list", "search"].includes(
      action
    );
  }

  async execute(input: CRUDInput): Promise<SkillResult> {
    const { action } = input;

    try {
      switch (action) {
        case "create":
          return await this.handleCreate(input);
        case "read":
          return await this.handleRead(input);
        case "update":
          return await this.handleUpdate(input);
        case "delete":
          return await this.handleDelete(input);
        case "list":
          return await this.handleList(input);
        case "search":
          return await this.handleSearch(input);
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ===== GENERIC HANDLERS - REUSED BY ALL SKILLS =====

  private async handleCreate(input: CRUDInput): Promise<SkillResult> {
    const { step = 0, data, userId, confirmed } = input;

    // Step 0: Start workflow
    if (step === 0) {
      const firstField = this.config.requiredFields[0];
      const field = this.config.fields.find((f) => f.name === firstField);
      return {
        success: true,
        message: `Let's create a new ${this.config.name}. ${field?.label}?`,
        workflow: {
          type: `${this.config.id}:create`,
          currentStep: 0,
          totalSteps: this.config.requiredFields.length + 1,
          progress: 0,
        },
      };
    }

    // Steps 1-N: Collect fields
    if (step < this.config.requiredFields.length) {
      const field = this.config.fields.find(
        (f) => f.name === this.config.requiredFields[step]
      );
      if (!field) {
        return { success: false, error: "Field not found" };
      }

      // Validate previous step if data provided
      if (data) {
        const validation = await this.validateField(field, data[field.name]);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error,
            workflow: {
              type: `${this.config.id}:create`,
              currentStep: step,
              totalSteps: this.config.requiredFields.length + 1,
              progress: (step / (this.config.requiredFields.length + 1)) * 100,
            },
          };
        }
      }

      const nextField = this.config.fields.find(
        (f) => f.name === this.config.requiredFields[step]
      );
      return {
        success: true,
        message: this.getFieldPrompt(nextField!),
        workflow: {
          type: `${this.config.id}:create`,
          currentStep: step,
          totalSteps: this.config.requiredFields.length + 1,
          progress: (step / (this.config.requiredFields.length + 1)) * 100,
        },
      };
    }

    // Confirmation step
    if (step === this.config.requiredFields.length && !confirmed) {
      return {
        success: true,
        message: this.formatForConfirmation(data),
        workflow: {
          type: `${this.config.id}:create`,
          currentStep: step,
          totalSteps: this.config.requiredFields.length + 1,
          pendingConfirmation: true,
          progress: 95,
        },
      };
    }

    // Execute creation
    if (confirmed) {
      const result = await this.repository.create(data as T, userId);
      return {
        success: true,
        data: result,
        message: `✓ ${this.config.name} created successfully!`,
        workflow: { progress: 100 },
      };
    }

    return { success: false, error: "Invalid create workflow state" };
  }

  private async handleRead(input: CRUDInput): Promise<SkillResult> {
    const { id, userId } = input;
    if (!id) {
      return { success: false, error: `${this.config.name} ID required` };
    }

    const result = await this.repository.read(id, userId);
    if (!result) {
      return {
        success: false,
        error: `${this.config.name} not found`,
      };
    }

    return {
      success: true,
      data: result,
      message: this.formatDetailed(result),
    };
  }

  private async handleUpdate(input: CRUDInput): Promise<SkillResult> {
    const { id, userId, data } = input;
    if (!id) {
      return { success: false, error: `${this.config.name} ID required` };
    }
    if (!data) {
      return { success: false, error: "Update data required" };
    }

    const result = await this.repository.update(id, userId, data);
    return {
      success: true,
      data: result,
      message: `✓ ${this.config.name} updated successfully!`,
    };
  }

  private async handleDelete(input: CRUDInput): Promise<SkillResult> {
    const { id, userId } = input;
    if (!id) {
      return { success: false, error: `${this.config.name} ID required` };
    }

    const success = await this.repository.delete(id, userId);
    if (!success) {
      return { success: false, error: `Failed to delete ${this.config.name}` };
    }

    return {
      success: true,
      message: `✓ ${this.config.name} deleted successfully!`,
    };
  }

  private async handleList(input: CRUDInput): Promise<SkillResult> {
    const { userId, page = 1, limit = 20 } = input;

    const results = await this.repository.list(userId, page, limit);
    return {
      success: true,
      data: results,
      message: this.formatList(results),
    };
  }

  private async handleSearch(input: CRUDInput): Promise<SkillResult> {
    const { userId, query } = input;
    if (!query) {
      return { success: false, error: "Search query required" };
    }

    const results = await this.repository.search(userId, query);
    return {
      success: true,
      data: results,
      message:
        results.length === 0
          ? `No ${this.config.name.toLowerCase()}s found`
          : this.formatList(results),
    };
  }

  // ===== UTILITY METHODS - OVERRIDE FOR CUSTOMIZATION =====

  protected async validateField(
    field: EntityField<T>,
    value: any
  ): Promise<{ valid: boolean; error?: string }> {
    if (field.required && !value) {
      return { valid: false, error: `${field.label} is required` };
    }

    if (field.validation) {
      const isValid = await field.validation(value);
      if (!isValid) {
        return { valid: false, error: field.errorMessage || "Invalid value" };
      }
    }

    return { valid: true };
  }

  protected getFieldPrompt(field: EntityField<T>): string {
    if (field.options) {
      return `${field.label}? [${field.options.join(", ")}]`;
    }
    if (field.type === "slider") {
      return `${field.label} (${field.min}-${field.max})?`;
    }
    return `${field.label}?`;
  }

  protected formatForConfirmation(data: any): string {
    const entries = Object.entries(data)
      .filter(([key]) => this.config.requiredFields.includes(key as keyof T))
      .map(([key, value]) => {
        const field = this.config.fields.find((f) => f.name === key);
        return `${field?.label}: ${value}`;
      });

    return `Summary:\n${entries.join("\n")}\n\nConfirm? (yes/no)`;
  }

  protected formatDetailed(entity: T): string {
    const entries = Object.entries(entity)
      .map(([key, value]) => {
        const field = this.config.fields.find((f) => f.name === key);
        return field ? `**${field.label}:** ${value}` : null;
      })
      .filter(Boolean);

    return entries.join("\n");
  }

  protected formatList(items: T[]): string {
    if (items.length === 0) {
      return `No ${this.config.name.toLowerCase()}s found`;
    }

    const list = items
      .map((item, idx) => `${idx + 1}. ${this.formatListItem(item)}`)
      .join("\n");

    return `Found ${items.length} ${this.config.name.toLowerCase()}s:\n${list}`;
  }

  protected formatListItem(item: T): string {
    // Override in subclasses for custom formatting
    return JSON.stringify(item);
  }
}
```

---

## 4. Improved Repository Pattern - Centralized Data Access

### Base Repository Interface & Shared Utilities

```typescript
// base/generic-repository.ts - REUSABLE FOR ALL ENTITIES

import type { PrismaClient } from "@prisma/client";

export interface IEntityRepository<T> {
  create(data: T, userId: string): Promise<T>;
  read(id: string, userId: string): Promise<T | null>;
  update(id: string, userId: string, data: Partial<T>): Promise<T>;
  delete(id: string, userId: string): Promise<boolean>;
  list(userId: string, page: number, limit: number): Promise<T[]>;
  search(userId: string, query: string): Promise<T[]>;
}

/**
 * Abstract Base Repository - Eliminates duplication across all repositories
 * Implements common CRUD operations, error handling, validation
 */
export abstract class GenericRepository<T> implements IEntityRepository<T> {
  protected prisma: PrismaClient;
  protected modelName: string; // e.g., "account", "product"

  constructor(prisma: PrismaClient, modelName: string) {
    this.prisma = prisma;
    this.modelName = modelName;
  }

  abstract validateCreate(
    data: Partial<T>
  ): Promise<{ valid: boolean; errors?: string[] }>;
  abstract validateUpdate(
    id: string,
    data: Partial<T>
  ): Promise<{ valid: boolean; errors?: string[] }>;

  async create(data: T, userId: string): Promise<T> {
    const validation = await this.validateCreate(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors?.join(", ")}`);
    }

    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.create({
      data: { ...data, userId, createdAt: new Date() },
    });
  }

  async read(id: string, userId: string): Promise<T | null> {
    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.findFirst({
      where: { id, userId },
    });
  }

  async update(id: string, userId: string, data: Partial<T>): Promise<T> {
    const validation = await this.validateUpdate(id, data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors?.join(", ")}`);
    }

    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const model = this.prisma[this.modelName as keyof PrismaClient];
    const result = await model.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async list(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<T[]> {
    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.findMany({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  abstract search(userId: string, query: string): Promise<T[]>;

  // Utility methods for common patterns
  protected buildSearchFilter(query: string, searchFields: (keyof T)[]): any {
    return {
      OR: searchFields.map((field) => ({
        [field]: { contains: query, mode: "insensitive" },
      })),
    };
  }

  protected async findByUnique(
    where: Record<string, any>,
    userId: string
  ): Promise<T | null> {
    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.findFirst({
      where: { ...where, userId },
    });
  }

  protected async findMany(
    where: Record<string, any>,
    userId: string
  ): Promise<T[]> {
    const model = this.prisma[this.modelName as keyof PrismaClient];
    return model.findMany({
      where: { ...where, userId },
    });
  }
}
```

---

### Account Repository - Focused Implementation

```typescript
// account-repository.ts

import { Account } from "@prisma/client";
import { GenericRepository } from "@/server/db/base/generic-repository";

export class AccountRepository extends GenericRepository<Account> {
  constructor(prisma: PrismaClient) {
    super(prisma, "account");
  }

  async validateCreate(
    data: Partial<Account>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!data.name || data.name.length < 2) {
      errors.push("Account name must be at least 2 characters");
    }
    if (data.website && !/^https?:\/\/.+/.test(data.website)) {
      errors.push("Invalid website URL");
    }

    // Check for duplicates
    const exists = await this.findByUnique({ name: data.name }, data.userId!);
    if (exists) {
      errors.push("Account with this name already exists");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async validateUpdate(
    id: string,
    data: Partial<Account>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    return this.validateCreate({ ...data, userId: "" }); // Reuse create validation
  }

  async search(userId: string, query: string): Promise<Account[]> {
    const searchFilter = this.buildSearchFilter(query, [
      "name",
      "industry",
      "website",
    ]);
    return this.findMany(searchFilter, userId);
  }

  // Specific methods only
  async findByWebsite(
    website: string,
    userId: string
  ): Promise<Account | null> {
    return this.findByUnique({ website }, userId);
  }

  async getAccountWithContacts(
    accountId: string,
    userId: string
  ): Promise<Account & { contacts: any[] }> {
    return this.prisma.account.findFirst({
      where: { id: accountId, userId },
      include: { contacts: true },
    });
  }
}
```

---

### Pipeline Repository - Smart Implementation

```typescript
// pipeline-repository.ts

import { PipelineStage, Opportunity } from "@prisma/client";
import { GenericRepository } from "@/server/db/base/generic-repository";

export class PipelineRepository extends GenericRepository<PipelineStage> {
  constructor(prisma: PrismaClient) {
    super(prisma, "pipelineStage");
  }

  async validateCreate(
    data: Partial<PipelineStage>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!data.name || data.name.length === 0) {
      errors.push("Stage name is required");
    }
    if (typeof data.order !== "number" || data.order < 0) {
      errors.push("Stage order must be a valid number");
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async validateUpdate(
    id: string,
    data: Partial<PipelineStage>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    return this.validateCreate(data);
  }

  async search(userId: string, query: string): Promise<PipelineStage[]> {
    const searchFilter = this.buildSearchFilter(query, ["name", "description"]);
    return this.findMany(searchFilter, userId);
  }

  // Pipeline-specific methods
  async getAll(userId: string): Promise<PipelineStage[]> {
    return this.prisma.pipelineStage.findMany({
      where: { userId },
      orderBy: { order: "asc" },
    });
  }

  async updateOrder(
    userId: string,
    stageUpdates: Array<{ id: string; order: number }>
  ): Promise<PipelineStage[]> {
    // Batch update orders
    await Promise.all(
      stageUpdates.map((update) =>
        this.prisma.pipelineStage.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );
    return this.getAll(userId);
  }

  async getStageMetrics(userId: string, stageId: string): Promise<any> {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, userId },
    });

    if (!stage) throw new Error("Stage not found");

    const opportunities = await this.prisma.opportunity.findMany({
      where: { stageId },
    });

    return {
      stageId,
      stageName: stage.name,
      opportunityCount: opportunities.length,
      totalValue: opportunities.reduce((sum, opp) => sum + (opp.value || 0), 0),
      avgProbability: opportunities.length
        ? opportunities.reduce((sum, opp) => sum + (opp.probability || 0), 0) /
          opportunities.length
        : 0,
    };
  }
}
```

---

### Opportunity Repository - Advanced Queries

```typescript
// opportunity-repository.ts

import { Opportunity } from "@prisma/client";
import { GenericRepository } from "@/server/db/base/generic-repository";

export class OpportunityRepository extends GenericRepository<Opportunity> {
  constructor(prisma: PrismaClient) {
    super(prisma, "opportunity");
  }

  async validateCreate(
    data: Partial<Opportunity>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!data.name) errors.push("Deal name is required");
    if (!data.value || data.value <= 0) errors.push("Deal value must be > 0");
    if (!data.stageId) errors.push("Pipeline stage is required");

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async validateUpdate(
    id: string,
    data: Partial<Opportunity>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    if (data.value && data.value <= 0) {
      return { valid: false, errors: ["Deal value must be > 0"] };
    }
    return { valid: true };
  }

  async search(userId: string, query: string): Promise<Opportunity[]> {
    const searchFilter = this.buildSearchFilter(query, ["name"]);
    return this.findMany({ ...searchFilter, contact: { userId } }, userId);
  }

  // Advanced opportunity operations
  async moveToStage(
    opportunityId: string,
    newStageId: string,
    reason?: string
  ): Promise<Opportunity> {
    const opportunity = await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { stageId: newStageId },
    });

    // Create history entry
    await this.prisma.opportunityHistory.create({
      data: {
        opportunityId,
        action: "stage_changed",
        previousValue: opportunity.stageId,
        newValue: newStageId,
        reason,
        timestamp: new Date(),
      },
    });

    return opportunity;
  }

  async updateProbability(
    opportunityId: string,
    newProbability: number,
    reason?: string
  ): Promise<Opportunity> {
    const opportunity = await this.prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunityId },
    });

    const updated = await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: { probability: newProbability },
    });

    // Audit trail
    await this.prisma.opportunityHistory.create({
      data: {
        opportunityId,
        action: "probability_updated",
        previousValue: opportunity.probability?.toString() || "0",
        newValue: newProbability.toString(),
        reason,
        timestamp: new Date(),
      },
    });

    return updated;
  }

  async close(
    opportunityId: string,
    status: "won" | "lost",
    reason?: string
  ): Promise<Opportunity> {
    const opportunity = await this.prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: status === "won" ? "won" : "lost",
        closedDate: new Date(),
        lostReason: status === "lost" ? reason : null,
      },
    });

    await this.prisma.opportunityHistory.create({
      data: {
        opportunityId,
        action: `deal_${status}`,
        newValue: status,
        reason,
        timestamp: new Date(),
      },
    });

    return opportunity;
  }

  async getPipelineAnalytics(userId: string): Promise<any> {
    const opportunities = await this.prisma.opportunity.findMany({
      where: { contact: { userId } },
      include: { stage: true },
    });

    const byStage = opportunities.reduce((acc, opp) => {
      const stage = acc.find((s) => s.stageId === opp.stageId);
      if (stage) {
        stage.count += 1;
        stage.value += opp.value || 0;
      } else {
        acc.push({
          stageId: opp.stageId,
          stageName: opp.stage?.name || "Unknown",
          count: 1,
          value: opp.value || 0,
        });
      }
      return acc;
    }, [] as any[]);

    const totalValue = opportunities.reduce(
      (sum, opp) => sum + (opp.value || 0),
      0
    );
    const weightedValue = opportunities.reduce(
      (sum, opp) => sum + ((opp.value || 0) * (opp.probability || 0)) / 100,
      0
    );

    return {
      totalValue,
      weightedValue,
      opportunityCount: opportunities.length,
      byStage,
    };
  }

  async searchByContact(
    userId: string,
    contactId: string
  ): Promise<Opportunity[]> {
    return this.findMany({ contactId }, userId);
  }

  async searchByAccount(
    userId: string,
    accountId: string
  ): Promise<Opportunity[]> {
    return this.prisma.opportunity.findMany({
      where: { contact: { accountId, userId } },
    });
  }

  async getWithRelations(opportunityId: string, userId: string): Promise<any> {
    return this.prisma.opportunity.findFirst({
      where: { id: opportunityId, contact: { userId } },
      include: {
        stage: true,
        contact: true,
        lineItems: { include: { product: true } },
        history: true,
      },
    });
  }
}
```

---

### Account Skill - Minimal Implementation

```typescript
// account/skill.ts - CLEAN & FOCUSED

import { SkillMetadata, SkillContext } from "@/server/skills/base";
import {
  GenericEntityCRUDSkill,
  EntityConfig,
  EntityField,
} from "@/server/skills/base/generic-entity-skill";
import { Account } from "@/server/skills/workflows/account/types";
import { AccountRepository } from "@/server/db/account-repository";

export class AccountCRUDSkill extends GenericEntityCRUDSkill<Account> {
  metadata: SkillMetadata = {
    id: "workflow:account-crud",
    name: "Account Management",
    description: "Create, read, update, delete accounts conversationally",
    version: "1.0.0",
    category: "workflow",
    tags: ["account", "company", "crm", "crud"],
  };

  // Configuration - single source of truth
  config: EntityConfig<Account> = {
    id: "account",
    name: "Account",
    description: "Company/organization account",
    fields: [
      {
        name: "name",
        label: "Company Name",
        type: "text",
        required: true,
        placeholder: "e.g., Acme Corp",
        validation: (value) =>
          value && value.length >= 2 && value.length <= 100,
        errorMessage: "Company name must be 2-100 characters",
      },
      {
        name: "industry",
        label: "Industry",
        type: "select",
        required: false,
        options: [
          "Technology",
          "Finance",
          "Healthcare",
          "Retail",
          "Manufacturing",
          "Other",
        ],
      },
      {
        name: "annualRevenue",
        label: "Annual Revenue",
        type: "currency",
        required: false,
      },
      {
        name: "numberOfEmployees",
        label: "Number of Employees",
        type: "number",
        required: false,
      },
      {
        name: "website",
        label: "Website",
        type: "url",
        required: false,
        validation: (value) => !value || /^https?:\/\/.+/.test(value),
        errorMessage: "Invalid URL format",
      },
      {
        name: "phone",
        label: "Phone",
        type: "text",
        required: false,
      },
    ],
    requiredFields: ["name"],
    editableFields: [
      "name",
      "industry",
      "annualRevenue",
      "numberOfEmployees",
      "website",
      "phone",
    ],
  };

  protected repository!: AccountRepository;

  protected async initializeRepository(context: SkillContext): Promise<void> {
    this.repository = new AccountRepository(context.env);
  }

  // Only override if custom behavior needed
  protected formatListItem(item: Account): string {
    return `${item.name}${item.industry ? ` (${item.industry})` : ""}`;
  }
}
```

---

### Product Skill - Clean Implementation

```typescript
// product/skill.ts

import { SkillMetadata, SkillContext } from "@/server/skills/base";
import {
  GenericEntityCRUDSkill,
  EntityConfig,
} from "@/server/skills/base/generic-entity-skill";
import { Product } from "@/server/skills/workflows/product/types";
import { ProductRepository } from "@/server/db/product-repository";

export class ProductCRUDSkill extends GenericEntityCRUDSkill<Product> {
  metadata: SkillMetadata = {
    id: "workflow:product-crud",
    name: "Product Management",
    description: "Manage products, inventory, and pricing",
    version: "1.0.0",
    category: "workflow",
    tags: ["product", "ecommerce", "inventory"],
  };

  config: EntityConfig<Product> = {
    id: "product",
    name: "Product",
    description: "Storable product/service",
    fields: [
      {
        name: "name",
        label: "Product Name",
        type: "text",
        required: true,
        validation: (value) => value && value.length >= 2,
      },
      {
        name: "sku",
        label: "SKU",
        type: "text",
        required: true,
        validation: async (value) => {
          // Check uniqueness via repository
          return !(await this.repository.findBySku(value));
        },
        errorMessage: "SKU already exists",
      },
      {
        name: "price",
        label: "Price",
        type: "currency",
        required: true,
      },
      {
        name: "quantity",
        label: "Initial Quantity",
        type: "number",
        required: false,
        default: 0,
      },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        required: false,
      },
    ],
    requiredFields: ["name", "sku", "price"],
    editableFields: ["name", "price", "quantity", "categoryId"],
  };

  protected repository!: ProductRepository;

  protected async initializeRepository(context: SkillContext): Promise<void> {
    this.repository = new ProductRepository(context.env);
  }

  protected formatListItem(item: Product): string {
    return `${item.name} (SKU: ${item.sku}) - $${item.price} [${item.quantity} in stock]`;
  }
}
```

---

### Order & Opportunity Skills - Same Pattern

All remaining skills (Order, Pipeline, Opportunity, etc.) follow the **exact same structure**:

```typescript
// order/skill.ts, opportunity/skill.ts, pipeline/skill.ts - IDENTICAL PATTERN

export class [Entity]CRUDSkill extends GenericEntityCRUDSkill<[Entity]> {
  metadata: SkillMetadata = { /* unique metadata */ };
  config: EntityConfig<[Entity]> = { /* unique config */ };
  protected repository!: [Entity]Repository;
  protected async initializeRepository(context: SkillContext): Promise<void> {
    this.repository = new [Entity]Repository(context.env);
  }
  protected formatListItem(item: [Entity]): string {
    // Custom formatting only
  }
}
```

**Result:** Each skill is ~30 lines, all CRUD logic is centralized, no duplication.

---

## 5. Reusable Utilities & Validators - DRY Shared Code

### Validation Utility Layer

```typescript
// utils/validators.ts - Centralized validation functions

export const CommonValidators = {
  isValidEmail: (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  isValidUrl: (url: string): boolean => {
    return /^https?:\/\/.+/.test(url);
  },

  isValidPhone: (phone: string): boolean => {
    return /^\d{10,15}$/.test(phone.replace(/\D/g, ""));
  },

  isRequired: (value: any): boolean => {
    return value !== null && value !== undefined && value !== "";
  },

  isValidLength: (value: string, min: number, max: number): boolean => {
    return value && value.length >= min && value.length <= max;
  },

  isInRange: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  },

  isValidCurrency: (value: number): boolean => {
    return value > 0 && Number.isFinite(value);
  },

  isValidDate: (date: Date | string): boolean => {
    return !isNaN(new Date(date).getTime());
  },

  isUnique: async (
    repository: any,
    field: string,
    value: string,
    userId: string
  ): Promise<boolean> => {
    const existing = await repository.findByUnique({ [field]: value }, userId);
    return !existing;
  },
};
```

---

### Formatting Utility Layer

```typescript
// utils/formatters.ts - Consistent formatting across all skills

export const CommonFormatters = {
  currency: (value: number, symbol: string = "$"): string => {
    return `${symbol}${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  },

  date: (date: Date | string): string => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  percentage: (value: number): string => {
    return `${Math.round(value)}%`;
  },

  list: (items: string[], numbered: boolean = true): string => {
    return items
      .map((item, idx) => (numbered ? `${idx + 1}. ${item}` : `• ${item}`))
      .join("\n");
  },

  summary: (fields: Record<string, any>): string => {
    return Object.entries(fields)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `**${key}:** ${value}`)
      .join("\n");
  },

  confirmation: (summary: string): string => {
    return `${summary}\n\nConfirm? (yes/no)`;
  },

  success: (entityName: string, action: string = "created"): string => {
    return `✓ ${entityName} ${action} successfully!`;
  },

  error: (message: string): string => {
    return `❌ Error: ${message}`;
  },
};
```

---

### Response Builder - Unified Message Construction

```typescript
// utils/response-builder.ts - DRY response creation

export class ResponseBuilder {
  static success(message: string, data?: any, workflow?: any) {
    return { success: true, message, data, workflow };
  }

  static error(message: string) {
    return { success: false, error: message };
  }

  static workflowStep(
    message: string,
    workflowType: string,
    currentStep: number,
    totalSteps: number,
    data?: any
  ) {
    return {
      success: true,
      message,
      workflow: {
        type: workflowType,
        currentStep,
        totalSteps,
        progress: (currentStep / totalSteps) * 100,
        pendingConfirmation: false,
      },
      data,
    };
  }

  static confirmation(message: string, data?: any) {
    return {
      success: true,
      message,
      workflow: { pendingConfirmation: true, progress: 95 },
      data,
    };
  }

  static list(items: string[], count: number) {
    return {
      success: true,
      message: `Found ${count} item${count !== 1 ? "s" : ""}:\n${CommonFormatters.list(items)}`,
      count,
    };
  }
}
```

---

**Route Entity-Specific Intents:**

```typescript
// intent-router.ts - Enhanced routing
const SKILL_ROUTING: Record<string, string> = {
  // Contact intents
  "contact:create": "workflow:contact-crud",
  "contact:update": "workflow:contact-crud",
  "contact:list": "workflow:contact-crud",

  // Account intents
  "account:create": "workflow:account-crud",
  "account:update": "workflow:account-crud",
  "account:list": "workflow:account-crud",

  // Product intents
  "product:create": "workflow:product-crud",
  "product:search": "workflow:product-crud",
  "product:update_inventory": "workflow:product-crud",

  // Order intents
  "order:create": "workflow:order-crud",
  "order:list": "workflow:order-crud",
  "order:update_status": "workflow:order-crud",

  // Landing page intents
  "landing_page:create": "workflow:landing-page-crud",
  "landing_page:publish": "workflow:landing-page-crud",
  "form:create": "workflow:form-crud",

  // Pipeline intents (NEW)
  "pipeline:create_stage": "workflow:pipeline",
  "pipeline:update_stage": "workflow:pipeline",
  "pipeline:view": "workflow:pipeline",
  "pipeline:view_analytics": "workflow:pipeline",

  // Opportunity intents (enhanced)
  "opportunity:create": "workflow:opportunity-crud",
  "opportunity:update": "workflow:opportunity-crud",
  "opportunity:move": "workflow:opportunity-crud",
  "opportunity:update_probability": "workflow:opportunity-crud",
  "opportunity:close": "workflow:opportunity-crud",
  "opportunity:view_pipeline": "workflow:opportunity-crud",
  "opportunity:view_analytics": "workflow:opportunity-crud",
  "opportunity:add_products": "workflow:opportunity-crud",

  // Coupon intents
  "coupon:create": "workflow:coupon-crud",
  "coupon:apply": "workflow:coupon-crud",
};

// Natural language detection
function detectIntent(userMessage: string): string {
  const normalizedMsg = userMessage.toLowerCase();

  // Account detection
  if (/(create|add|new).*(account|company)/.test(normalizedMsg)) {
    return "account:create";
  }
  if (/(show|list|find).*(accounts|companies)/.test(normalizedMsg)) {
    return "account:list";
  }

  // Product detection
  if (/(create|add|new).*(product|item)/.test(normalizedMsg)) {
    return "product:create";
  }
  if (/(search|find|show).*(products?)/.test(normalizedMsg)) {
    return "product:search";
  }

  // Order detection
  if (/(create|new|place).*(order|sale)/.test(normalizedMsg)) {
    return "order:create";
  }
  if (/(show|list|view).*(orders|sales)/.test(normalizedMsg)) {
    return "order:list";
  }

  // Landing page detection
  if (/(create|new).*(landing page|page)/.test(normalizedMsg)) {
    return "landing_page:create";
  }

  // Pipeline detection (NEW)
  if (/(create|add|new).*(stage|pipeline)/.test(normalizedMsg)) {
    return "pipeline:create_stage";
  }
  if (/(view|show|list).*(pipeline|stages)/.test(normalizedMsg)) {
    return "pipeline:view";
  }
  if (/(analytics|report|stats).*(pipeline|sales|deals)/.test(normalizedMsg)) {
    return "pipeline:view_analytics";
  }

  // Opportunity detection
  if (/(create|new).*(opportunity|deal)/.test(normalizedMsg)) {
    return "opportunity:create";
  }
  if (
    /(move|progress|update|change).*(opportunity|deal|stage)/.test(
      normalizedMsg
    )
  ) {
    return "opportunity:move";
  }
  if (/(update|change).*(probability|confidence|win)/.test(normalizedMsg)) {
    return "opportunity:update_probability";
  }
  if (/(close|won|lost).*(deal|opportunity)/.test(normalizedMsg)) {
    return "opportunity:close";
  }
  if (/(view|show).*(pipeline|deals|opportunities)/.test(normalizedMsg)) {
    return "opportunity:view_pipeline";
  }
  if (
    /(pipeline|sales).*(analytics|report|stats|forecast)/.test(normalizedMsg)
  ) {
    return "opportunity:view_analytics";
  }
  if (
    /(add|link|attach).*(product|service).*(deal|opportunity)/.test(
      normalizedMsg
    )
  ) {
    return "opportunity:add_products";
  }

  // Default
  return "unknown";
}
```

---

## 6. Repository Pattern for All Entities

**Base Repository Interface:**

```typescript
// entity-repository.interface.ts (extend existing)
export interface IEntityRepository<T> {
  create(data: T, userId: string): Promise<T>;
  read(id: string, userId: string): Promise<T | null>;
  update(id: string, userId: string, data: Partial<T>): Promise<T>;
  delete(id: string, userId: string): Promise<boolean>;
  list(userId: string, page: number, limit: number): Promise<T[]>;
  search(userId: string, query: string): Promise<T[]>;
}

// account-repository.ts (example)
export class AccountRepository implements IEntityRepository<Account> {
  async create(data: Account, userId: string): Promise<Account> {
    // Prisma create with validation
  }

  async search(userId: string, query: string): Promise<Account[]> {
    // Search by name, industry, etc.
  }
}

// product-repository.ts (example)
export class ProductRepository implements IEntityRepository<Product> {
  async search(userId: string, query: string): Promise<Product[]> {
    // Full-text search by name, SKU, description
  }

  async searchByCategory(
    userId: string,
    categoryId: string
  ): Promise<Product[]> {
    // Category-specific search
  }

  async updateInventory(id: string, quantity: number): Promise<Product> {
    // Update inventory + trigger alerts if below threshold
  }
}

// pipeline-repository.ts (NEW)
export class PipelineRepository implements IEntityRepository<PipelineStage> {
  async create(data: PipelineStage, userId: string): Promise<PipelineStage> {
    // Create pipeline stage + reorder if needed
  }

  async getAll(userId: string): Promise<PipelineStage[]> {
    // Get all stages ordered by stage order
  }

  async updateOrder(
    userId: string,
    stageUpdates: Array<{ id: string; order: number }>
  ): Promise<PipelineStage[]> {
    // Reorder stages
  }

  async getStageMetrics(
    userId: string,
    stageId: string
  ): Promise<{
    stageId: string;
    opportunityCount: number;
    totalValue: number;
    avgProbability: number;
  }> {
    // Pipeline analytics for a stage
  }
}

// opportunity-repository.ts (ENHANCED)
export class OpportunityRepository implements IEntityRepository<Opportunity> {
  async create(data: Opportunity, userId: string): Promise<Opportunity> {
    // Create opportunity + initial history entry
  }

  async updateStage(
    id: string,
    newStageId: string,
    reason?: string
  ): Promise<Opportunity> {
    // Move opportunity to new stage + create history
  }

  async updateProbability(
    id: string,
    newProbability: number,
    reason?: string
  ): Promise<Opportunity> {
    // Update probability + audit trail
  }

  async close(
    id: string,
    status: "won" | "lost",
    reason?: string
  ): Promise<Opportunity> {
    // Close opportunity + final history entry
  }

  async getPipelineAnalytics(userId: string): Promise<{
    totalValue: number;
    weightedValue: number;
    byStage: Array<{
      stageId: string;
      stageName: string;
      count: number;
      value: number;
    }>;
    byProbability: Array<{
      range: string;
      count: number;
      value: number;
    }>;
  }> {
    // Comprehensive pipeline analytics
  }

  async searchByContact(
    userId: string,
    contactId: string
  ): Promise<Opportunity[]> {
    // Get all opportunities for a contact
  }

  async searchByAccount(
    userId: string,
    accountId: string
  ): Promise<Opportunity[]> {
    // Get all opportunities for an account
  }

  async getWithRelations(
    id: string,
    userId: string
  ): Promise<OpportunityWithRelations> {
    // Get opportunity with stage, contact, account, and line items
  }
}
```

---

## 6. Improved Configuration & Initialization - DRY Bootstrap

### Centralized Skill Registry

```typescript
// skills/registry.ts - Single source of truth for all skills

import { BaseSkill } from "@/server/skills/base";
import { AccountCRUDSkill } from "@/server/skills/workflows/account/skill";
import { ProductCRUDSkill } from "@/server/skills/workflows/product/skill";
import { OrderCRUDSkill } from "@/server/skills/workflows/order/skill";
import { PipelineCRUDSkill } from "@/server/skills/workflows/pipeline/skill";
import { OpportunityCRUDSkill } from "@/server/skills/workflows/opportunity/skill";

export interface SkillConfig {
  id: string;
  name: string;
  skillClass: typeof BaseSkill;
  enabled: boolean;
  priority: number;
}

export const SKILLS_REGISTRY: SkillConfig[] = [
  {
    id: "workflow:account-crud",
    name: "Account Management",
    skillClass: AccountCRUDSkill,
    enabled: true,
    priority: 20,
  },
  {
    id: "workflow:product-crud",
    name: "Product Management",
    skillClass: ProductCRUDSkill,
    enabled: true,
    priority: 25,
  },
  {
    id: "workflow:pipeline",
    name: "Pipeline Management",
    skillClass: PipelineCRUDSkill,
    enabled: true,
    priority: 35,
  },
  {
    id: "workflow:opportunity-crud",
    name: "Opportunity Management",
    skillClass: OpportunityCRUDSkill,
    enabled: true,
    priority: 40,
  },
];

export async function initializeAllSkills(
  context: SkillContext
): Promise<BaseSkill[]> {
  return Promise.all(
    SKILLS_REGISTRY.filter((config) => config.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(async (config) => {
        const skill = new config.skillClass();
        await skill.initialize(context);
        return skill;
      })
  );
}
```

---

### Repository Factory Pattern

```typescript
// repositories/factory.ts - DRY repository initialization

import { PrismaClient } from "@prisma/client";
import { AccountRepository } from "./account-repository";
import { ProductRepository } from "./product-repository";
import { PipelineRepository } from "./pipeline-repository";
import { OpportunityRepository } from "./opportunity-repository";

export class RepositoryFactory {
  private static prisma: PrismaClient;

  static initialize(prisma: PrismaClient) {
    RepositoryFactory.prisma = prisma;
  }

  static account(): AccountRepository {
    return new AccountRepository(RepositoryFactory.prisma);
  }

  static product(): ProductRepository {
    return new ProductRepository(RepositoryFactory.prisma);
  }

  static pipeline(): PipelineRepository {
    return new PipelineRepository(RepositoryFactory.prisma);
  }

  static opportunity(): OpportunityRepository {
    return new OpportunityRepository(RepositoryFactory.prisma);
  }

  // Get any repository by name
  static getRepository(name: string): any {
    const repos: Record<string, () => any> = {
      account: () => this.account(),
      product: () => this.product(),
      pipeline: () => this.pipeline(),
      opportunity: () => this.opportunity(),
    };

    const repo = repos[name.toLowerCase()];
    if (!repo) throw new Error(`Repository not found: ${name}`);
    return repo();
  }
}
```

---

## 7. Chat UI Integration Points

### Message Type Support

```typescript
// message types for different entity operations
type MessageType =
  | "text" // Regular message
  | "form" // Multi-field form (workflow)
  | "confirmation" // Yes/No confirmation
  | "list" // Scrollable list (contacts, products, orders)
  | "details" // Detailed entity view
  | "success" // Success notification
  | "error" // Error message
  | "workflow_step"; // Current workflow step indicator;

interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;

  // For forms
  form?: {
    fields: FormField[];
    onSubmit: (data: any) => void;
  };

  // For lists
  list?: {
    items: Array<{ id: string; display: string }>;
    onSelect: (id: string) => void;
  };

  // For confirmations
  confirmation?: {
    onConfirm: () => void;
    onCancel: () => void;
  };

  // Workflow context
  workflow?: {
    type: string;
    step: number;
    totalSteps: number;
    progress: number; // 0-100
  };

  metadata?: Record<string, any>;
}
---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Create Account Skill + Repository
- [ ] Extend Intent Router
- [ ] Update Chat UI for Account operations

### Phase 2: E-Commerce (Week 3-4)

- [ ] Product Skill + Repository + Variant support
- [ ] ProductCategory management
- [ ] Order Skill + OrderItem management

### Phase 3: Landing Pages & Forms (Week 5)

- [ ] LandingPage Skill
- [ ] Form Builder Skill
- [ ] FormSubmission tracking + auto-contact-creation

### Phase 4: Pipeline & Opportunity Enhancement (Week 6-7)

- [ ] **Pipeline Stage Management Skill** (create, update, view stages)
- [ ] **Enhanced Opportunity Skill** with:
  - [ ] Account relationship support
  - [ ] OpportunityLineItem (products/services) support
  - [ ] Stage movement with history tracking
  - [ ] Probability management
  - [ ] Close deals (won/lost)
  - [ ] Pipeline analytics + forecasting
- [ ] Update Intent Router with pipeline/opportunity intents
- [ ] Chat UI enhancements for pipeline visualization

### Phase 5: Integration & Optimization (Week 8)

- [ ] Coupon Skill (discount management)
- [ ] Cross-entity workflows (e.g., "Create contact + account together")
- [ ] Form submission → auto-create contact → link to account
- [ ] Order creation from opportunity
- [ ] Advanced analytics/reporting skills

### Phase 6: Advanced Features (Week 9+)

- [ ] Email template management
- [ ] Document/attachment storage
- [ ] Engagement tracking (email opens/clicks)
- [ ] Activity timeline visualization
- [ ] Multi-user assignment and team workflows
- [ ] Bulk operations (import, export, bulk update)

---

## 9. Example: Unified Conversation Flow

```

User: "Create a new sales deal"
Bot: "Let's set up a new opportunity! Contact name?"
User: "John Smith"
Bot: "Found 'John Smith' at 'Acme Corp'. Correct? (yes/no)"
User: "yes"
Bot: "Great! Deal name?"
User: "Acme - Q1 2026"
Bot: "Expected value?"
User: "$50,000"
Bot: "Win probability (0-100)?"
User: "70"
Bot: "Add products to this deal? (yes/no)"
User: "yes"
Bot: "Which product?" [Search products by name/SKU]
User: "Premium Package"
Bot: "Quantity?"
User: "1"
Bot: "Add more? (yes/no)"
User: "no"
Bot: "Summary: Acme - Q1 2026, John Smith, $50K, 70% probability, 1x Premium Package. Confirm? (yes/no)"
User: "yes"
Bot: "✓ Opportunity created! Moved to Prospecting stage."

```

---

## 10. Complete Pipeline Management Example

**Setup Pipeline:**
```

User: "Show me the pipeline"
Bot: [Displays current stages with counts] 1. 🔴 Prospecting (5 deals, $75K) 2. 🟡 Qualification (3 deals, $50K) 3. 🟠 Proposal (2 deals, $25K) 4. 🟢 Negotiation (1 deal, $10K) 5. ✅ Closed Won (10 deals, $500K)

User: "Add a new stage"
Bot: "Stage name?"
User: "Discovery"
Bot: "Position? (1=first)"
User: "1"
Bot: "Color?"
User: "blue"
Bot: "✓ Stage 'Discovery' added at position 1"

User: "Move Acme deal to Proposal"
Bot: "Current stage: Qualification → Proposal"
Bot: "Reason?"
User: "Sent proposal yesterday"
Bot: "✓ Moved! Acme now in Proposal stage"
Bot: "Create activity entry? (yes/no)"
User: "yes"
→ Creates OpportunityHistory + Activity record

User: "Show pipeline analytics"
Bot: [Comprehensive dashboard]
Pipeline Summary:
Total Value: $660,000
Weighted (by probability): $420,000
Average Deal Size: $44,000

    By Stage:
    • Prospecting: 5 deals, $75K avg (30% win rate)
    • Qualification: 3 deals, $50K avg (60% win rate)
    • Proposal: 2 deals, $25K avg (80% win rate)
    • Negotiation: 1 deal, $10K avg (90% win rate)
    • Closed Won: 10 deals, $500K total

    Probability Distribution:
    • High (80-100%): 3 deals, $35K
    • Medium (50-79%): 8 deals, $80K
    • Low (0-49%): 5 deals, $35K

    Forecast (Next 30 days):
    • Likely to close: $28K (80% probability)
    • At risk: $15K (50% probability)

```

**Complex Multi-Step Workflow:**
```

User: "Create new deal"
Bot: "Deal name?"
User: "Tech Corp - Migration Project"

Bot: "Contact person?"
User: "Search: Sarah Johnson" [Found at Tech Corp]

Bot: "Found Sarah Johnson at Tech Corp. Use this account? (yes/no)"
User: "yes"

Bot: "Pipeline stage?" [Shows all stages with colors]
User: "Discovery"

Bot: "Deal value?"
User: "$100,000"

Bot: "Win probability (0-100)?"
User: "80"

Bot: "Expected close date?"
User: "March 2026"

Bot: "Add products?"
User: "yes"

Bot: "Product?"
User: "Cloud Migration Service"

Bot: "Quantity?"
User: "1"

Bot: "Price?" [auto-filled: $100K]
User: "yes"

Bot: "Add more?"
User: "no"

Bot: [Summary]
Tech Corp - Migration Project
Contact: Sarah Johnson
Stage: Discovery
Value: $100,000 (80% probability)
Expected Close: March 2026
Products: 1x Cloud Migration Service

Confirm? (yes/no)
User: "yes"

Bot: ✓ Deal created! Move to Proposal? (yes/no)
User: "yes"
Bot: ✓ Moved to Proposal. Next steps?

→ Creates:

- Opportunity (Discovery stage, then Proposal)
- OpportunityLineItem (Cloud Migration Service)
- OpportunityHistory (2 entries)
- Activity (deal created + stage moved)

````

---

## 11. Type Safety & Code Generation

**Leverage Prisma Types:**

```typescript
// NO manual type duplication like before
import type { Account, Product, Order, Opportunity, PipelineStage } from "@prisma/client";

// Types auto-sync with schema.prisma
// If schema changes → TypeScript errors at build time
````

---

## 12. Summary

This comprehensive architecture provides:

### Core Features

✅ **Unified Pattern** - Same skill/workflow approach for all 8+ entities  
✅ **Conversational Experience** - Natural language workflows via Chat UI  
✅ **Multi-Step Forms** - Guided data collection with validation  
✅ **Type Safety** - 100% Prisma type inheritance, zero manual duplication  
✅ **Scalability** - Easy to add new entities following the pattern

### CRM-Specific Features

✅ **Sales Pipeline** - Visual pipeline with stages, colorized, analytics  
✅ **Opportunity Management** - Create, move, update probability, close deals  
✅ **Account Relationships** - Link contacts to companies, track all interactions  
✅ **Pipeline Analytics** - Value, probability, forecasting, win rates by stage  
✅ **Cross-Entity Workflows** - Account + Contact + Opportunity + Products together

### Communication & E-Commerce

✅ **Multi-Channel** - Email, SMS, phone, social media (Facebook, Instagram, TikTok, WhatsApp)  
✅ **Landing Pages & Forms** - Lead capture with auto-contact creation  
✅ **Product Store** - Full e-commerce with products, categories, variants, inventory  
✅ **Orders** - Complete order management linked to contacts/accounts  
✅ **Engagement Tracking** - Email opens, clicks, form submissions

### Intent-Driven Architecture

✅ **Natural Language Routing** - "Create a deal", "Move to proposal", "Show pipeline analytics"  
✅ **Smart Intent Detection** - Regex patterns for common phrases  
✅ **Rich Message Types** - Forms, lists, confirmations, details, progress, analytics  
✅ **Workflow State Management** - Persistent multi-step workflows

### Data & Analytics

✅ **Complete Audit Trail** - OpportunityHistory tracks all stage changes  
✅ **Activity Timeline** - Unified activity feed for all contact interactions  
✅ **Pipeline Forecasting** - Weighted revenue by probability  
✅ **Reporting Ready** - Analytics endpoints for dashboards

---

## 13. Next Steps

1. **Start with Phase 1** - Account Skill + Repository
2. **Enhance Intent Router** - Add natural language detection
3. **Build Pipeline Skill** - Core stage management
4. **Extend Opportunity Skill** - Account relationship + LineItems + Analytics
5. **Integrate Chat UI** - Forms, lists, confirmations for pipeline workflows
6. **Add E-Commerce** - Product, Order, Coupon skills
7. **Advanced Features** - Landing pages, forms, engagement tracking

All skills follow the same proven pattern, ensuring consistency and maintainability across your entire CRM platform.
