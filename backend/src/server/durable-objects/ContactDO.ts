/**
 * ContactDO - Manages contacts for ONE organization
 *
 * Key features:
 * - True multi-tenant isolation (one DO per organization)
 * - Full CRUD operations with validation
 * - Activity logging for audit trail
 * - Advanced search and filtering
 * - Contact relationships (org charts)
 * - Lead scoring and tagging
 * - Custom fields support
 *
 * Storage capacity:
 * - DO SQL: 128MB per instance
 * - ~500 bytes per contact = 250,000 contacts per org
 * - Activities: ~200 bytes each = 600,000 activities
 *
 * Performance:
 * - Create contact: <1ms (local SQL)
 * - Search contacts: <5ms (indexed queries)
 * - Get contact: <1ms (primary key lookup)
 */

import { DurableObject } from "cloudflare:workers";
import { createLogger } from "../utils/logger";

const logger = createLogger("ContactDO");

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  description?: string;
  company?: string;
  jobTitle?: string;
  notes?: string; // Legacy, use description instead
  leadScore: number;
  status: "active" | "inactive" | "archived";
  tags: string[];
  customFields: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  type:
    | "created"
    | "updated"
    | "email_sent"
    | "call_made"
    | "meeting_scheduled"
    | "note_added";
  description: string;
  metadata?: Record<string, any>;
  createdBy: string;
  createdAt: number;
}

export interface ContactSearchParams {
  query?: string;
  company?: string;
  status?: string;
  tags?: string[];
  minLeadScore?: number;
  maxLeadScore?: number;
  limit?: number;
  offset?: number;
}

export interface ContactRelationship {
  id: string;
  contactAId: string;
  contactBId: string;
  relationshipType: string; // 'manager', 'colleague', 'reports_to', etc.
  metadata?: Record<string, any>;
  createdAt: number;
}

/**
 * ContactDO - Organization-scoped contact management
 *
 * Keyed by: organizationId
 * Each organization gets its own isolated ContactDO instance
 */
