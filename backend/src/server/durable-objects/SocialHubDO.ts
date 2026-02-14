/**
 * SocialHubDO - Unified social media hub per organization
 *
 * Consolidates:
 * - TikTokLeadDO: One table instead of one DO per lead
 * - FacebookLeadDO: One table instead of one DO per lead
 * - SocialConnectionsDO: OAuth tokens and connection management
 *
 * Key features:
 * - True multi-tenant isolation (one DO per organization)
 * - Unified leads table with platform discrimination
 * - Encrypted token storage (AES-256-GCM)
 * - Deduplication via email/phone indexes
 * - Webhook event logging
 *
 * Storage capacity:
 * - DO SQL: 128MB per instance
 * - ~2KB per lead = 65,000 leads per org
 * - ~2KB per connection = can handle all social platforms
 */

import { DurableObject } from 'cloudflare:workers';
import {
  encryptToken,
  decryptToken,
  generateWebhookSecret,
} from '@/server/services/token-encryption';

// =============================================================================
// TYPES
// =============================================================================

export type SocialPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

export type LeadStatus = 'new' | 'processing' | 'qualified' | 'contacted' | 'converted' | 'duplicate';

export type ConnectionStatus = 'active' | 'expired' | 'disconnected' | 'error';

export interface UnifiedLead {
  id: string;
  organizationId: string;
  platform: SocialPlatform;
  platformLeadId: string;

  // Common contact fields
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  };

  // Platform-specific metadata (JSON)
  platformMetadata: Record<string, unknown>;

  // Workflow integration
  status: LeadStatus;
  isDuplicate: boolean;
  duplicateOfId?: string;
  qualificationDOId?: string;
  opportunityId?: string;

  // Contact linkage (for 360-degree view)
  contactId?: string;

  // Timestamps
  platformCreatedAt: number;
  receivedAt: number;
  processedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SocialConnection {
  id: string;
  platform: SocialPlatform;
  platformUserId?: string;
  platformUsername?: string;
  platformPageId?: string;
  platformPageName?: string;
  scope?: string;
  expiresAt?: number;
  status: ConnectionStatus;
  lastVerifiedAt?: number;
  errorMessage?: string;
  webhookSecret?: string;
  connectedAt: number;
  connectedBy: string;
  updatedAt: number;
}

export interface WebhookEvent {
  id: string;
  platform: SocialPlatform;
  eventType: string;
  leadId?: string;
  rawPayload?: string;
  processedAt: number;
}

export interface LeadListResult {
  leads: UnifiedLead[];
  total: number;
  hasMore: boolean;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingLeadId?: string;
  matchedOn?: 'email' | 'phone' | 'both';
}

// =============================================================================
// ROW TYPES
// =============================================================================

interface LeadRow {
  id: string;
  platform: string;
  platform_lead_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  platform_metadata: string;
  status: string;
  is_duplicate: number;
  duplicate_of_id: string | null;
  qualification_do_id: string | null;
  opportunity_id: string | null;
  contact_id: string | null;  // Link to ContactDO
  platform_created_at: number | null;
  received_at: number;
  processed_at: number | null;
  created_at: number;
  updated_at: number;
}

interface ConnectionRow {
  id: string;
  platform: string;
  platform_user_id: string | null;
  platform_username: string | null;
  platform_page_id: string | null;
  platform_page_name: string | null;
  access_token_encrypted: string;
  access_token_iv: string;
  access_token_salt: string;
  refresh_token_encrypted: string | null;
  refresh_token_iv: string | null;
  refresh_token_salt: string | null;
  scope: string | null;
  expires_at: number | null;
  status: string;
  last_verified_at: number | null;
  error_message: string | null;
  webhook_secret: string | null;
  connected_at: number;
  connected_by: string;
  updated_at: number;
}

// =============================================================================
// DURABLE OBJECT
// =============================================================================

