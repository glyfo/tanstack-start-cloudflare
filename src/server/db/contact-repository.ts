/**
 * Contact Repository
 *
 * CRUD operations for contacts using Prisma ORM
 * Full type safety using Prisma-generated types
 *
 * Single source of truth: Prisma schema
 * No manual type duplication
 */

import { Contact, Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/server/db/prisma-client";

// Type definitions for responses
export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

// Find options with pagination
export interface FindOptions {
  page?: number;
  limit?: number;
}

export class ContactRepository {
  private prisma: PrismaClient;

  constructor(env: any) {
    this.prisma = getPrismaClient(env);
  }

  /**
   * Create a new contact using Prisma types
   */
  async create(
    data: Prisma.ContactCreateInput
  ): Promise<RepositoryResult<Contact>> {
    try {
      console.log("[ContactRepository] 💾 CREATING CONTACT", {
        email: data.email,
        userId: data.userId,
      });

      const contact = await this.prisma.contact.create({
        data,
      });

      console.log("[ContactRepository] ✅ CONTACT CREATED", {
        id: contact.id,
        email: contact.email,
      });

      return { success: true, data: contact };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ CREATE FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Find contacts by user ID with pagination
   */
  async findMany(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<RepositoryResult<Contact[]>> {
    try {
      console.log("[ContactRepository] 📊 FETCHING CONTACTS", {
        userId,
        page,
        limit,
      });

      const skip = (page - 1) * limit;
      const contacts = await this.prisma.contact.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      const count = await this.prisma.contact.count({ where: { userId } });

      console.log("[ContactRepository] ✅ CONTACTS FETCHED", {
        count: contacts.length,
        total: count,
      });

      return { success: true, data: contacts, count };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ FETCH FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Find all contacts for a user (deprecated, use findMany)
   * @deprecated Use findMany() instead
   */
  async findByUserId(userId: string): Promise<RepositoryResult<Contact[]>> {
    return this.findMany(userId);
  }

  /**
   * Get contact by ID with optional relations
   */
  async findById(
    id: string,
    userId: string,
    includeHistory: boolean = false
  ): Promise<RepositoryResult<any>> {
    try {
      if (includeHistory) {
        // Include interactions and communications for detail view
        const contact = await this.prisma.contact.findFirst({
          where: { id, userId },
          include: {
            // interactions: { orderBy: { date: "desc" }, take: 50 },
            // communications: { orderBy: { createdAt: "desc" }, take: 50 },
          },
        });

        if (!contact) {
          return { success: false, error: "Contact not found" };
        }

        return { success: true, data: contact };
      }

      // Basic contact without relations
      const contact = await this.prisma.contact.findFirst({
        where: { id, userId },
      });

      if (!contact) {
        return { success: false, error: "Contact not found" };
      }

      return { success: true, data: contact };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ FIND FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Search contacts by name or email
   */
  async search(
    userId: string,
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<RepositoryResult<Contact[]>> {
    try {
      console.log("[ContactRepository] 🔍 SEARCHING CONTACTS", {
        userId,
        query,
      });

      const skip = (page - 1) * limit;
      const contacts = await this.prisma.contact.findMany({
        where: {
          userId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { company: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      const count = await this.prisma.contact.count({
        where: {
          userId,
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { company: { contains: query, mode: "insensitive" } },
          ],
        },
      });

      console.log("[ContactRepository] ✅ SEARCH COMPLETE", {
        found: contacts.length,
        total: count,
      });

      return { success: true, data: contacts, count };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ SEARCH FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Update a contact using Prisma types
   */
  async update(
    id: string,
    userId: string,
    data: Prisma.ContactUpdateInput
  ): Promise<RepositoryResult<Contact>> {
    try {
      console.log("[ContactRepository] ✏️  UPDATING CONTACT", { id, userId });

      const contact = await this.prisma.contact.updateMany({
        where: { id, userId },
        data,
      });

      if (contact.count === 0) {
        return { success: false, error: "Contact not found" };
      }

      // Fetch updated contact
      const updated = await this.prisma.contact.findUnique({
        where: { id },
      });

      console.log("[ContactRepository] ✅ CONTACT UPDATED", { id });

      return { success: true, data: updated! };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ UPDATE FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a contact
   */
  async delete(id: string, userId: string): Promise<RepositoryResult<void>> {
    try {
      console.log("[ContactRepository] 🗑️  DELETING CONTACT", { id, userId });

      const result = await this.prisma.contact.deleteMany({
        where: { id, userId },
      });

      if (result.count === 0) {
        return { success: false, error: "Contact not found" };
      }

      console.log("[ContactRepository] ✅ CONTACT DELETED", { id });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ DELETE FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Count contacts for a user
   */
  async countByUserId(userId: string): Promise<number> {
    return this.prisma.contact.count({ where: { userId } });
  }
}
