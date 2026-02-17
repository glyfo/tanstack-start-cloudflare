/**
 * CustomerIdentityDO - Cross-Channel Identity Resolution
 *
 * Links channel-specific identities (email, phone, WhatsApp, etc.) to a unified customer ID.
 * Enables 360° customer view across all communication channels.
 *
 * Features:
 * - Automatic identity matching (email, phone normalization)
 * - Manual identity linking/merging
 * - Primary contact management
 * - Activity aggregation across channels
 */

import { DurableObject } from 'cloudflare:workers';

// ============================================================================
// Types
// ============================================================================

/**
 * Channel identity (phone, email, social handle, etc.)
 */
interface ChannelIdentity {
  id: string;                   // Unique identity ID
  customerId: string;           // Linked customer ID
  channelType: string;          // whatsapp, email, sms, slack, etc.
  identifier: string;           // Channel-specific ID (email, phone, user ID)
  displayName?: string;         // Display name from channel
  verified: boolean;            // Is this identity verified?
  isPrimary: boolean;           // Is this the primary identity for this channel?
  metadata?: Record<string, any>; // Channel-specific metadata
  firstSeenAt: number;          // When first encountered
  lastSeenAt: number;           // Last activity timestamp
  messageCount: number;         // Total messages from this identity
  createdAt: number;
  updatedAt: number;
}

/**
 * Unified customer profile
 */
interface CustomerProfile {
  customerId: string;           // Unique customer ID
  orgId: string;                // Organization ID

  // Primary identifiers
  primaryEmail?: string;
  primaryPhone?: string;
  displayName?: string;

  // Linked identities
  identities: ChannelIdentity[];

  // Contact info (from ContactDO)
  contactId?: string;           // Link to ContactDO if exists

  // Metadata
  tags?: string[];
  customFields?: Record<string, any>;

  // Activity tracking
  firstContactAt: number;
  lastActivityAt: number;
  totalMessages: number;
  channelActivity: Record<string, number>; // Messages per channel

  // Status
  merged: boolean;              // Was this merged from another customer?
  mergedInto?: string;          // Customer ID this was merged into

  createdAt: number;
  updatedAt: number;
}

/**
 * Identity match candidate
 */
interface IdentityMatch {
  customerId: string;
  confidence: number;           // 0.0 - 1.0
  matchReason: string;          // email, phone, name, etc.
  existingIdentity: ChannelIdentity;
}

// ============================================================================
// CustomerIdentityDO
// ============================================================================

export class CustomerIdentityDO extends DurableObject {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  // ------------------------------------------------------------------------
  // Database Schema
  // ------------------------------------------------------------------------