export class SocialHubDO extends DurableObject {
  private sql: SqlStorage;
  private orgId: string;
  private encryptionSecret: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.orgId = ctx.id.toString();
    this.encryptionSecret = env.TOKEN_ENCRYPTION_SECRET || 'dev-encryption-secret-change-me';

    // Initialize schema in constructor
    ctx.blockConcurrencyWhile(async () => this.initializeSchema());
  }

  // ===========================================================================
  // SCHEMA INITIALIZATION
  // ===========================================================================

  private initializeSchema(): void {
    // Unified leads table (all platforms)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL CHECK(platform IN ('facebook', 'instagram', 'whatsapp', 'tiktok', 'gmail')),
        platform_lead_id TEXT NOT NULL,

        -- Contact info
        name TEXT,
        email TEXT,
        phone TEXT,
        company TEXT,

        -- Platform metadata (JSON)
        platform_metadata TEXT DEFAULT '{}',

        -- Status
        status TEXT DEFAULT 'new' CHECK(status IN ('new', 'processing', 'qualified', 'contacted', 'converted', 'duplicate')),
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of_id TEXT,

        -- Integration
        qualification_do_id TEXT,
        opportunity_id TEXT,
        contact_id TEXT,  -- Link to ContactDO for 360-degree view

        -- Timestamps
        platform_created_at INTEGER,
        received_at INTEGER NOT NULL,
        processed_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),

        UNIQUE(platform, platform_lead_id)
      )
    `);

    // Indexes for efficient queries
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_leads_platform ON leads(platform, status)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at DESC)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(contact_id) WHERE contact_id IS NOT NULL`);

    // Migration: Add contact_id column if it doesn't exist (for existing DOs)
    try {
      this.sql.exec(`ALTER TABLE leads ADD COLUMN contact_id TEXT`);
    } catch {
      // Column already exists, ignore
    }

    // OAuth connections table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        platform TEXT NOT NULL UNIQUE CHECK(platform IN ('facebook', 'instagram', 'whatsapp', 'tiktok')),

        -- Platform identifiers
        platform_user_id TEXT,
        platform_username TEXT,
        platform_page_id TEXT,
        platform_page_name TEXT,

        -- Encrypted tokens (AES-GCM)
        access_token_encrypted TEXT NOT NULL,
        access_token_iv TEXT NOT NULL,
        access_token_salt TEXT NOT NULL,
        refresh_token_encrypted TEXT,
        refresh_token_iv TEXT,
        refresh_token_salt TEXT,

        -- Metadata
        scope TEXT,
        expires_at INTEGER,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'disconnected', 'error')),
        last_verified_at INTEGER,
        error_message TEXT,
        webhook_secret TEXT,

        -- Audit
        connected_at INTEGER DEFAULT (unixepoch()),
        connected_by TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_connections_platform ON connections(platform)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_connections_expires ON connections(expires_at) WHERE expires_at IS NOT NULL`);

    // Webhook events log
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        platform TEXT NOT NULL,
        event_type TEXT NOT NULL,
        lead_id TEXT,
        raw_payload TEXT,
        processed_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (lead_id) REFERENCES leads(id)
      )
    `);

    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_webhook_events_platform ON webhook_events(platform, processed_at DESC)`);
  }

  // ===========================================================================
  // LEAD MANAGEMENT
  // ===========================================================================

  /**
   * Upsert a lead from any social platform
   * @param contactId - Optional contact ID to link for 360-degree view
   */
  async upsertLead(data: {
    platform: SocialPlatform;
    platformLeadId: string;
    contact: {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
    };
    platformMetadata: Record<string, unknown>;
    platformCreatedAt?: number;
    rawPayload?: string;
    contactId?: string;  // Link to existing contact
  }): Promise<UnifiedLead> {
    const id = `${data.platform}-${data.platformLeadId}`;
    const now = Math.floor(Date.now() / 1000);

    // Normalize contact data
    const email = data.contact.email?.toLowerCase().trim() || null;
    const phone = data.contact.phone?.replace(/\D/g, '') || null;

    // Check if lead exists
    const existing = this.sql.exec(
      `SELECT id FROM leads WHERE platform = ? AND platform_lead_id = ?`,
      data.platform, data.platformLeadId
    ).toArray() as Array<{ id: string }>;

    if (existing.length > 0) {
      // Update existing lead
      this.sql.exec(`
        UPDATE leads SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          company = COALESCE(?, company),
          platform_metadata = ?,
          contact_id = COALESCE(?, contact_id),
          updated_at = ?
        WHERE id = ?
      `,
        data.contact.name || null,
        email,
        phone,
        data.contact.company || null,
        JSON.stringify(data.platformMetadata),
        data.contactId || null,
        now,
        id
      );
    } else {
      // Insert new lead
      this.sql.exec(`
        INSERT INTO leads (
          id, platform, platform_lead_id,
          name, email, phone, company,
          platform_metadata, platform_created_at, received_at, created_at, updated_at,
          contact_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        id, data.platform, data.platformLeadId,
        data.contact.name || null,
        email,
        phone,
        data.contact.company || null,
        JSON.stringify(data.platformMetadata),
        data.platformCreatedAt ? Math.floor(data.platformCreatedAt / 1000) : null,
        now, now, now,
        data.contactId || null
      );
    }

    // Log webhook event
    if (data.rawPayload) {
      this.sql.exec(`
        INSERT INTO webhook_events (id, platform, event_type, lead_id, raw_payload)
        VALUES (?, ?, ?, ?, ?)
      `,
        crypto.randomUUID(),
        data.platform,
        existing.length > 0 ? 'lead_updated' : 'lead_received',
        id,
        data.rawPayload
      );
    }

    const lead = await this.getLead(id);
    if (!lead) {
      throw new Error(`Failed to retrieve lead after upsert: ${id}`);
    }
    return lead;
  }

  /**
   * Get a lead by ID
   */
  async getLead(leadId: string): Promise<UnifiedLead | null> {
    const rows = this.sql.exec(
      `SELECT * FROM leads WHERE id = ?`,
      leadId
    ).toArray() as unknown as LeadRow[];

    if (rows.length === 0) return null;
    return this.mapRowToLead(rows[0]);
  }

  /**
   * List leads with optional filters
   */
  async listLeads(params: {
    platform?: SocialPlatform;
    status?: LeadStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<LeadListResult> {
    const { platform, status, limit = 50, offset = 0 } = params;

    let sql = `SELECT * FROM leads WHERE 1=1`;
    const bindings: (string | number)[] = [];

    if (platform) {
      sql += ` AND platform = ?`;
      bindings.push(platform);
    }
    if (status) {
      sql += ` AND status = ?`;
      bindings.push(status);
    }

    // Count total
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countRow = this.sql.exec(countSql, ...bindings).toArray()[0] as { count: number } | undefined;
    const total = countRow?.count || 0;

    // Get paginated results
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const rows = this.sql.exec(sql, ...bindings).toArray() as unknown as LeadRow[];
    const leads = rows.map(r => this.mapRowToLead(r));

    return { leads, total, hasMore: offset + leads.length < total };
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: LeadStatus, _metadata?: Record<string, unknown>): Promise<UnifiedLead | null> {
    const now = Math.floor(Date.now() / 1000);
    const processedAt = status !== 'new' ? now : null;

    this.sql.exec(`
      UPDATE leads SET
        status = ?,
        processed_at = COALESCE(?, processed_at),
        updated_at = ?
      WHERE id = ?
    `, status, processedAt, now, leadId);

    return this.getLead(leadId);
  }

  /**
   * Link lead to qualification DO
   */
  async linkQualification(leadId: string, qualificationDOId: string): Promise<void> {
    this.sql.exec(`
      UPDATE leads SET qualification_do_id = ?, updated_at = ? WHERE id = ?
    `, qualificationDOId, Math.floor(Date.now() / 1000), leadId);
  }

  /**
   * Link lead to opportunity
   */
  async linkOpportunity(leadId: string, opportunityId: string): Promise<void> {
    this.sql.exec(`
      UPDATE leads SET opportunity_id = ?, updated_at = ? WHERE id = ?
    `, opportunityId, Math.floor(Date.now() / 1000), leadId);
  }

  /**
   * Link lead to contact (for 360-degree customer view)
   */
  async linkContact(leadId: string, contactId: string): Promise<void> {
    this.sql.exec(`
      UPDATE leads SET contact_id = ?, updated_at = ? WHERE id = ?
    `, contactId, Math.floor(Date.now() / 1000), leadId);
  }

  /**
   * Unlink lead from contact
   */
  async unlinkContact(leadId: string): Promise<void> {
    this.sql.exec(`
      UPDATE leads SET contact_id = NULL, updated_at = ? WHERE id = ?
    `, Math.floor(Date.now() / 1000), leadId);
  }

  /**
   * Get all leads linked to a specific contact (for 360-degree view)
   */
  async getLeadsByContactId(contactId: string): Promise<UnifiedLead[]> {
    const rows = this.sql.exec(`
      SELECT * FROM leads WHERE contact_id = ? ORDER BY created_at DESC
    `, contactId).toArray() as unknown as LeadRow[];

    return rows.map(r => this.mapRowToLead(r));
  }

  /**
   * Find leads by email or phone (for auto-linking)
   */
  async findLeadsByEmailOrPhone(email?: string, phone?: string): Promise<UnifiedLead[]> {
    if (!email && !phone) return [];

    const conditions: string[] = [];
    const bindings: string[] = [];

    if (email) {
      conditions.push('email = ?');
      bindings.push(email.toLowerCase().trim());
    }
    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.length >= 10) {
        conditions.push('phone = ?');
        bindings.push(normalizedPhone);
      }
    }

    if (conditions.length === 0) return [];

    const rows = this.sql.exec(`
      SELECT * FROM leads WHERE ${conditions.join(' OR ')} ORDER BY created_at DESC
    `, ...bindings).toArray() as unknown as LeadRow[];

    return rows.map(r => this.mapRowToLead(r));
  }

  /**
   * Check for duplicate leads by email or phone
   */
  async checkDuplicate(email?: string, phone?: string): Promise<DuplicateCheckResult> {
    if (!email && !phone) {
      return { isDuplicate: false };
    }

    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedPhone = phone?.replace(/\D/g, '');

    // Build query
    let sql = `SELECT id FROM leads WHERE status != 'duplicate' AND (`;
    const conditions: string[] = [];
    const bindings: string[] = [];

    if (normalizedEmail) {
      conditions.push('email = ?');
      bindings.push(normalizedEmail);
    }
    if (normalizedPhone && normalizedPhone.length >= 10) {
      conditions.push('phone = ?');
      bindings.push(normalizedPhone);
    }

    if (conditions.length === 0) {
      return { isDuplicate: false };
    }

    sql += conditions.join(' OR ') + ') LIMIT 1';

    const existing = this.sql.exec(sql, ...bindings).toArray() as Array<{ id: string }>;

    if (existing.length > 0) {
      let matchedOn: 'email' | 'phone' | 'both' = 'email';
      if (normalizedEmail && normalizedPhone) {
        matchedOn = 'both';
      } else if (normalizedPhone) {
        matchedOn = 'phone';
      }
      return { isDuplicate: true, existingLeadId: existing[0].id, matchedOn };
    }

    return { isDuplicate: false };
  }

  /**
   * Mark lead as duplicate
   */
  async markAsDuplicate(leadId: string, duplicateOfId: string): Promise<void> {
    this.sql.exec(`
      UPDATE leads SET
        status = 'duplicate',
        is_duplicate = 1,
        duplicate_of_id = ?,
        updated_at = ?
      WHERE id = ?
    `, duplicateOfId, Math.floor(Date.now() / 1000), leadId);
  }

  /**
   * Get leads by email
   */
  async getLeadsByEmail(email: string): Promise<UnifiedLead[]> {
    const rows = this.sql.exec(
      `SELECT * FROM leads WHERE email = ? ORDER BY created_at DESC`,
      email.toLowerCase().trim()
    ).toArray() as unknown as LeadRow[];
    return rows.map(r => this.mapRowToLead(r));
  }

  /**
   * Get leads by phone
   */
  async getLeadsByPhone(phone: string): Promise<UnifiedLead[]> {
    const rows = this.sql.exec(
      `SELECT * FROM leads WHERE phone = ? ORDER BY created_at DESC`,
      phone.replace(/\D/g, '')
    ).toArray() as unknown as LeadRow[];
    return rows.map(r => this.mapRowToLead(r));
  }

  // ===========================================================================
  // CONNECTION MANAGEMENT
  // ===========================================================================

  /**
   * Save OAuth connection
   */
  async saveConnection(params: {
    platform: SocialPlatform;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    platformUserId?: string;
    platformUsername?: string;
    platformPageId?: string;
    platformPageName?: string;
    connectedBy: string;
  }): Promise<SocialConnection> {
    const now = Math.floor(Date.now() / 1000);

    // Encrypt access token
    const accessEncrypted = await encryptToken(params.accessToken, this.encryptionSecret);

    // Encrypt refresh token if provided
    let refreshEncrypted: { encrypted: string; iv: string; salt: string } | null = null;
    if (params.refreshToken) {
      refreshEncrypted = await encryptToken(params.refreshToken, this.encryptionSecret);
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Upsert connection
    this.sql.exec(`
      INSERT INTO connections (
        id, platform,
        platform_user_id, platform_username, platform_page_id, platform_page_name,
        access_token_encrypted, access_token_iv, access_token_salt,
        refresh_token_encrypted, refresh_token_iv, refresh_token_salt,
        scope, expires_at, status, webhook_secret,
        connected_at, connected_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      ON CONFLICT(platform) DO UPDATE SET
        platform_user_id = excluded.platform_user_id,
        platform_username = excluded.platform_username,
        platform_page_id = excluded.platform_page_id,
        platform_page_name = excluded.platform_page_name,
        access_token_encrypted = excluded.access_token_encrypted,
        access_token_iv = excluded.access_token_iv,
        access_token_salt = excluded.access_token_salt,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        refresh_token_iv = excluded.refresh_token_iv,
        refresh_token_salt = excluded.refresh_token_salt,
        scope = excluded.scope,
        expires_at = excluded.expires_at,
        status = 'active',
        error_message = NULL,
        updated_at = excluded.updated_at
    `,
      crypto.randomUUID(), params.platform,
      params.platformUserId || null, params.platformUsername || null,
      params.platformPageId || null, params.platformPageName || null,
      accessEncrypted.encrypted, accessEncrypted.iv, accessEncrypted.salt,
      refreshEncrypted?.encrypted || null, refreshEncrypted?.iv || null, refreshEncrypted?.salt || null,
      params.scope || null, params.expiresAt || null,
      webhookSecret, now, params.connectedBy, now
    );

    return (await this.getConnection(params.platform))!;
  }

  /**
   * Get connection by platform
   */
  async getConnection(platform: SocialPlatform): Promise<SocialConnection | null> {
    const rows = this.sql.exec(
      `SELECT * FROM connections WHERE platform = ?`,
      platform
    ).toArray() as unknown as ConnectionRow[];

    if (rows.length === 0) return null;
    return this.mapRowToConnection(rows[0]);
  }

  /**
   * Get all connections
   */
  async listConnections(): Promise<SocialConnection[]> {
    const rows = this.sql.exec(
      `SELECT * FROM connections ORDER BY connected_at DESC`
    ).toArray() as unknown as ConnectionRow[];
    return rows.map(r => this.mapRowToConnection(r));
  }

  /**
   * Get decrypted access token
   */
  async getAccessToken(platform: SocialPlatform): Promise<string | null> {
    const rows = this.sql.exec(
      `SELECT access_token_encrypted, access_token_iv, access_token_salt FROM connections WHERE platform = ?`,
      platform
    ).toArray() as Array<Pick<ConnectionRow, 'access_token_encrypted' | 'access_token_iv' | 'access_token_salt'>>;

    if (rows.length === 0) return null;

    const row = rows[0];
    return decryptToken(
      { encrypted: row.access_token_encrypted, iv: row.access_token_iv, salt: row.access_token_salt },
      this.encryptionSecret
    );
  }

  /**
   * Get decrypted refresh token
   */
  async getRefreshToken(platform: SocialPlatform): Promise<string | null> {
    const rows = this.sql.exec(
      `SELECT refresh_token_encrypted, refresh_token_iv, refresh_token_salt FROM connections WHERE platform = ?`,
      platform
    ).toArray() as Array<Pick<ConnectionRow, 'refresh_token_encrypted' | 'refresh_token_iv' | 'refresh_token_salt'>>;

    if (rows.length === 0) return null;

    const row = rows[0];
    if (!row.refresh_token_encrypted) return null;

    return decryptToken(
      { encrypted: row.refresh_token_encrypted, iv: row.refresh_token_iv!, salt: row.refresh_token_salt! },
      this.encryptionSecret
    );
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(platform: SocialPlatform, params: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const accessEncrypted = await encryptToken(params.accessToken, this.encryptionSecret);

    let refreshEncrypted: { encrypted: string; iv: string; salt: string } | null = null;
    if (params.refreshToken) {
      refreshEncrypted = await encryptToken(params.refreshToken, this.encryptionSecret);
    }

    this.sql.exec(`
      UPDATE connections SET
        access_token_encrypted = ?,
        access_token_iv = ?,
        access_token_salt = ?,
        refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
        refresh_token_iv = COALESCE(?, refresh_token_iv),
        refresh_token_salt = COALESCE(?, refresh_token_salt),
        expires_at = COALESCE(?, expires_at),
        status = 'active',
        error_message = NULL,
        updated_at = ?
      WHERE platform = ?
    `,
      accessEncrypted.encrypted, accessEncrypted.iv, accessEncrypted.salt,
      refreshEncrypted?.encrypted || null, refreshEncrypted?.iv || null, refreshEncrypted?.salt || null,
      params.expiresAt || null, now, platform
    );
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(platform: SocialPlatform, status: ConnectionStatus, errorMessage?: string): Promise<void> {
    this.sql.exec(`
      UPDATE connections SET
        status = ?,
        error_message = ?,
        updated_at = ?
      WHERE platform = ?
    `, status, errorMessage || null, Math.floor(Date.now() / 1000), platform);
  }

  /**
   * Disconnect platform
   */
  async disconnect(platform: SocialPlatform): Promise<void> {
    this.sql.exec(`DELETE FROM connections WHERE platform = ?`, platform);
  }

  /**
   * Get webhook secret for platform
   */
  async getWebhookSecret(platform: SocialPlatform): Promise<string | null> {
    const rows = this.sql.exec(
      `SELECT webhook_secret FROM connections WHERE platform = ?`,
      platform
    ).toArray() as Array<{ webhook_secret: string | null }>;
    return rows.length > 0 ? rows[0].webhook_secret : null;
  }

  /**
   * Get connections expiring within N days
   */
  async getExpiringConnections(days: number = 7): Promise<SocialConnection[]> {
    const threshold = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
    const rows = this.sql.exec(
      `SELECT * FROM connections WHERE expires_at IS NOT NULL AND expires_at <= ? AND status = 'active'`,
      threshold
    ).toArray() as unknown as ConnectionRow[];
    return rows.map(r => this.mapRowToConnection(r));
  }

  // ===========================================================================
  // WEBHOOK EVENTS
  // ===========================================================================

  /**
   * Log a webhook event
   */
  async logWebhookEvent(params: {
    platform: SocialPlatform;
    eventType: string;
    leadId?: string;
    rawPayload?: string;
  }): Promise<void> {
    this.sql.exec(`
      INSERT INTO webhook_events (id, platform, event_type, lead_id, raw_payload)
      VALUES (?, ?, ?, ?, ?)
    `,
      crypto.randomUUID(),
      params.platform,
      params.eventType,
      params.leadId || null,
      params.rawPayload || null
    );
  }

  /**
   * Get recent webhook events
   */
  async getRecentWebhookEvents(params: {
    platform?: SocialPlatform;
    limit?: number;
  } = {}): Promise<WebhookEvent[]> {
    const { platform, limit = 50 } = params;

    let sql = `SELECT * FROM webhook_events`;
    const bindings: (string | number)[] = [];

    if (platform) {
      sql += ` WHERE platform = ?`;
      bindings.push(platform);
    }

    sql += ` ORDER BY processed_at DESC LIMIT ?`;
    bindings.push(limit);

    const rows = this.sql.exec(sql, ...bindings).toArray() as Array<{
      id: string;
      platform: string;
      event_type: string;
      lead_id: string | null;
      raw_payload: string | null;
      processed_at: number;
    }>;

    return rows.map(r => ({
      id: r.id,
      platform: r.platform as SocialPlatform,
      eventType: r.event_type,
      leadId: r.lead_id || undefined,
      rawPayload: r.raw_payload || undefined,
      processedAt: r.processed_at * 1000,
    }));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private mapRowToLead(row: LeadRow): UnifiedLead {
    return {
      id: row.id,
      organizationId: this.orgId,
      platform: row.platform as SocialPlatform,
      platformLeadId: row.platform_lead_id,
      contact: {
        name: row.name || undefined,
        email: row.email || undefined,
        phone: row.phone || undefined,
        company: row.company || undefined,
      },
      platformMetadata: JSON.parse(row.platform_metadata || '{}'),
      status: row.status as LeadStatus,
      isDuplicate: row.is_duplicate === 1,
      duplicateOfId: row.duplicate_of_id || undefined,
      qualificationDOId: row.qualification_do_id || undefined,
      opportunityId: row.opportunity_id || undefined,
      contactId: row.contact_id || undefined,
      platformCreatedAt: row.platform_created_at ? row.platform_created_at * 1000 : 0,
      receivedAt: row.received_at * 1000,
      processedAt: row.processed_at ? row.processed_at * 1000 : undefined,
      createdAt: row.created_at * 1000,
      updatedAt: row.updated_at * 1000,
    };
  }

  private mapRowToConnection(row: ConnectionRow): SocialConnection {
    return {
      id: row.id,
      platform: row.platform as SocialPlatform,
      platformUserId: row.platform_user_id || undefined,
      platformUsername: row.platform_username || undefined,
      platformPageId: row.platform_page_id || undefined,
      platformPageName: row.platform_page_name || undefined,
      scope: row.scope || undefined,
      expiresAt: row.expires_at ? row.expires_at * 1000 : undefined,
      status: row.status as ConnectionStatus,
      lastVerifiedAt: row.last_verified_at ? row.last_verified_at * 1000 : undefined,
      errorMessage: row.error_message || undefined,
      webhookSecret: row.webhook_secret || undefined,
      connectedAt: row.connected_at * 1000,
      connectedBy: row.connected_by,
      updatedAt: row.updated_at * 1000,
    };
  }
}