export class ContactDO extends DurableObject {
  private sql: SqlStorage;
  private orgId: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.orgId = ctx.id.toString();
    this.initializeSchema();
    logger.info(`[ContactDO] Initialized for org: ${this.orgId}`);
  }

  /**
   * Initialize SQL schema with indexes for fast queries
   */
  private initializeSchema(): void {
    // Contacts table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL CHECK(length(name) >= 2),
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        phone TEXT,
        source TEXT,
        description TEXT,
        company TEXT,
        job_title TEXT,
        notes TEXT,
        lead_score INTEGER DEFAULT 0 CHECK(lead_score BETWEEN 0 AND 100),
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        created_by TEXT NOT NULL
      )
    `);

    // Add source and description columns if they don't exist (migration)
    try {
      this.sql.exec(`ALTER TABLE contacts ADD COLUMN source TEXT`);
    } catch (e) { /* column already exists */ }
    try {
      this.sql.exec(`ALTER TABLE contacts ADD COLUMN description TEXT`);
    } catch (e) { /* column already exists */ }

    // Performance indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_email 
      ON contacts(email COLLATE NOCASE)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_company 
      ON contacts(company COLLATE NOCASE) 
      WHERE company IS NOT NULL
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_status_score 
      ON contacts(status, lead_score DESC, created_at DESC)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_created 
      ON contacts(created_at DESC)
    `);

    // Activity log for audit trail
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS contact_activities (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        contact_id TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_contact 
      ON contact_activities(contact_id, created_at DESC)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_activities_type 
      ON contact_activities(activity_type, created_at DESC)
    `);

    // Contact relationships (for org charts, networks)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS contact_relationships (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        contact_a_id TEXT NOT NULL,
        contact_b_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (contact_a_id) REFERENCES contacts(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_b_id) REFERENCES contacts(id) ON DELETE CASCADE,
        UNIQUE(contact_a_id, contact_b_id, relationship_type)
      )
    `);

    logger.info(`[ContactDO] Schema initialized for org: ${this.orgId}`);
  }

  // ============================================
  // RPC METHODS (called from ChatAgent/ToolExecutor)
  // ============================================

  /**
   * Create a new contact
   *
   * @throws Error if validation fails or duplicate email
   */
  async createContact(data: {
    name: string;
    email: string;
    phone?: string;
    source?: string;
    description?: string;
    company?: string;
    jobTitle?: string;
    notes?: string;
    leadScore?: number;
    tags?: string[];
    customFields?: Record<string, any>;
    createdBy: string;
  }): Promise<Contact> {
    logger.info(`[ContactDO] Creating contact: ${data.email}`, {
      orgId: this.orgId,
    });

    // Validate required fields
    if (!data.name || data.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }

    if (!data.email || !data.email.includes("@")) {
      throw new Error("Valid email is required");
    }

    if (!data.createdBy) {
      throw new Error("createdBy is required");
    }

    // Check for duplicate email
    const existing = this.sql
      .exec(
        `
      SELECT id, name FROM contacts WHERE email = ? COLLATE NOCASE
    `,
        data.email
      )
      .toArray()[0] as any;

    if (existing) {
      throw new Error(
        `Contact with email ${data.email} already exists (${existing.name})`
      );
    }

    // Validate lead score
    const leadScore = data.leadScore ?? 0;
    if (leadScore < 0 || leadScore > 100) {
      throw new Error("Lead score must be between 0 and 100");
    }

    // Insert contact
    const id = crypto.randomUUID();
    const tags = JSON.stringify(data.tags || []);
    const customFields = JSON.stringify(data.customFields || {});
    const contactSource = data.source || 'chat';

    this.sql.exec(
      `
      INSERT INTO contacts (
        id, name, email, phone, source, description, company, job_title, notes,
        lead_score, tags, custom_fields, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      data.name.trim(),
      data.email.toLowerCase().trim(),
      data.phone?.trim() || null,
      contactSource,
      data.description?.trim() || null,
      data.company?.trim() || null,
      data.jobTitle?.trim() || null,
      data.notes?.trim() || null,
      leadScore,
      tags,
      customFields,
      data.createdBy
    );

    // Log activity
    await this.logActivity({
      contactId: id,
      type: "created",
      description: `Contact created: ${data.name}`,
      createdBy: data.createdBy,
      metadata: { source: contactSource },
    });

    logger.info(`[ContactDO] Contact created: ${id}`, { orgId: this.orgId });

    const contact = await this.getContact(id);
    if (!contact) {
      throw new Error("Failed to retrieve created contact");
    }

    return contact;
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: string): Promise<Contact | null> {
    const row = this.sql
      .exec(
        `
      SELECT * FROM contacts WHERE id = ?
    `,
        contactId
      )
      .toArray()[0] as any;

    if (!row) {
      return null;
    }

    return this.mapToContact(row);
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email: string): Promise<Contact | null> {
    const row = this.sql
      .exec(
        `
      SELECT * FROM contacts WHERE email = ? COLLATE NOCASE
    `,
        email
      )
      .toArray()[0] as any;

    if (!row) {
      return null;
    }

    return this.mapToContact(row);
  }

  /**
   * Get contact by phone number
   */
  async getContactByPhone(phone: string): Promise<Contact | null> {
    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length < 10) {
      return null;
    }

    const row = this.sql
      .exec(
        `SELECT * FROM contacts WHERE phone LIKE ?`,
        `%${normalizedPhone.slice(-10)}`  // Match last 10 digits
      )
      .toArray()[0] as any;

    if (!row) {
      return null;
    }

    return this.mapToContact(row);
  }

  /**
   * Find contact by email or phone (for auto-linking leads)
   * Returns the first matching contact
   */
  async findContactByEmailOrPhone(email?: string, phone?: string): Promise<Contact | null> {
    // Try email first
    if (email) {
      const byEmail = await this.getContactByEmail(email);
      if (byEmail) return byEmail;
    }

    // Then try phone
    if (phone) {
      const byPhone = await this.getContactByPhone(phone);
      if (byPhone) return byPhone;
    }

    return null;
  }

  /**
   * List all contacts with pagination
   */
  async listContacts(
    params: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<{
    contacts: Contact[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = params.limit || 50;
    const offset = params.offset || 0;
    const status = params.status || "active";

    // Get total count
    const countRow = this.sql
      .exec(
        `
      SELECT COUNT(*) as count FROM contacts WHERE status = ?
    `,
        status
      )
      .toArray()[0] as any;
    const total = countRow?.count || 0;

    // Get paginated results
    const rows = this.sql
      .exec(
        `
      SELECT * FROM contacts 
      WHERE status = ?
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `,
        status,
        limit,
        offset
      )
      .toArray() as any[];

    const contacts = rows.map((row) => this.mapToContact(row));

    return {
      contacts,
      total,
      hasMore: offset + contacts.length < total,
    };
  }

  /**
   * Search contacts with advanced filtering
   */
  async searchContacts(params: ContactSearchParams = {}): Promise<{
    contacts: Contact[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      query,
      company,
      status = "active",
      tags,
      minLeadScore,
      maxLeadScore,
      limit = 50,
      offset = 0,
    } = params;

    let sql = `SELECT * FROM contacts WHERE 1=1`;
    const bindings: any[] = [];

    // Status filter
    if (status) {
      sql += ` AND status = ?`;
      bindings.push(status);
    }

    // Text search (name, email, company)
    if (query) {
      sql += ` AND (
        name LIKE ? OR 
        email LIKE ? OR 
        company LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      bindings.push(searchTerm, searchTerm, searchTerm);
    }

    // Company filter
    if (company) {
      sql += ` AND company = ? COLLATE NOCASE`;
      bindings.push(company);
    }

    // Lead score filter
    if (minLeadScore !== undefined) {
      sql += ` AND lead_score >= ?`;
      bindings.push(minLeadScore);
    }

    if (maxLeadScore !== undefined) {
      sql += ` AND lead_score <= ?`;
      bindings.push(maxLeadScore);
    }

    // Tags filter (JSON array contains)
    if (tags && tags.length > 0) {
      tags.forEach((tag) => {
        sql += ` AND tags LIKE ?`;
        bindings.push(`%"${tag}"%`);
      });
    }

    // Get total count
    const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");
    const countRow = this.sql.exec(countSql, ...bindings).toArray()[0] as any;
    const total = countRow?.count || 0;

    // Get paginated results
    sql += ` ORDER BY lead_score DESC, created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const rows = this.sql.exec(sql, ...bindings).toArray() as any[];
    const contacts = rows.map((row) => this.mapToContact(row));

    return {
      contacts,
      total,
      hasMore: offset + contacts.length < total,
    };
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: string,
    data: Partial<Omit<Contact, "id" | "createdAt" | "createdBy">>,
    updatedBy: string
  ): Promise<Contact> {
    // Check exists
    const existing = await this.getContact(contactId);
    if (!existing) {
      throw new Error(`Contact ${contactId} not found`);
    }

    const updates: string[] = [];
    const bindings: any[] = [];
    const changes: string[] = [];

    if (data.name !== undefined && data.name !== existing.name) {
      if (data.name.length < 2) {
        throw new Error("Name must be at least 2 characters");
      }
      updates.push("name = ?");
      bindings.push(data.name);
      changes.push(`name: ${existing.name} → ${data.name}`);
    }

    if (data.email !== undefined && data.email !== existing.email) {
      if (!data.email.includes("@")) {
        throw new Error("Valid email is required");
      }
      // Check duplicate
      const duplicate = await this.getContactByEmail(data.email);
      if (duplicate && duplicate.id !== contactId) {
        throw new Error(`Email ${data.email} already used by another contact`);
      }
      updates.push("email = ?");
      bindings.push(data.email.toLowerCase());
      changes.push(`email: ${existing.email} → ${data.email}`);
    }

    if (data.company !== undefined && data.company !== existing.company) {
      updates.push("company = ?");
      bindings.push(data.company);
      changes.push(`company: ${existing.company} → ${data.company}`);
    }

    if (data.phone !== undefined && data.phone !== existing.phone) {
      updates.push("phone = ?");
      bindings.push(data.phone);
      changes.push(`phone updated`);
    }

    if (data.jobTitle !== undefined && data.jobTitle !== existing.jobTitle) {
      updates.push("job_title = ?");
      bindings.push(data.jobTitle);
      changes.push(`jobTitle: ${existing.jobTitle} → ${data.jobTitle}`);
    }

    if (data.notes !== undefined && data.notes !== existing.notes) {
      updates.push("notes = ?");
      bindings.push(data.notes);
      changes.push(`notes updated`);
    }

    if (data.leadScore !== undefined && data.leadScore !== existing.leadScore) {
      if (data.leadScore < 0 || data.leadScore > 100) {
        throw new Error("Lead score must be between 0 and 100");
      }
      updates.push("lead_score = ?");
      bindings.push(data.leadScore);
      changes.push(`leadScore: ${existing.leadScore} → ${data.leadScore}`);
    }

    if (data.status !== undefined && data.status !== existing.status) {
      updates.push("status = ?");
      bindings.push(data.status);
      changes.push(`status: ${existing.status} → ${data.status}`);
    }

    if (data.tags !== undefined) {
      updates.push("tags = ?");
      bindings.push(JSON.stringify(data.tags));
      changes.push(`tags updated`);
    }

    if (data.customFields !== undefined) {
      updates.push("custom_fields = ?");
      bindings.push(JSON.stringify(data.customFields));
      changes.push(`customFields updated`);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = unixepoch()");
    bindings.push(contactId);

    this.sql.exec(
      `
      UPDATE contacts SET ${updates.join(", ")} WHERE id = ?
    `,
      ...bindings
    );

    // Log activity
    await this.logActivity({
      contactId,
      type: "updated",
      description: `Contact updated: ${changes.join(", ")}`,
      createdBy: updatedBy,
      metadata: { changes },
    });

    logger.info(`[ContactDO] Contact updated: ${contactId}`, {
      orgId: this.orgId,
    });

    const updated = await this.getContact(contactId);
    if (!updated) {
      throw new Error("Failed to retrieve updated contact");
    }

    return updated;
  }

  /**
   * Delete contact (soft delete - mark as archived)
   */
  async deleteContact(
    contactId: string,
    deletedBy: string
  ): Promise<{ success: boolean }> {
    const existing = await this.getContact(contactId);
    if (!existing) {
      throw new Error(`Contact ${contactId} not found`);
    }

    this.sql.exec(
      `
      UPDATE contacts SET status = 'archived', updated_at = unixepoch()
      WHERE id = ?
    `,
      contactId
    );

    // Log activity
    await this.logActivity({
      contactId,
      type: "updated",
      description: `Contact archived`,
      createdBy: deletedBy,
    });

    logger.info(`[ContactDO] Contact archived: ${contactId}`, {
      orgId: this.orgId,
    });

    return { success: true };
  }

  /**
   * Permanently delete contact (hard delete)
   */
  async permanentlyDeleteContact(
    contactId: string
  ): Promise<{ success: boolean }> {
    const existing = await this.getContact(contactId);
    if (!existing) {
      throw new Error(`Contact ${contactId} not found`);
    }

    // Delete (CASCADE will remove activities and relationships)
    this.sql.exec(`DELETE FROM contacts WHERE id = ?`, contactId);

    logger.info(`[ContactDO] Contact permanently deleted: ${contactId}`, {
      orgId: this.orgId,
    });

    return { success: true };
  }

  /**
   * Get contact activities
   */
  async getActivities(
    contactId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ContactActivity[]> {
    const rows = this.sql
      .exec(
        `
      SELECT * FROM contact_activities 
      WHERE contact_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `,
        contactId,
        limit,
        offset
      )
      .toArray() as any[];

    return rows.map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      type: row.activity_type,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  /**
   * Log activity
   */
  async logActivity(data: {
    contactId: string;
    type: string;
    description: string;
    createdBy: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

    this.sql.exec(
      `
      INSERT INTO contact_activities (
        id, contact_id, activity_type, description, metadata, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      id,
      data.contactId,
      data.type,
      data.description,
      metadata,
      data.createdBy
    );
  }

  /**
   * Add relationship between contacts
   */
  async addRelationship(data: {
    contactAId: string;
    contactBId: string;
    relationshipType: string;
    metadata?: Record<string, any>;
  }): Promise<ContactRelationship> {
    const id = crypto.randomUUID();
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null;

    this.sql.exec(
      `
      INSERT INTO contact_relationships (id, contact_a_id, contact_b_id, relationship_type, metadata)
      VALUES (?, ?, ?, ?, ?)
    `,
      id,
      data.contactAId,
      data.contactBId,
      data.relationshipType,
      metadata
    );

    return {
      id,
      contactAId: data.contactAId,
      contactBId: data.contactBId,
      relationshipType: data.relationshipType,
      metadata: data.metadata,
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Get relationships for a contact
   */
  async getRelationships(contactId: string): Promise<ContactRelationship[]> {
    const rows = this.sql
      .exec(
        `
      SELECT * FROM contact_relationships
      WHERE contact_a_id = ? OR contact_b_id = ?
      ORDER BY created_at DESC
    `,
        contactId,
        contactId
      )
      .toArray() as any[];

    return rows.map((row) => ({
      id: row.id,
      contactAId: row.contact_a_id,
      contactBId: row.contact_b_id,
      relationshipType: row.relationship_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get contact count by status
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    archived: number;
    averageLeadScore: number;
  }> {
    const stats = this.sql
      .exec(
        `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        AVG(CASE WHEN status = 'active' THEN lead_score ELSE NULL END) as avg_lead_score
      FROM contacts
    `
      )
      .toArray()[0] as any;

    return {
      total: stats.total || 0,
      active: stats.active || 0,
      inactive: stats.inactive || 0,
      archived: stats.archived || 0,
      averageLeadScore: Math.round(stats.avg_lead_score || 0),
    };
  }

  /**
   * Get top companies by contact count
   */
  async getTopCompanies(limit: number = 10): Promise<
    Array<{
      company: string;
      count: number;
    }>
  > {
    const rows = this.sql
      .exec(
        `
      SELECT company, COUNT(*) as count
      FROM contacts
      WHERE company IS NOT NULL AND status = 'active'
      GROUP BY company
      ORDER BY count DESC
      LIMIT ?
    `,
        limit
      )
      .toArray() as any[];

    return rows.map((row) => ({
      company: row.company,
      count: row.count,
    }));
  }

  /**
   * Bulk import contacts
   */
  async bulkImport(
    contacts: Array<{
      name: string;
      email: string;
      company?: string;
      phone?: string;
      jobTitle?: string;
      notes?: string;
      leadScore?: number;
      tags?: string[];
    }>,
    importedBy: string
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ email: string; error: string }>;
  }> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const contactData of contacts) {
      try {
        await this.createContact({
          ...contactData,
          createdBy: importedBy,
        });
        success++;
      } catch (error) {
        failed++;
        errors.push({
          email: contactData.email,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(
      `[ContactDO] Bulk import completed: ${success} success, ${failed} failed`,
      {
        orgId: this.orgId,
      }
    );

    return { success, failed, errors };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToContact(row: any): Contact {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      source: row.source,
      description: row.description,
      company: row.company,
      jobTitle: row.job_title,
      notes: row.notes,
      leadScore: row.lead_score,
      status: row.status,
      tags: row.tags ? JSON.parse(row.tags) : [],
      customFields: row.custom_fields ? JSON.parse(row.custom_fields) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }
}
