/**
 * SocialConnectionsDO - Manages social media OAuth connections per organization
 *
 * Key features:
 * - True multi-tenant isolation (one DO per organization)
 * - Encrypted token storage (AES-256-GCM)
 * - Token refresh and verification
 * - Connection event logging
 * - Webhook secret management
 *
 * Storage capacity:
 * - DO SQL: 128MB per instance
 * - ~2KB per connection = 65,000 connections per org (more than enough)
 */

import { DurableObject } from 'cloudflare:workers';
import type {
  SocialPlatform,
  SocialConnection,
  ConnectionStatus,
  ConnectionEvent,
  ConnectionEventType,
  EncryptedToken,
} from '@/types/social-connections';
import {
  encryptToken,
  decryptToken,
  generateWebhookSecret,
} from '@/server/services/token-encryption';

// =============================================================================
// INTERFACES
// =============================================================================

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

interface EventRow {
  id: string;
  connection_id: string;
  event_type: string;
  event_data: string | null;
  created_at: number;
}

// =============================================================================
// DURABLE OBJECT
// =============================================================================

export class SocialConnectionsDO extends DurableObject {
  private sql: SqlStorage;
  private orgId: string;
  private encryptionSecret: string;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.orgId = ctx.id.toString();
    this.encryptionSecret = env.TOKEN_ENCRYPTION_SECRET || 'dev-encryption-secret-change-me';
    this.initializeSchema();
  }

  /**
   * Initialize SQL schema
   */
  private initializeSchema(): void {
    // Connections table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        platform TEXT NOT NULL CHECK(platform IN ('facebook', 'instagram', 'whatsapp', 'tiktok', 'gmail')),
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

        -- Webhook
        webhook_secret TEXT,

        -- Audit
        connected_at INTEGER DEFAULT (unixepoch()),
        connected_by TEXT NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()),

        UNIQUE(platform)
      )
    `);

    // Create indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_platform
      ON connections(platform)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_status
      ON connections(status)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_connections_expires
      ON connections(expires_at) WHERE expires_at IS NOT NULL
    `);

    // Connection events table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS connection_events (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        connection_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_data TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_connection
      ON connection_events(connection_id, created_at DESC)
    `);
  }

  // =============================================================================
  // RPC METHODS
  // =============================================================================

  /**
   * Create or update a connection (upsert)
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
    // Encrypt tokens
    const accessTokenEncrypted = await encryptToken(params.accessToken, this.encryptionSecret);

    let refreshTokenEncrypted: EncryptedToken | null = null;
    if (params.refreshToken) {
      refreshTokenEncrypted = await encryptToken(params.refreshToken, this.encryptionSecret);
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    // Check if connection exists
    const existing = this.sql
      .exec(`SELECT id FROM connections WHERE platform = ?`, params.platform)
      .toArray()[0] as { id: string } | undefined;

    if (existing) {
      // Update existing connection
      this.sql.exec(
        `
        UPDATE connections SET
          platform_user_id = ?,
          platform_username = ?,
          platform_page_id = ?,
          platform_page_name = ?,
          access_token_encrypted = ?,
          access_token_iv = ?,
          access_token_salt = ?,
          refresh_token_encrypted = ?,
          refresh_token_iv = ?,
          refresh_token_salt = ?,
          scope = ?,
          expires_at = ?,
          status = 'active',
          last_verified_at = ?,
          error_message = NULL,
          webhook_secret = COALESCE(webhook_secret, ?),
          updated_at = ?
        WHERE platform = ?
      `,
        params.platformUserId || null,
        params.platformUsername || null,
        params.platformPageId || null,
        params.platformPageName || null,
        accessTokenEncrypted.encrypted,
        accessTokenEncrypted.iv,
        accessTokenEncrypted.salt,
        refreshTokenEncrypted?.encrypted || null,
        refreshTokenEncrypted?.iv || null,
        refreshTokenEncrypted?.salt || null,
        params.scope || null,
        params.expiresAt || null,
        now,
        webhookSecret,
        now,
        params.platform
      );

      await this.logEvent(existing.id, 'connected', { reconnected: true });

      return (await this.getConnection(params.platform))!;
    } else {
      // Insert new connection
      this.sql.exec(
        `
        INSERT INTO connections (
          id, platform, platform_user_id, platform_username, platform_page_id, platform_page_name,
          access_token_encrypted, access_token_iv, access_token_salt,
          refresh_token_encrypted, refresh_token_iv, refresh_token_salt,
          scope, expires_at, status, last_verified_at, webhook_secret,
          connected_at, connected_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
      `,
        id,
        params.platform,
        params.platformUserId || null,
        params.platformUsername || null,
        params.platformPageId || null,
        params.platformPageName || null,
        accessTokenEncrypted.encrypted,
        accessTokenEncrypted.iv,
        accessTokenEncrypted.salt,
        refreshTokenEncrypted?.encrypted || null,
        refreshTokenEncrypted?.iv || null,
        refreshTokenEncrypted?.salt || null,
        params.scope || null,
        params.expiresAt || null,
        now,
        webhookSecret,
        now,
        params.connectedBy,
        now
      );

      await this.logEvent(id, 'connected', { new: true });

      return (await this.getConnection(params.platform))!;
    }
  }

  /**
   * Get a connection by platform
   */
  async getConnection(platform: SocialPlatform): Promise<SocialConnection | null> {
    const row = this.sql
      .exec(`SELECT * FROM connections WHERE platform = ?`, platform)
      .toArray()[0] as unknown as ConnectionRow | undefined;

    if (!row) return null;

    return this.mapRowToConnection(row);
  }

  /**
   * Get all connections
   */
  async listConnections(): Promise<SocialConnection[]> {
    const rows = this.sql
      .exec(`SELECT * FROM connections ORDER BY connected_at DESC`)
      .toArray() as unknown as ConnectionRow[];

    return rows.map((row) => this.mapRowToConnection(row));
  }

  /**
   * Get decrypted access token for a platform
   */
  async getAccessToken(platform: SocialPlatform): Promise<string | null> {
    const row = this.sql
      .exec(
        `SELECT access_token_encrypted, access_token_iv, access_token_salt
         FROM connections WHERE platform = ? AND status = 'active'`,
        platform
      )
      .toArray()[0] as Pick<
      ConnectionRow,
      'access_token_encrypted' | 'access_token_iv' | 'access_token_salt'
    > | undefined;

    if (!row) return null;

    try {
      return await decryptToken(
        {
          encrypted: row.access_token_encrypted,
          iv: row.access_token_iv,
          salt: row.access_token_salt,
        },
        this.encryptionSecret
      );
    } catch {
      return null;
    }
  }

  /**
   * Get decrypted refresh token for a platform
   */
  async getRefreshToken(platform: SocialPlatform): Promise<string | null> {
    const row = this.sql
      .exec(
        `SELECT refresh_token_encrypted, refresh_token_iv, refresh_token_salt
         FROM connections WHERE platform = ?`,
        platform
      )
      .toArray()[0] as Pick<
      ConnectionRow,
      'refresh_token_encrypted' | 'refresh_token_iv' | 'refresh_token_salt'
    > | undefined;

    if (!row || !row.refresh_token_encrypted) return null;

    try {
      return await decryptToken(
        {
          encrypted: row.refresh_token_encrypted,
          iv: row.refresh_token_iv!,
          salt: row.refresh_token_salt!,
        },
        this.encryptionSecret
      );
    } catch {
      return null;
    }
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(params: {
    platform: SocialPlatform;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }): Promise<void> {
    const accessTokenEncrypted = await encryptToken(params.accessToken, this.encryptionSecret);

    let refreshUpdate = '';
    const bindings: any[] = [
      accessTokenEncrypted.encrypted,
      accessTokenEncrypted.iv,
      accessTokenEncrypted.salt,
      params.expiresAt || null,
      Math.floor(Date.now() / 1000),
    ];

    if (params.refreshToken) {
      const refreshTokenEncrypted = await encryptToken(params.refreshToken, this.encryptionSecret);
      refreshUpdate = `, refresh_token_encrypted = ?, refresh_token_iv = ?, refresh_token_salt = ?`;
      bindings.push(
        refreshTokenEncrypted.encrypted,
        refreshTokenEncrypted.iv,
        refreshTokenEncrypted.salt
      );
    }

    bindings.push(params.platform);

    this.sql.exec(
      `
      UPDATE connections SET
        access_token_encrypted = ?,
        access_token_iv = ?,
        access_token_salt = ?,
        expires_at = ?,
        status = 'active',
        last_verified_at = ?,
        error_message = NULL,
        updated_at = unixepoch()
        ${refreshUpdate}
      WHERE platform = ?
    `,
      ...bindings
    );

    const connection = await this.getConnection(params.platform);
    if (connection) {
      await this.logEvent(connection.id, 'token_refreshed', {
        expiresAt: params.expiresAt,
      });
    }
  }

  /**
   * Update connection status
   */
  async updateStatus(
    platform: SocialPlatform,
    status: ConnectionStatus,
    errorMessage?: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    this.sql.exec(
      `
      UPDATE connections SET
        status = ?,
        error_message = ?,
        last_verified_at = ?,
        updated_at = ?
      WHERE platform = ?
    `,
      status,
      errorMessage || null,
      now,
      now,
      platform
    );

    const connection = await this.getConnection(platform);
    if (connection) {
      const eventType: ConnectionEventType =
        status === 'expired' ? 'token_expired' : status === 'error' ? 'error' : 'verified';
      await this.logEvent(connection.id, eventType, { status, errorMessage });
    }
  }

  /**
   * Disconnect a platform
   */
  async disconnect(platform: SocialPlatform): Promise<boolean> {
    const connection = await this.getConnection(platform);
    if (!connection) return false;

    await this.logEvent(connection.id, 'disconnected', {});

    this.sql.exec(`DELETE FROM connections WHERE platform = ?`, platform);

    return true;
  }

  /**
   * Get connections expiring within N days
   */
  async getExpiringConnections(days: number): Promise<SocialConnection[]> {
    const threshold = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;

    const rows = this.sql
      .exec(
        `
      SELECT * FROM connections
      WHERE status = 'active'
        AND expires_at IS NOT NULL
        AND expires_at <= ?
      ORDER BY expires_at ASC
    `,
        threshold
      )
      .toArray() as unknown as ConnectionRow[];

    return rows.map((row) => this.mapRowToConnection(row));
  }

  /**
   * Get connection events
   */
  async getEvents(
    connectionId: string,
    limit: number = 50
  ): Promise<ConnectionEvent[]> {
    const rows = this.sql
      .exec(
        `
      SELECT * FROM connection_events
      WHERE connection_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
        connectionId,
        limit
      )
      .toArray() as unknown as EventRow[];

    return rows.map((row) => ({
      id: row.id,
      connectionId: row.connection_id,
      eventType: row.event_type as ConnectionEventType,
      eventData: row.event_data ? JSON.parse(row.event_data) : undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get webhook secret for a platform
   */
  async getWebhookSecret(platform: SocialPlatform): Promise<string | null> {
    const row = this.sql
      .exec(`SELECT webhook_secret FROM connections WHERE platform = ?`, platform)
      .toArray()[0] as { webhook_secret: string | null } | undefined;

    return row?.webhook_secret || null;
  }

  // =============================================================================
  // ALARM (for scheduled token refresh)
  // =============================================================================

  /**
   * Schedule token refresh check
   */
  async scheduleRefreshCheck(): Promise<void> {
    // Schedule alarm for 24 hours from now
    const alarmTime = Date.now() + 24 * 60 * 60 * 1000;
    await this.ctx.storage.setAlarm(alarmTime);
  }

  /**
   * Handle alarm - check for expiring tokens
   */
  async alarm(): Promise<void> {
    console.log(`[SocialConnectionsDO] Running token refresh check for org: ${this.orgId}`);

    // Get connections expiring within 7 days
    const expiring = await this.getExpiringConnections(7);

    for (const connection of expiring) {
      console.log(
        `[SocialConnectionsDO] Connection ${connection.platform} expires in less than 7 days`
      );
      // Mark as needing attention (actual refresh requires env vars, done via API)
      await this.updateStatus(
        connection.platform,
        'active',
        'Token expiring soon - refresh recommended'
      );
    }

    // Schedule next check
    await this.scheduleRefreshCheck();
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private mapRowToConnection(row: ConnectionRow): SocialConnection {
    return {
      id: row.id,
      platform: row.platform as SocialPlatform,
      platformUserId: row.platform_user_id || undefined,
      platformUsername: row.platform_username || undefined,
      platformPageId: row.platform_page_id || undefined,
      platformPageName: row.platform_page_name || undefined,
      scope: row.scope || undefined,
      expiresAt: row.expires_at || undefined,
      status: row.status as ConnectionStatus,
      lastVerifiedAt: row.last_verified_at || undefined,
      errorMessage: row.error_message || undefined,
      webhookSecret: row.webhook_secret || undefined,
      connectedAt: row.connected_at,
      connectedBy: row.connected_by,
      updatedAt: row.updated_at,
    };
  }

  private async logEvent(
    connectionId: string,
    eventType: ConnectionEventType,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const id = crypto.randomUUID();
    this.sql.exec(
      `
      INSERT INTO connection_events (id, connection_id, event_type, event_data)
      VALUES (?, ?, ?, ?)
    `,
      id,
      connectionId,
      eventType,
      JSON.stringify(eventData)
    );
  }
}
