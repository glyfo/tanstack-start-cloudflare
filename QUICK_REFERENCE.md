# CRM Skills Architecture - Quick Reference

## 🎯 Core Principle: DRY (Don't Repeat Yourself)

All entity skills follow **ONE** pattern. 80% code reduction achieved through abstraction.

---

## 📋 Quick Implementation Guide

### 1. Create Skill (~30 lines)

```typescript
// src/server/skills/workflows/[entity]/skill.ts

import { SkillMetadata, SkillContext } from "@/server/skills/base";
import { GenericEntityCRUDSkill, EntityConfig } from "@/server/skills/base/generic-entity-skill";
import { [Entity] } from "@/server/skills/workflows/[entity]/types";
import { [Entity]Repository } from "@/server/db/[entity]-repository";

export class [Entity]CRUDSkill extends GenericEntityCRUDSkill<[Entity]> {
  metadata: SkillMetadata = {
    id: "workflow:[entity]-crud",
    name: "[Entity] Management",
    description: "Create, read, update, delete [entity]s conversationally",
    version: "1.0.0",
    category: "workflow",
    tags: ["[entity]"],
  };

  config: EntityConfig<[Entity]> = {
    id: "[entity]",
    name: "[Entity]",
    description: "[Entity description]",
    fields: [
      // List all fields here
      {
        name: "fieldName",
        label: "Field Label",
        type: "text",
        required: true,
        validation: (value) => value && value.length >= 2,
      },
    ],
    requiredFields: ["fieldName"],
    editableFields: ["fieldName", "otherField"],
  };

  protected repository!: [Entity]Repository;

  protected async initializeRepository(context: SkillContext): Promise<void> {
    this.repository = new [Entity]Repository(context.env);
  }

  protected formatListItem(item: [Entity]): string {
    // Custom formatting for list display
    return item.name || JSON.stringify(item);
  }
}
```

---

### 2. Create Repository (~100 lines)

```typescript
// src/server/db/[entity]-repository.ts

import { [Entity] } from "@prisma/client";
import { GenericRepository } from "@/server/db/base/generic-repository";
import type { PrismaClient } from "@prisma/client";

export class [Entity]Repository extends GenericRepository<[Entity]> {
  constructor(prisma: PrismaClient) {
    super(prisma, "[entity]");
  }

  async validateCreate(data: Partial<[Entity]>): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Validation logic
    if (!data.fieldName) {
      errors.push("Field name is required");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async validateUpdate(id: string, data: Partial<[Entity]>): Promise<{ valid: boolean; errors?: string[] }> {
    return this.validateCreate(data);
  }

  async search(userId: string, query: string): Promise<[Entity][]> {
    const searchFilter = this.buildSearchFilter(query, ["fieldName", "otherField"]);
    return this.findMany(searchFilter, userId);
  }

  // Add entity-specific methods below
  // Example:
  async findByName(name: string, userId: string): Promise<[Entity] | null> {
    return this.findByUnique({ name }, userId);
  }
}
```

---

### 3. Register in SkillRegistry

```typescript
// src/server/skills/registry.ts

import { [Entity]CRUDSkill } from "@/server/skills/workflows/[entity]/skill";

export const SKILLS_REGISTRY: SkillConfig[] = [
  // ... existing skills
  {
    id: "workflow:[entity]-crud",
    name: "[Entity] Management",
    skillClass: [Entity]CRUDSkill,
    enabled: true,
    priority: 30, // Set appropriate priority
  },
];
```

---

## 🛠️ Utility Functions

### Use CommonValidators

```typescript
import { CommonValidators } from "@/server/utils/validators";

// In validateCreate:
if (!CommonValidators.isRequired(data.email)) {
  errors.push("Email is required");
}

if (!CommonValidators.isValidEmail(data.email)) {
  errors.push("Invalid email format");
}

if (!CommonValidators.isValidCurrency(data.price)) {
  errors.push("Price must be > 0");
}
```

**Available validators:**

- `isValidEmail()` - Email format
- `isValidUrl()` - URL format
- `isValidPhone()` - Phone format
- `isRequired()` - Not empty/null/undefined
- `isValidLength()` - String length range
- `isInRange()` - Number range
- `isValidCurrency()` - Positive number
- `isValidDate()` - Valid date
- `isUnique()` - No duplicate (async)

---

### Use CommonFormatters

```typescript
import { CommonFormatters } from "@/server/utils/formatters";

// In formatListItem or responses:
const message = `
  Name: ${item.name}
  Price: ${CommonFormatters.currency(item.price)}
  Created: ${CommonFormatters.date(item.createdAt)}
  Progress: ${CommonFormatters.percentage(item.progress)}
`;

return message;
```

**Available formatters:**

- `currency()` - Format as money
- `date()` - Format as date
- `percentage()` - Format as percent
- `list()` - Format as bulleted/numbered list
- `summary()` - Format object fields
- `confirmation()` - Add confirmation prompt
- `success()` - Success message
- `error()` - Error message

---

### Use ResponseBuilder

```typescript
import { ResponseBuilder } from "@/server/utils/response-builder";

// Success response
return ResponseBuilder.success("Account created!", accountData);

// Error response
return ResponseBuilder.error("Validation failed");

// Workflow step
return ResponseBuilder.workflowStep(
  "What's the product name?",
  "product:create",
  0, // current step
  5 // total steps
);

// Confirmation
return ResponseBuilder.confirmation("Summary:\n...", data);

// List
return ResponseBuilder.list(["Item 1", "Item 2"], 2);
```