  private initializeSchema(): void {
    // Customer profiles
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS customer_profiles (
        customer_id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        primary_email TEXT,
        primary_phone TEXT,
        display_name TEXT,
        contact_id TEXT,
        tags TEXT,
        custom_fields TEXT,
        first_contact_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        total_messages INTEGER NOT NULL DEFAULT 0,
        channel_activity TEXT NOT NULL,
        merged INTEGER NOT NULL DEFAULT 0,
        merged_into TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_customer_org
      ON customer_profiles(org_id)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_customer_email
      ON customer_profiles(primary_email)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_customer_phone
      ON customer_profiles(primary_phone)
    `);

    // Channel identities
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS channel_identities (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        display_name TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        is_primary INTEGER NOT NULL DEFAULT 0,
        metadata TEXT,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customer_profiles(customer_id)
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_identity_customer
      ON channel_identities(customer_id)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_identity_channel_identifier
      ON channel_identities(channel_type, identifier)
    `);

    // Identity merge log
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS identity_merge_log (
        id TEXT PRIMARY KEY,
        from_customer_id TEXT NOT NULL,
        to_customer_id TEXT NOT NULL,
        merged_by TEXT,
        reason TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }

  // ------------------------------------------------------------------------
  // HTTP Handler
  // ------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Resolve identity
      if (path === '/resolve' && request.method === 'POST') {
        const { channelType, identifier, orgId } = await request.json() as any;
        const result = await this.resolveIdentity(channelType, identifier, orgId);
        return Response.json(result);
      }

      // Get customer profile
      if (path === '/customer' && request.method === 'GET') {
        const customerId = url.searchParams.get('customerId');
        if (!customerId) {
          return Response.json({ error: 'customerId required' }, { status: 400 });
        }
        const profile = await this.getCustomerProfile(customerId);
        return Response.json(profile);
      }

      // Link identity to customer
      if (path === '/link' && request.method === 'POST') {
        const { customerId, channelType, identifier, displayName, metadata } = await request.json() as any;
        await this.linkIdentity(customerId, channelType, identifier, displayName, metadata);
        return Response.json({ success: true });
      }

      // Find or create customer
      if (path === '/find-or-create' && request.method === 'POST') {
        const { channelType, identifier, orgId, displayName, metadata } = await request.json() as any;
        const customer = await this.findOrCreateCustomer(channelType, identifier, orgId, displayName, metadata);
        return Response.json(customer);
      }

      // Merge customers
      if (path === '/merge' && request.method === 'POST') {
        const { fromCustomerId, toCustomerId, mergedBy } = await request.json() as any;
        await this.mergeCustomers(fromCustomerId, toCustomerId, mergedBy);
        return Response.json({ success: true });
      }

      // Update activity
      if (path === '/activity' && request.method === 'POST') {
        const { customerId, channelType } = await request.json() as any;
        await this.updateActivity(customerId, channelType);
        return Response.json({ success: true });
      }

      // Search customers
      if (path === '/search' && request.method === 'GET') {
        const query = url.searchParams.get('q');
        const orgId = url.searchParams.get('orgId');
        if (!query || !orgId) {
          return Response.json({ error: 'q and orgId required' }, { status: 400 });
        }
        const results = await this.searchCustomers(query, orgId);
        return Response.json(results);
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
      console.error('[CustomerIdentityDO] Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ------------------------------------------------------------------------
  // Identity Resolution
  // ------------------------------------------------------------------------

  /**
   * Resolve identity to customer ID
   * Returns existing customer or suggests matches
   */
  async resolveIdentity(
    channelType: string,
    identifier: string,
    orgId: string,
  ): Promise<{
    customerId?: string;
    isNew: boolean;
    matches?: IdentityMatch[];
  }> {
    // Normalize identifier
    const normalized = this.normalizeIdentifier(channelType, identifier);

    // Try exact match on identifier
    const exactMatch = this.sql.exec(
      `SELECT customer_id FROM channel_identities
       WHERE channel_type = ? AND identifier = ?
       LIMIT 1`,
      channelType,
      normalized,
    ).one();

    if (exactMatch) {
      return {
        customerId: (exactMatch as any).customer_id,
        isNew: false,
      };
    }

    // Try fuzzy matching
    const matches = await this.findMatches(channelType, normalized, orgId);

    if (matches.length > 0 && matches[0].confidence > 0.8) {
      // High confidence match - auto-link
      return {
        customerId: matches[0].customerId,
        isNew: false,
      };
    }

    // No match - return suggestions
    return {
      isNew: true,
      matches: matches.length > 0 ? matches : undefined,
    };
  }

  /**
   * Find or create customer
   */
  async findOrCreateCustomer(
    channelType: string,
    identifier: string,
    orgId: string,
    displayName?: string,
    metadata?: Record<string, any>,
  ): Promise<CustomerProfile> {
    // Check if identity already exists
    const normalized = this.normalizeIdentifier(channelType, identifier);
    const existing = this.sql.exec(
      `SELECT customer_id FROM channel_identities
       WHERE channel_type = ? AND identifier = ?
       LIMIT 1`,
      channelType,
      normalized,
    ).one();

    if (existing) {
      const customerId = (existing as any).customer_id;
      await this.updateActivity(customerId, channelType);
      return await this.getCustomerProfile(customerId);
    }

    // Try to find matches
    const matches = await this.findMatches(channelType, normalized, orgId);

    if (matches.length > 0 && matches[0].confidence > 0.8) {
      // Auto-link to high confidence match
      const customerId = matches[0].customerId;
      await this.linkIdentity(customerId, channelType, normalized, displayName, metadata);
      await this.updateActivity(customerId, channelType);
      return await this.getCustomerProfile(customerId);
    }

    // Create new customer
    return await this.createCustomer(orgId, channelType, normalized, displayName, metadata);
  }

  /**
   * Create new customer
   */
  private async createCustomer(
    orgId: string,
    channelType: string,
    identifier: string,
    displayName?: string,
    metadata?: Record<string, any>,
  ): Promise<CustomerProfile> {
    const customerId = this.generateId('customer');
    const now = Date.now();

    // Determine primary email/phone
    let primaryEmail: string | undefined;
    let primaryPhone: string | undefined;

    if (channelType === 'email') {
      primaryEmail = identifier;
    } else if (channelType === 'sms' || channelType === 'whatsapp') {
      primaryPhone = identifier;
    }

    // Create customer profile
    this.sql.exec(
      `INSERT INTO customer_profiles (
        customer_id, org_id, primary_email, primary_phone, display_name,
        first_contact_at, last_activity_at, total_messages, channel_activity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      customerId,
      orgId,
      primaryEmail || null,
      primaryPhone || null,
      displayName || null,
      now,
      now,
      0,
      JSON.stringify({}),
      now,
      now,
    );

    // Create channel identity
    await this.linkIdentity(customerId, channelType, identifier, displayName, metadata);

    return await this.getCustomerProfile(customerId);
  }

  /**
   * Link identity to customer
   */
  async linkIdentity(
    customerId: string,
    channelType: string,
    identifier: string,
    displayName?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const normalized = this.normalizeIdentifier(channelType, identifier);
    const identityId = this.generateId('identity');
    const now = Date.now();

    // Check if this is the first identity of this type for this customer
    const existingCount = this.sql.exec(
      `SELECT COUNT(*) as count FROM channel_identities
       WHERE customer_id = ? AND channel_type = ?`,
      customerId,
      channelType,
    ).one() as any;

    const isPrimary = existingCount.count === 0;

    // Insert identity
    this.sql.exec(
      `INSERT OR REPLACE INTO channel_identities (
        id, customer_id, channel_type, identifier, display_name,
        verified, is_primary, metadata, first_seen_at, last_seen_at,
        message_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      identityId,
      customerId,
      channelType,
      normalized,
      displayName || null,
      0,
      isPrimary ? 1 : 0,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now,
      0,
      now,
      now,
    );

    // Update customer primary email/phone if needed
    if (isPrimary) {
      if (channelType === 'email') {
        this.sql.exec(
          `UPDATE customer_profiles SET primary_email = ?, updated_at = ?
           WHERE customer_id = ?`,
          normalized,
          now,
          customerId,
        );
      } else if (channelType === 'sms' || channelType === 'whatsapp') {
        this.sql.exec(
          `UPDATE customer_profiles SET primary_phone = ?, updated_at = ?
           WHERE customer_id = ?`,
          normalized,
          now,
          customerId,
        );
      }
    }
  }

  /**
   * Get customer profile with all identities
   */
  async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    const row = this.sql.exec(
      `SELECT * FROM customer_profiles WHERE customer_id = ?`,
      customerId,
    ).one();

    if (!row) {
      return null;
    }

    const identities = this.sql.exec(
      `SELECT * FROM channel_identities WHERE customer_id = ?`,
      customerId,
    ).toArray() as any[];

    return this.rowToCustomerProfile(row as any, identities);
  }

  /**
   * Update activity timestamp
   */
  async updateActivity(customerId: string, channelType: string): Promise<void> {
    const now = Date.now();

    // Update customer
    const customer = this.sql.exec(
      `SELECT channel_activity FROM customer_profiles WHERE customer_id = ?`,
      customerId,
    ).one() as any;

    if (customer) {
      const channelActivity = JSON.parse(customer.channel_activity || '{}');
      channelActivity[channelType] = (channelActivity[channelType] || 0) + 1;

      this.sql.exec(
        `UPDATE customer_profiles
         SET last_activity_at = ?, total_messages = total_messages + 1,
             channel_activity = ?, updated_at = ?
         WHERE customer_id = ?`,
        now,
        JSON.stringify(channelActivity),
        now,
        customerId,
      );
    }

    // Update identity
    this.sql.exec(
      `UPDATE channel_identities
       SET last_seen_at = ?, message_count = message_count + 1, updated_at = ?
       WHERE customer_id = ? AND channel_type = ?`,
      now,
      now,
      customerId,
      channelType,
    );
  }

  /**
   * Merge two customers
   */
  async mergeCustomers(fromCustomerId: string, toCustomerId: string, mergedBy?: string): Promise<void> {
    const now = Date.now();

    // Move all identities from source to target
    this.sql.exec(
      `UPDATE channel_identities SET customer_id = ?, updated_at = ?
       WHERE customer_id = ?`,
      toCustomerId,
      now,
      fromCustomerId,
    );

    // Mark source as merged
    this.sql.exec(
      `UPDATE customer_profiles
       SET merged = 1, merged_into = ?, updated_at = ?
       WHERE customer_id = ?`,
      toCustomerId,
      now,
      fromCustomerId,
    );

    // Log merge
    this.sql.exec(
      `INSERT INTO identity_merge_log (id, from_customer_id, to_customer_id, merged_by, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      this.generateId('merge'),
      fromCustomerId,
      toCustomerId,
      mergedBy || null,
      'manual_merge',
      now,
    );
  }

  /**
   * Search customers
   */
  async searchCustomers(query: string, orgId: string): Promise<CustomerProfile[]> {
    const searchTerm = `%${query}%`;

    const rows = this.sql.exec(
      `SELECT * FROM customer_profiles
       WHERE org_id = ? AND merged = 0
       AND (display_name LIKE ? OR primary_email LIKE ? OR primary_phone LIKE ?)
       LIMIT 50`,
      orgId,
      searchTerm,
      searchTerm,
      searchTerm,
    ).toArray() as any[];

    const profiles: CustomerProfile[] = [];

    for (const row of rows) {
      const identities = this.sql.exec(
        `SELECT * FROM channel_identities WHERE customer_id = ?`,
        row.customer_id,
      ).toArray() as any[];

      profiles.push(this.rowToCustomerProfile(row, identities));
    }

    return profiles;
  }

  // ------------------------------------------------------------------------
  // Matching & Fuzzy Logic
  // ------------------------------------------------------------------------

  /**
   * Find potential matches for an identity
   */
  private async findMatches(
    channelType: string,
    identifier: string,
    orgId: string,
  ): Promise<IdentityMatch[]> {
    const matches: IdentityMatch[] = [];

    // Email matching
    if (channelType === 'email' || this.looksLikeEmail(identifier)) {
      const email = identifier.toLowerCase();
      const emailMatches = this.sql.exec(
        `SELECT * FROM customer_profiles
         WHERE org_id = ? AND merged = 0 AND primary_email = ?
         LIMIT 5`,
        orgId,
        email,
      ).toArray() as any[];

      for (const row of emailMatches) {
        matches.push({
          customerId: row.customer_id,
          confidence: 1.0,
          matchReason: 'email_exact',
          existingIdentity: {} as any, // Simplified
        });
      }
    }

    // Phone matching
    if (channelType === 'sms' || channelType === 'whatsapp' || this.looksLikePhone(identifier)) {
      const phone = this.normalizePhone(identifier);
      const phoneMatches = this.sql.exec(
        `SELECT * FROM customer_profiles
         WHERE org_id = ? AND merged = 0 AND primary_phone = ?
         LIMIT 5`,
        orgId,
        phone,
      ).toArray() as any[];

      for (const row of phoneMatches) {
        matches.push({
          customerId: row.customer_id,
          confidence: 1.0,
          matchReason: 'phone_exact',
          existingIdentity: {} as any,
        });
      }
    }

    return matches;
  }

  // ------------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------------

  /**
   * Normalize identifier based on channel type
   */
  private normalizeIdentifier(channelType: string, identifier: string): string {
    switch (channelType) {
      case 'email':
        return identifier.toLowerCase().trim();
      case 'sms':
      case 'whatsapp':
        return this.normalizePhone(identifier);
      default:
        return identifier.trim();
    }
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhone(phone: string): string {
    let normalized = phone.replace(/[^\d+]/g, '');
    if (!normalized.startsWith('+')) {
      normalized = '+1' + normalized; // Assume US
    }
    return normalized;
  }

  /**
   * Check if string looks like email
   */
  private looksLikeEmail(str: string): boolean {
    return str.includes('@') && str.includes('.');
  }

  /**
   * Check if string looks like phone
   */
  private looksLikePhone(str: string): boolean {
    const digits = str.replace(/\D/g, '');
    return digits.length >= 10;
  }

  /**
   * Convert row to CustomerProfile
   */
  private rowToCustomerProfile(row: any, identities: any[]): CustomerProfile {
    return {
      customerId: row.customer_id,
      orgId: row.org_id,
      primaryEmail: row.primary_email,
      primaryPhone: row.primary_phone,
      displayName: row.display_name,
      contactId: row.contact_id,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      customFields: row.custom_fields ? JSON.parse(row.custom_fields) : undefined,
      identities: identities.map(this.rowToChannelIdentity),
      firstContactAt: row.first_contact_at,
      lastActivityAt: row.last_activity_at,
      totalMessages: row.total_messages,
      channelActivity: JSON.parse(row.channel_activity || '{}'),
      merged: row.merged === 1,
      mergedInto: row.merged_into,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert row to ChannelIdentity
   */
  private rowToChannelIdentity(row: any): ChannelIdentity {
    return {
      id: row.id,
      customerId: row.customer_id,
      channelType: row.channel_type,
      identifier: row.identifier,
      displayName: row.display_name,
      verified: row.verified === 1,
      isPrimary: row.is_primary === 1,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
