/**
 * Account CRUD Skill
 *
 * Unified skill for all Account CRUD operations with conversational workflows.
 * Extends GenericEntityCRUDSkill<T> for maximum code reuse (30 lines total!)
 *
 * Supports:
 * - CREATE: Multi-step form with validation and confirmation
 * - READ: List, search, and view details
 * - UPDATE: Conversational field-by-field update
 * - DELETE: Confirmation workflow
 *
 * CATEGORY: workflow
 * EXTENDS: GenericEntityCRUDSkill<Account>
 * REPOSITORY: AccountRepository
 *
 * USAGE: This skill handles all account management conversationally.
 * The base class GenericEntityCRUDSkill handles all CRUD logic.
 * This skill only defines entity-specific configuration.
 */

import {
  GenericEntityCRUDSkill,
  EntityConfig,
} from "@/server/skills/base/generic-entity-skill";
import { AccountRepository } from "@/server/db/account-repository";
import { SkillMetadata, SkillContext } from "@/server/skills/base/base-skill";
import { CommonValidators } from "@/server/utils/validators";

// Type alias for Account (from Prisma when generated)
type Account = any;

export class AccountCRUDSkill extends GenericEntityCRUDSkill<Account> {
  metadata: SkillMetadata = {
    id: "workflow:account-crud",
    name: "Account Management",
    description: "Create, read, update, and delete accounts conversationally",
    version: "1.0.0",
    category: "workflow",
    tags: ["account", "crm", "crud", "form", "workflow"],
  };

  public repository!: AccountRepository;

  protected entityConfig: EntityConfig<Account> = {
    name: "Account",
    pluralName: "Accounts",
    fields: [
      {
        name: "name",
        label: "Account Name",
        type: "text",
        required: true,
        description: "Company or organization name",
        placeholder: "Acme Corporation",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: false,
        placeholder: "contact@example.com",
      },
      {
        name: "phone",
        label: "Phone",
        type: "phone",
        required: false,
        placeholder: "(123) 456-7890",
      },
      {
        name: "website",
        label: "Website",
        type: "url",
        required: false,
        placeholder: "https://example.com",
      },
      {
        name: "industry",
        label: "Industry",
        type: "select",
        required: false,
        options: [
          { label: "Technology", value: "Technology" },
          { label: "Healthcare", value: "Healthcare" },
          { label: "Finance", value: "Finance" },
          { label: "Retail", value: "Retail" },
          { label: "Manufacturing", value: "Manufacturing" },
          { label: "Other", value: "Other" },
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
        name: "address",
        label: "Address",
        type: "text",
        required: false,
      },
      {
        name: "city",
        label: "City",
        type: "text",
        required: false,
      },
      {
        name: "state",
        label: "State/Province",
        type: "text",
        required: false,
      },
      {
        name: "country",
        label: "Country",
        type: "text",
        required: false,
      },
    ],
  };

  /**
   * Initialize skill
   */
  async initialize(context: SkillContext): Promise<void> {
    await super.initialize(context);
    this.repository = new AccountRepository(context.env);
  }

  /**
   * Account-specific field validation (override base class)
   * The base class handles type validation; this handles business logic
   */
  protected async validateField(
    fieldName: string,
    value: any
  ): Promise<boolean> {
    // First, use base class validation (type checking)
    const isValidType = await super.validateField(fieldName, value);
    if (!isValidType) return false;

    // Then, add account-specific validation
    switch (fieldName) {
      case "name":
        // Account name is already required and length-validated in repository
        return true;
      case "email":
        // Email validation is done in repository with uniqueness check
        return true;
      case "numberOfEmployees":
        // Must be positive integer
        return Number.isInteger(value) && CommonValidators.isPositive(value);
      case "annualRevenue":
        // Must be valid currency amount
        return CommonValidators.isValidCurrency(value);
      default:
        return true;
    }
  }

  /**
   * Format account for list display
   * Override formatListItem to customize list display
   */
  protected formatListItem(account: Account): string {
    const industry = account.industry ? ` (${account.industry})` : "";
    return `${account.name}${industry}`;
  }
}