---

### Use RepositoryFactory

```typescript
import { RepositoryFactory } from "@/server/db/factory";

// Initialize factory once at app startup
RepositoryFactory.initialize(prisma);

// Use anywhere
const accountRepo = RepositoryFactory.account();
const productRepo = RepositoryFactory.product();
const opportunityRepo = RepositoryFactory.opportunity();

// Or generic
const repo = RepositoryFactory.getRepository("account");
```

---

## 📊 Field Types

In EntityConfig fields array:

```typescript
{
  name: "fieldName",           // Property name
  label: "Field Label",        // Display label
  type: "text",                // See types below
  required: true,              // Required field?
  placeholder?: "Type here",   // Input placeholder
  validation?: (v) => v > 0,   // Async or sync function
  errorMessage?: "Too low",    // Validation error
  options?: ["A", "B"],        // For select type
  min?: 0,                     // For number/slider
  max?: 100,                   // For number/slider
  default?: "default value",   // Default value
}
```

**Field types:**

- `"text"` - Text input
- `"number"` - Number input
- `"currency"` - Currency (number with $ format)
- `"date"` - Date picker
- `"select"` - Dropdown (requires `options`)
- `"textarea"` - Multi-line text
- `"color"` - Color picker
- `"email"` - Email input
- `"url"` - URL input
- `"slider"` - Range slider (requires `min`, `max`)

---

## 🔄 CRUD Flow (Automatic)

All skills handle these actions automatically:

### Create

- Step 0: Start workflow
- Step 1-N: Collect required fields
- Step N+1: Confirmation
- Final: Execute creation

### Read

- Retrieve entity by ID
- Format detailed view

### Update

- Validate changes
- Update entity
- Confirm

### Delete

- Remove entity
- Confirm

### List

- Fetch all entities
- Format as list

### Search

- Query by text
- Return matches
- Format as list

---

## 🚀 Best Practices

✅ **DO:**

- Extend `GenericEntityCRUDSkill<T>`
- Extend `GenericRepository<T>`
- Use `CommonValidators` for all validation
- Use `CommonFormatters` for all output
- Use `ResponseBuilder` for all responses
- Use `RepositoryFactory` for initialization
- Override only `formatListItem()` in skills
- Add validation in repository

❌ **DON'T:**

- Create standalone skill classes
- Duplicate CRUD logic
- Write custom formatters
- Build responses manually
- Duplicate validators
- Initialize repositories directly
- Put validation in skills
- Override handler methods

---

## 📈 Performance Tips

1. **Use pagination** - List with page/limit parameters
2. **Lazy load relations** - Only include() when needed
3. **Batch updates** - Use Promise.all() for multiple updates
4. **Index search fields** - Mark in Prisma schema
5. **Cache validators** - Memoize expensive checks
6. **Use transaction** - For multi-step creates

---

## 🧪 Testing Utilities

```typescript
// Validators are fully testable
import { CommonValidators } from "@/server/utils/validators";

describe("CommonValidators", () => {
  it("validates email", () => {
    expect(CommonValidators.isValidEmail("test@example.com")).toBe(true);
    expect(CommonValidators.isValidEmail("invalid")).toBe(false);
  });
});

// Formatters are fully testable
import { CommonFormatters } from "@/server/utils/formatters";

describe("CommonFormatters", () => {
  it("formats currency", () => {
    expect(CommonFormatters.currency(100)).toBe("$100.00");
  });
});
```

---

## 📚 References

- **Full Architecture:** [CRM_SKILLS_WORKFLOW_ARCHITECTURE.md](CRM_SKILLS_WORKFLOW_ARCHITECTURE.md)
- **Improvements Summary:** [IMPROVEMENTS_SUMMARY.md](IMPROVEMENTS_SUMMARY.md)
- **Prisma Schema:** [prisma/schema.prisma](prisma/schema.prisma)

---

## 🎓 Example: Complete Account Skill

See [CRM_SKILLS_WORKFLOW_ARCHITECTURE.md Section 4.1](CRM_SKILLS_WORKFLOW_ARCHITECTURE.md#section-41-account-skill) for full example.

---

## ⚡ Quick Stats

| Metric                 | Value      |
| ---------------------- | ---------- |
| Skill file size        | ~30 lines  |
| Repository file size   | ~100 lines |
| Code reuse             | 80%+       |
| New entity time        | ~1 hour    |
| Validators available   | 9          |
| Formatters available   | 8          |
| Entity types supported | 8+         |

---

## 🆘 Common Issues

### Issue: Validation not working

**Solution:** Implement `validateCreate()` and `validateUpdate()` in repository

### Issue: Custom formatting not showing

**Solution:** Override `formatListItem()` in skill class

### Issue: Repository not initializing

**Solution:** Use `RepositoryFactory.initialize(prisma)` at app startup

### Issue: Duplicate field names

**Solution:** Field `name` must match `keyof T` type

### Issue: Search returns nothing

**Solution:** Check `buildSearchFilter()` uses correct field names

---

**Last Updated:** December 26, 2025
