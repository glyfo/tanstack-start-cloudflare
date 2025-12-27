/**
 * Account Repository
 *
 * CRUD operations for Account entities using Prisma ORM
 * Extends GenericRepository<Account> for maximum code reuse
 *
 * Features:
 * - All CRUD operations inherited from GenericRepository
 * - Account-specific validation
 * - Account-specific search logic
 * - Type safety with Prisma Account model (when available)
 *
 * USAGE:
 * const repo = new AccountRepository(env);
 * const result = await repo.create({ name, email, userId });
 * const accounts = await repo.list(userId, { page: 1, limit: 20 });
 */

import { GenericRepository } from "@/server/db/base/generic-repository";
import { CommonValidators } from "@/server/utils/validators";

// Type alias for Account (from Prisma when generated)
type Account = any;

/**
 * Account repository - CRUD operations for accounts
 * ~65 lines with full CRUD + validation + search
 * (compared to 150+ lines without base class)
 */
export class AccountRepository extends GenericRepository<Account> {
  protected modelName = "account";
  protected model = (this.prisma as any).account;

  constructor(env: any) {
    super(env);
  }

  /**
   * Validate account data before creation
   * Check: required fields, email format, URL format, etc.
   */
  protected async validateCreate(data: any): Promise<void> {
    // Name is required
    if (!CommonValidators.isRequired(data.name)) {
      throw new Error("Account name is required");
    }

    if (!CommonValidators.isValidLength(data.name, 1, 100)) {
      throw new Error("Account name must be 1-100 characters");
    }

    // Email optional but must be valid if provided
    if (data.email && !CommonValidators.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }

    // Website optional but must be valid URL if provided
    if (data.website && !CommonValidators.isValidUrl(data.website)) {
      throw new Error("Invalid website URL");
    }

    // Phone optional but must be valid if provided
    if (data.phone && !CommonValidators.isValidPhone(data.phone)) {
      throw new Error("Invalid phone format");
    }

    // Annual revenue optional but must be positive if provided
    if (
      data.annualRevenue &&
      !CommonValidators.isValidCurrency(data.annualRevenue)
    ) {
      throw new Error("Invalid annual revenue amount");
    }

    // Number of employees optional but must be positive integer if provided
    if (
      data.numberOfEmployees &&
      (!Number.isInteger(data.numberOfEmployees) ||
        !CommonValidators.isPositive(data.numberOfEmployees))
    ) {
      throw new Error("Number of employees must be a positive integer");
    }

    // Email uniqueness check if provided
    if (data.email) {
      const existing = await this.model.findUnique({
        where: { email: data.email },
      });
      if (existing) {
        throw new Error("An account with this email already exists");
      }
    }
  }

  /**
   * Validate account data before update
   * Similar validation as create, with some exemptions for existing data
   */
  protected async validateUpdate(data: any, existing: Account): Promise<void> {
    // Name validation (if provided in update)
    if (data.name && !CommonValidators.isValidLength(data.name, 1, 100)) {
      throw new Error("Account name must be 1-100 characters");
    }

    // Email validation (if provided in update)
    if (data.email && !CommonValidators.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }

    // Email uniqueness check (if changed)
    if (data.email && data.email !== existing.email) {
      const duplicateEmail = await this.model.findUnique({
        where: { email: data.email },
      });
      if (duplicateEmail) {
        throw new Error("An account with this email already exists");
      }
    }

    // Website validation (if provided in update)
    if (data.website && !CommonValidators.isValidUrl(data.website)) {
      throw new Error("Invalid website URL");
    }

    // Phone validation (if provided in update)
    if (data.phone && !CommonValidators.isValidPhone(data.phone)) {
      throw new Error("Invalid phone format");
    }

    // Annual revenue validation (if provided in update)
    if (
      data.annualRevenue &&
      !CommonValidators.isValidCurrency(data.annualRevenue)
    ) {
      throw new Error("Invalid annual revenue amount");
    }

    // Number of employees validation (if provided in update)
    if (
      data.numberOfEmployees &&
      (!Number.isInteger(data.numberOfEmployees) ||
        !CommonValidators.isPositive(data.numberOfEmployees))
    ) {
      throw new Error("Number of employees must be a positive integer");
    }
  }

  /**
   * Search accounts by name, email, industry, or website
   * Override base class search for account-specific logic
   */
  protected buildSearchFilter(userId: string, query: string): any {
    return {
      userId,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { industry: { contains: query, mode: "insensitive" } },
        { website: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { country: { contains: query, mode: "insensitive" } },
      ],
    };
  }

  /**
   * Find account by email (convenience method)
   */
  async findByEmail(email: string): Promise<Account | null> {
    return this.model.findUnique({ where: { email } });
  }

  /**
   * Find accounts by industry
   */
  async findByIndustry(
    userId: string,
    industry: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Account[]; count: number } | null> {
    try {
      const skip = (page - 1) * limit;

      const data = await this.model.findMany({
        where: { userId, industry },
        skip,
        take: limit,
      });

      const count = await this.model.count({
        where: { userId, industry },
      });

      return { data, count };
    } catch (error) {
      console.error("[AccountRepository] Error finding by industry:", error);
      return null;
    }
  }

  /**
   * Find accounts with minimum annual revenue
   */
  async findByMinRevenue(
    userId: string,
    minRevenue: number,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Account[]; count: number } | null> {
    try {
      const skip = (page - 1) * limit;

      const data = await this.model.findMany({
        where: {
          userId,
          annualRevenue: { gte: minRevenue },
        },
        orderBy: { annualRevenue: "desc" },
        skip,
        take: limit,
      });

      const count = await this.model.count({
        where: {
          userId,
          annualRevenue: { gte: minRevenue },
        },
      });

      return { data, count };
    } catch (error) {
      console.error("[AccountRepository] Error finding by revenue:", error);
      return null;
    }
  }

  /**
   * Get account statistics for user
   */
  async getStats(userId: string): Promise<{
    totalAccounts: number;
    avgRevenue: number;
    industriesCovered: number;
  } | null> {
    try {
      const accounts = await this.model.findMany({
        where: { userId },
      });

      const totalAccounts = accounts.length;
      const totalRevenue = accounts.reduce(
        (sum: number, acc: Account) => sum + (acc.annualRevenue || 0),
        0
      );
      const avgRevenue = totalRevenue / totalAccounts || 0;
      const industriesCovered = new Set(
        accounts.map((acc: Account) => acc.industry).filter(Boolean)
      ).size;

      return { totalAccounts, avgRevenue, industriesCovered };
    } catch (error) {
      console.error("[AccountRepository] Error getting stats:", error);
      return null;
    }
  }
}
