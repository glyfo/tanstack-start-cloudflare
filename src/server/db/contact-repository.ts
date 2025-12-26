/**
 * Contact Repository
 *
 * CRUD operations for contacts using Prisma ORM
 * Simplifies database interactions and provides type safety
 */

import { getPrismaClient } from "@/server/db/prisma-client";

export class ContactRepository {
  private prisma: any;

  constructor(env: any) {
    this.prisma = getPrismaClient(env);
  }

  /**
   * Create a new contact
   */
  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    address?: string;
    birthday?: string;
    relationship?: string;
    notes?: string;
    userId: string;
  }) {
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
   * Get all contacts for a user
   */
  async findByUserId(userId: string) {
    try {
      console.log("[ContactRepository] 📊 FETCHING CONTACTS", { userId });

      const contacts = await this.prisma.contact.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      console.log("[ContactRepository] ✅ CONTACTS FETCHED", {
        count: contacts.length,
      });

      return { success: true, data: contacts };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[ContactRepository] ❌ FETCH FAILED", { error: msg });
      return { success: false, error: msg };
    }
  }

  /**
   * Get contact by ID
   */
  async findById(id: string, userId: string) {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { id, userId },
      });

      return { success: true, data: contact };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Update a contact
   */
  async update(
    id: string,
    userId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      company: string;
      jobTitle: string;
      address: string;
      birthday: string;
      relationship: string;
      notes: string;
    }>
  ) {
    try {
      const contact = await this.prisma.contact.updateMany({
        where: { id, userId },
        data,
      });

      return { success: true, data: contact };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Delete a contact
   */
  async delete(id: string, userId: string) {
    try {
      await this.prisma.contact.deleteMany({
        where: { id, userId },
      });

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
}
