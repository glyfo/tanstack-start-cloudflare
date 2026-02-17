/**
 * ChannelGateway Durable Object
 *
 * Central routing hub for multi-channel messaging.
 * Routes messages between channels and agents using the OpenClaw pattern.
 *
 * Responsibilities:
 * - Register and manage channel adapters
 * - Route inbound messages to appropriate agents
 * - Route outbound messages to appropriate channels
 * - Manage session registry and routing rules
 * - Handle access control (allowlists, pairing)
 * - Track channel statistics
 */

import { DurableObject } from 'cloudflare:workers';
import type { ChannelAdapter } from '../channels/channel-adapter';
import type {
  ChannelType,
  ChannelConfig,
  ChannelBinding,
  MessageEnvelope,
  OutboundMessage,
  PairingRequest,
  SessionEntry,
  AccessPolicy,
  PairingStatus,
  MessageScope,
  Peer,
} from '../channels/types';
import { computeSessionKeyFromEnvelope } from '../utils/session-migration';
import { envelopeToMessage } from '../channels/envelope-converter';

// ============================================================================
// ChannelGateway DO
// ============================================================================

export class ChannelGateway extends DurableObject {
  private sql: SqlStorage;
  private adapters: Map<string, ChannelAdapter> = new Map();

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initializeSchema();
  }

  // ------------------------------------------------------------------------
  // Database Schema
  // ------------------------------------------------------------------------

  private initializeSchema(): void {
    // Channel configurations
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS channel_configs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        account_id TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        dm_policy TEXT NOT NULL,
        group_policy TEXT NOT NULL,
        text_chunk_limit INTEGER,
        chunk_mode TEXT,
        send_read_receipts INTEGER DEFAULT 0,
        settings TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_channel_configs_org
      ON channel_configs(org_id, channel_type)
    `);

    // Channel bindings (routing rules)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS channel_bindings (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_config_id TEXT NOT NULL,
        peer_id TEXT,
        conversation_id TEXT,
        scope TEXT,
        agent_id TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (channel_config_id) REFERENCES channel_configs(id)
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_channel_bindings_org
      ON channel_bindings(org_id, enabled, priority DESC)
    `);

    // Session registry
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS session_registry (
        session_key TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        scope TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        peer_data TEXT NOT NULL,
        conversation_id TEXT,
        agent_id TEXT NOT NULL,
        agent_stub_id TEXT,
        trust_tier TEXT NOT NULL DEFAULT 'dm',
        last_message_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_registry_org
      ON session_registry(org_id, channel_type)
    `);

    // Pairing requests
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS pairing_requests (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_config_id TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        peer_data TEXT NOT NULL,
        conversation_id TEXT,
        scope TEXT NOT NULL,
        first_message TEXT,
        status TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at INTEGER,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (channel_config_id) REFERENCES channel_configs(id)
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_pairing_requests_status
      ON pairing_requests(org_id, status, expires_at)
    `);

    // Channel statistics
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS channel_stats (
        channel_config_id TEXT PRIMARY KEY,
        messages_inbound INTEGER NOT NULL DEFAULT 0,
        messages_outbound INTEGER NOT NULL DEFAULT 0,
        active_sessions INTEGER NOT NULL DEFAULT 0,
        total_sessions INTEGER NOT NULL DEFAULT 0,
        pairing_pending INTEGER NOT NULL DEFAULT 0,
        pairing_approved INTEGER NOT NULL DEFAULT 0,
        pairing_rejected INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_error_at INTEGER,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        FOREIGN KEY (channel_config_id) REFERENCES channel_configs(id)
      )
    `);

    // Idempotency tracking (OpenClaw pattern)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        result TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires
      ON idempotency_keys(expires_at)
    `);

    // Message deduplication (prevent duplicate processing on retries)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS processed_messages (
        message_id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        channel_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        session_key TEXT NOT NULL,
        processed_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_expires
      ON processed_messages(expires_at)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_channel
      ON processed_messages(org_id, channel_type, sender_id)
    `);
  }

  // ------------------------------------------------------------------------
  // HTTP Handler
  // ------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route inbound message (with optional idempotency key)
      if (path === '/route-inbound' && request.method === 'POST') {
        const { envelope, idempotencyKey } = await request.json() as { envelope: MessageEnvelope; idempotencyKey?: string };
        const result = await this.routeInbound(envelope, idempotencyKey);
        return Response.json(result);
      }

      // Route outbound message
      if (path === '/route-outbound' && request.method === 'POST') {
        const message = await request.json() as OutboundMessage;
        await this.routeOutbound(message);
        return Response.json({ success: true });
      }

      // Get or create session
      if (path === '/session' && request.method === 'POST') {
        const envelope = await request.json() as MessageEnvelope;
        const session = await this.getOrCreateSession(envelope);
        return Response.json(session);
      }

      // Approve pairing request
      if (path === '/approve-pairing' && request.method === 'POST') {
        const { pairingId, reviewedBy } = await request.json() as any;
        await this.approvePairing(pairingId, reviewedBy);
        return Response.json({ success: true });
      }

      // Reject pairing request
      if (path === '/reject-pairing' && request.method === 'POST') {
        const { pairingId, reviewedBy } = await request.json() as any;
        await this.rejectPairing(pairingId, reviewedBy);
        return Response.json({ success: true });
      }

      // Get channel stats (single config)
      if (path === '/stats' && request.method === 'GET') {
        const configId = url.searchParams.get('configId');
        if (!configId) {
          return Response.json({ error: 'configId required' }, { status: 400 });
        }
        const stats = await this.getChannelStats(configId);
        return Response.json(stats);
      }

      // Get ALL channel stats (aggregated)
      if (path === '/all-stats' && request.method === 'GET') {
        const orgId = url.searchParams.get('orgId');
        if (!orgId) {
          return Response.json({ error: 'orgId required' }, { status: 400 });
        }
        const stats = await this.getAllChannelStats(orgId);
        return Response.json({ channels: stats });
      }

      // List pairing requests
      if (path === '/pairing-requests' && request.method === 'GET') {
        const orgId = url.searchParams.get('orgId');
        const status = url.searchParams.get('status') || 'pending';
        if (!orgId) {
          return Response.json({ error: 'orgId required' }, { status: 400 });
        }
        const requests = await this.listPairingRequests(orgId, status as PairingStatus);
        return Response.json({ requests });
      }

      // Register channel config
      if (path === '/register-config' && request.method === 'POST') {
        const config = await request.json() as ChannelConfig;
        await this.registerChannelConfig(config);
        return Response.json({ success: true });
      }

      // Create binding
      if (path === '/create-binding' && request.method === 'POST') {
        const binding = await request.json() as ChannelBinding;
        await this.createBinding(binding);
        return Response.json({ success: true });
      }

      return Response.json({ error: 'Not found' }, { status: 404 });
    } catch (error: any) {
      console.error('ChannelGateway error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ------------------------------------------------------------------------
  // Inbound Routing
  // ------------------------------------------------------------------------

  /**
   * Route inbound message to appropriate agent
   * OpenClaw pattern: Idempotent message routing with deduplication
   */
  async routeInbound(envelope: MessageEnvelope, idempotencyKey?: string): Promise<{ sessionKey: string; agentId: string; customerId?: string }> {
    const orgId = envelope.orgId;

    // STEP 0a: Check idempotency (OpenClaw pattern for safe retries)
    if (idempotencyKey) {
      const existing = await this.checkIdempotency(idempotencyKey, orgId);
      if (existing) {
        console.log('[ChannelGateway] Idempotent request - returning cached result');
        return existing;
      }
    }

    // STEP 0b: Check message deduplication (prevent duplicate processing)
    if (envelope.messageId) {
      const isDuplicate = await this.isDuplicateMessage(envelope);
      if (isDuplicate) {
        console.log('[ChannelGateway] Duplicate message detected - skipping processing');
        throw new Error('Message already processed (duplicate)');
      }
    }

    // STEP 1: Resolve customer identity (cross-channel linking)
    let customerId: string | undefined;
    try {
      const identityResult = await this.resolveCustomerIdentity(envelope);
      customerId = identityResult.customerId;

      // Enrich envelope with customer ID
      if (!envelope.channelMetadata) {
        envelope.channelMetadata = {};
      }
      envelope.channelMetadata.customerId = customerId;
      envelope.channelMetadata.isNewCustomer = identityResult.isNew;
    } catch (error) {
      console.error('[ChannelGateway] Error resolving customer identity:', error);
      // Continue without customer ID - non-critical
    }

    // STEP 2: Check access control
    const accessGranted = await this.checkAccess(envelope);
    if (!accessGranted) {
      // Create pairing request if policy allows
      await this.handlePairing(envelope);
      throw new Error('Access denied: pairing required');
    }

    // STEP 3: Resolve routing binding
    const binding = await this.resolveBinding(envelope);
    if (!binding) {
      throw new Error('No routing binding found for message');
    }

    // Get or create session
    const session = await this.getOrCreateSession(envelope, binding);

    // Get agent DO stub
    const agentStub = await this.getAgentStub(binding.agentId, session.sessionKey);

    // Convert envelope to message format
    const message = envelopeToMessage(envelope);

    // Send to agent
    const response = await agentStub.fetch('http://internal/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        envelope,
        message,
        sessionKey: session.sessionKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent returned error: ${response.statusText}`);
    }

    // Update stats
    await this.incrementStat(binding.channelConfigId, 'messages_inbound');

    const result = {
      sessionKey: session.sessionKey,
      agentId: binding.agentId,
      customerId,
    };

    // Store idempotency result (OpenClaw pattern)
    if (idempotencyKey) {
      await this.storeIdempotency(idempotencyKey, orgId, envelope.channelType, 'route-inbound', result);
    }

    // Mark message as processed (deduplication)
    if (envelope.messageId) {
      await this.markMessageProcessed(envelope, result.sessionKey);
    }

    return result;
  }

  /**
   * Resolve customer identity from message envelope
   */
  private async resolveCustomerIdentity(envelope: MessageEnvelope): Promise<{ customerId: string; isNew: boolean }> {
    const env = (this as any).env;

    if (!env.CUSTOMER_IDENTITY) {
      // CustomerIdentityDO not available - skip
      return { customerId: envelope.sender.id, isNew: false };
    }

    try {
      // Get CustomerIdentityDO
      const id = env.CUSTOMER_IDENTITY.idFromName(envelope.orgId);
      const identityDO = env.CUSTOMER_IDENTITY.get(id);

      // Find or create customer
      const response = await identityDO.fetch('http://internal/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelType: envelope.channelType,
          identifier: envelope.sender.id,
          orgId: envelope.orgId,
          displayName: envelope.sender.displayName,
          metadata: envelope.sender.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve identity');
      }

      const customer = await response.json() as any;

      return {
        customerId: customer.customerId,
        isNew: customer.identities.length === 1 && customer.totalMessages === 0,
      };
    } catch (error) {
      console.error('[ChannelGateway] Error resolving identity:', error);
      // Fallback to sender ID
      return { customerId: envelope.sender.id, isNew: false };
    }
  }

  /**
   * Route outbound message to appropriate channel
   */
  async routeOutbound(message: OutboundMessage): Promise<void> {
    // Get adapter for channel type
    const adapterKey = `${message.orgId}:${message.channelType}`;
    const adapter = this.adapters.get(adapterKey);

    if (!adapter) {
      throw new Error(`No adapter registered for ${message.channelType}`);
    }

    // Send via adapter
    await adapter.send(message);

    // Update stats
    const config = await this.getChannelConfig(message.orgId, message.channelType);
    if (config) {
      await this.incrementStat(config.id, 'messages_outbound');
    }
  }

  // ------------------------------------------------------------------------
  // Access Control
  // ------------------------------------------------------------------------

  /**
   * Check if message sender has access
   */
  private async checkAccess(envelope: MessageEnvelope): Promise<boolean> {
    const config = await this.getChannelConfig(envelope.orgId, envelope.channelType);
    if (!config || !config.enabled) {
      return false;
    }

    // Determine policy based on scope
    const policy = envelope.scope === 'dm' ? config.dmPolicy : config.groupPolicy;

    switch (policy) {
      case 'open':
        return true;

      case 'allowlist': {
        // Check if sender is in allowlist (has existing binding)
        const binding = await this.findBindingForPeer(envelope);
        return binding !== null;
      }

      case 'pairing': {
        // Check if pairing is approved
        const pairing = await this.findApprovedPairing(envelope);
        return pairing !== null;
      }

      case 'closed':
        return false;

      default:
        return false;
    }
  }

  /**
   * Handle pairing flow for unknown senders
   */
  private async handlePairing(envelope: MessageEnvelope): Promise<void> {
    const config = await this.getChannelConfig(envelope.orgId, envelope.channelType);
    if (!config) {
      throw new Error('Channel config not found');
    }

    // Check if pairing request already exists
    const existingPairing = await this.findPendingPairing(envelope);
    if (existingPairing) {
      return; // Already requested
    }

    // Create pairing request
    const pairingId = this.generateId('pairing');
    const now = Date.now();

    this.sql.exec(
      `INSERT INTO pairing_requests (
        id, org_id, channel_config_id, peer_id, peer_data,
        conversation_id, scope, first_message, status,
        expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      pairingId,
      envelope.orgId,
      config.id,
      envelope.sender.id,
      JSON.stringify(envelope.sender),
      envelope.conversationId || null,
      envelope.scope,
      envelope.text,
      'pending',
      now + 7 * 24 * 60 * 60 * 1000, // Expire in 7 days
      now,
      now,
    );

    // Increment stat
    await this.incrementStat(config.id, 'pairing_pending');

    // TODO: Notify admin dashboard
  }

  // ------------------------------------------------------------------------
  // Pairing Management
  // ------------------------------------------------------------------------

  async approvePairing(pairingId: string, reviewedBy: string): Promise<void> {
    const now = Date.now();

    // Update pairing status
    this.sql.exec(
      `UPDATE pairing_requests
       SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ? AND status = ?`,
      'approved',
      reviewedBy,
      now,
      now,
      pairingId,
      'pending',
    );

    // Get pairing details
    const pairing = this.sql.exec(
      `SELECT * FROM pairing_requests WHERE id = ?`,
      pairingId,
    ).one() as any;

    if (!pairing) {
      throw new Error('Pairing request not found');
    }

    // Update stats
    const config = await this.getChannelConfigById(pairing.channel_config_id);
    if (config) {
      await this.incrementStat(config.id, 'pairing_approved');
      await this.decrementStat(config.id, 'pairing_pending');
    }
  }

  async rejectPairing(pairingId: string, reviewedBy: string): Promise<void> {
    const now = Date.now();

    this.sql.exec(
      `UPDATE pairing_requests
       SET status = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ? AND status = ?`,
      'rejected',
      reviewedBy,
      now,
      now,
      pairingId,
      'pending',
    );

    // Update stats
    const pairing = this.sql.exec(
      `SELECT * FROM pairing_requests WHERE id = ?`,
      pairingId,
    ).one() as any;

    if (pairing) {
      const config = await this.getChannelConfigById(pairing.channel_config_id);
      if (config) {
        await this.incrementStat(config.id, 'pairing_rejected');
        await this.decrementStat(config.id, 'pairing_pending');
      }
    }
  }

  // ------------------------------------------------------------------------
  // Routing Resolution
  // ------------------------------------------------------------------------

  /**
   * Resolve routing binding for envelope
   */
  private async resolveBinding(envelope: MessageEnvelope): Promise<ChannelBinding | null> {
    const bindings = this.sql.exec(
      `SELECT * FROM channel_bindings
       WHERE org_id = ? AND enabled = 1
       ORDER BY priority DESC`,
      envelope.orgId,
    ).toArray() as any[];

    for (const row of bindings) {
      // Check peer match (if specified)
      if (row.peer_id && row.peer_id !== envelope.sender.id) {
        continue;
      }

      // Check conversation match (if specified)
      if (row.conversation_id && row.conversation_id !== envelope.conversationId) {
        continue;
      }

      // Check scope match (if specified)
      if (row.scope && row.scope !== envelope.scope) {
        continue;
      }

      // Found match
      return this.rowToBinding(row);
    }

    return null;
  }

  /**
   * Find binding for specific peer
   */
  private async findBindingForPeer(envelope: MessageEnvelope): Promise<ChannelBinding | null> {
    const row = this.sql.exec(
      `SELECT * FROM channel_bindings
       WHERE org_id = ? AND peer_id = ? AND enabled = 1
       LIMIT 1`,
      envelope.orgId,
      envelope.sender.id,
    ).one();

    return row ? this.rowToBinding(row as any) : null;
  }

  // ------------------------------------------------------------------------
  // Session Management
  // ------------------------------------------------------------------------

  /**
   * Get or create session for envelope
   */
  private async getOrCreateSession(
    envelope: MessageEnvelope,
    binding?: ChannelBinding,
  ): Promise<SessionEntry> {
    const sessionKey = computeSessionKeyFromEnvelope(envelope);

    // Try to get existing session
    const row = this.sql.exec(
      `SELECT * FROM session_registry WHERE session_key = ?`,
      sessionKey,
    ).one();

    if (row) {
      // Update existing session
      this.sql.exec(
        `UPDATE session_registry
         SET last_message_at = ?, message_count = message_count + 1, updated_at = ?
         WHERE session_key = ?`,
        envelope.timestamp,
        Date.now(),
        sessionKey,
      );

      return this.rowToSession(row as any);
    }

    // Create new session
    const now = Date.now();
    const agentId = binding?.agentId || 'default-chat-agent';

    // Determine trust tier (OpenClaw security model)
    const trustTier = this.determineTrustTier(envelope);

    this.sql.exec(
      `INSERT INTO session_registry (
        session_key, org_id, channel_type, scope, peer_id, peer_data,
        conversation_id, agent_id, trust_tier, last_message_at, message_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionKey,
      envelope.orgId,
      envelope.channelType,
      envelope.scope,
      envelope.sender.id,
      JSON.stringify(envelope.sender),
      envelope.conversationId || null,
      agentId,
      trustTier,
      envelope.timestamp,
      1,
      now,
      now,
    );

    // Increment total sessions
    const config = await this.getChannelConfig(envelope.orgId, envelope.channelType);
    if (config) {
      await this.incrementStat(config.id, 'total_sessions');
      await this.incrementStat(config.id, 'active_sessions');
    }

    return {
      sessionKey,
      orgId: envelope.orgId,
      channelType: envelope.channelType,
      scope: envelope.scope,
      peer: envelope.sender,
      conversationId: envelope.conversationId,
      agentId,
      trustTier,
      lastMessageAt: envelope.timestamp,
      messageCount: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Determine session trust tier (OpenClaw security model)
   * - operator: Full access (main sessions, admin users)
   * - dm: Sandboxed (direct messages)
   * - group: Sandboxed (group chats)
   */
  private determineTrustTier(envelope: MessageEnvelope): string {
    // Check if this is an operator session (admin/internal)
    // WebSocket connections from the main UI are trusted
    if (envelope.channelType === 'websocket') {
      return 'operator';
    }

    // Group sessions (using MessageScope enum)
    if (envelope.scope === 'group') {
      return 'group';
    }

    // Default: DM (most restrictive for external channels)
    return 'dm';
  }

  // ------------------------------------------------------------------------
  // Channel Configuration
  // ------------------------------------------------------------------------

  async registerChannelConfig(config: ChannelConfig): Promise<void> {
    const now = Date.now();

    this.sql.exec(
      `INSERT OR REPLACE INTO channel_configs (
        id, org_id, channel_type, account_id, enabled,
        dm_policy, group_policy, text_chunk_limit, chunk_mode,
        send_read_receipts, settings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      config.id,
      config.orgId,
      config.channelType,
      config.accountId,
      config.enabled ? 1 : 0,
      config.dmPolicy,
      config.groupPolicy,
      config.textChunkLimit || null,
      config.chunkMode || null,
      config.sendReadReceipts ? 1 : 0,
      JSON.stringify(config.settings),
      config.createdAt || now,
      now,
    );

    // Initialize stats
    this.sql.exec(
      `INSERT OR IGNORE INTO channel_stats (
        channel_config_id, period_start, period_end
      ) VALUES (?, ?, ?)`,
      config.id,
      now,
      now,
    );
  }

  async createBinding(binding: ChannelBinding): Promise<void> {
    const now = Date.now();

    this.sql.exec(
      `INSERT INTO channel_bindings (
        id, org_id, channel_config_id, peer_id, conversation_id, scope,
        agent_id, agent_type, priority, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      binding.id,
      binding.orgId,
      binding.channelConfigId,
      binding.peer?.id || null,
      binding.conversationId || null,
      binding.scope || null,
      binding.agentId,
      binding.agentType,
      binding.priority,
      binding.enabled ? 1 : 0,
      binding.createdAt || now,
      now,
    );
  }

  // ------------------------------------------------------------------------
  // Helper Methods
  // ------------------------------------------------------------------------

  private async getChannelConfig(orgId: string, channelType: ChannelType): Promise<ChannelConfig | null> {
    const row = this.sql.exec(
      `SELECT * FROM channel_configs
       WHERE org_id = ? AND channel_type = ? AND enabled = 1
       LIMIT 1`,
      orgId,
      channelType,
    ).one();

    return row ? this.rowToConfig(row as any) : null;
  }

  private async getChannelConfigById(configId: string): Promise<ChannelConfig | null> {
    const row = this.sql.exec(
      `SELECT * FROM channel_configs WHERE id = ?`,
      configId,
    ).one();

    return row ? this.rowToConfig(row as any) : null;
  }

  private async findPendingPairing(envelope: MessageEnvelope): Promise<PairingRequest | null> {
    const row = this.sql.exec(
      `SELECT * FROM pairing_requests
       WHERE org_id = ? AND peer_id = ? AND status = ?
       LIMIT 1`,
      envelope.orgId,
      envelope.sender.id,
      'pending',
    ).one();

    return row ? this.rowToPairing(row as any) : null;
  }

  private async findApprovedPairing(envelope: MessageEnvelope): Promise<PairingRequest | null> {
    const row = this.sql.exec(
      `SELECT * FROM pairing_requests
       WHERE org_id = ? AND peer_id = ? AND status = ?
       LIMIT 1`,
      envelope.orgId,
      envelope.sender.id,
      'approved',
    ).one();

    return row ? this.rowToPairing(row as any) : null;
  }

  private async getChannelStats(configId: string): Promise<any> {
    const row = this.sql.exec(
      `SELECT * FROM channel_stats WHERE channel_config_id = ?`,
      configId,
    ).one();

    return row || null;
  }

  /**
   * Get aggregated stats for all channels in an organization
   */
  async getAllChannelStats(orgId: string): Promise<any[]> {
    const rows = this.sql.exec(
      `SELECT
        c.channel_type,
        c.enabled,
        COALESCE(s.messages_inbound, 0) as messagesInbound,
        COALESCE(s.messages_outbound, 0) as messagesOutbound,
        COALESCE(s.active_sessions, 0) as activeSessions,
        COALESCE(s.total_sessions, 0) as totalSessions,
        COALESCE(s.error_count, 0) as errorCount,
        s.last_error as lastError,
        s.last_error_at as lastActivity
      FROM channel_configs c
      LEFT JOIN channel_stats s ON s.channel_config_id = c.id
      WHERE c.org_id = ?
      ORDER BY c.channel_type`,
      orgId,
    ).toArray();

    return rows.map((row: any) => ({
      channelType: row.channel_type,
      enabled: row.enabled === 1,
      messagesInbound: row.messagesInbound || 0,
      messagesOutbound: row.messagesOutbound || 0,
      activeSessions: row.activeSessions || 0,
      totalSessions: row.totalSessions || 0,
      errorCount: row.errorCount || 0,
      lastError: row.lastError,
      lastActivity: row.lastActivity,
    }));
  }

  /**
   * List pairing requests by status
   */
  async listPairingRequests(orgId: string, status: PairingStatus): Promise<PairingRequest[]> {
    const rows = this.sql.exec(
      `SELECT * FROM pairing_requests
       WHERE org_id = ? AND status = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      orgId,
      status,
    ).toArray();

    return rows.map((row: any) => this.rowToPairing(row));
  }

  private async incrementStat(configId: string, field: string): Promise<void> {
    this.sql.exec(
      `UPDATE channel_stats SET ${field} = ${field} + 1 WHERE channel_config_id = ?`,
      configId,
    );
  }

  private async decrementStat(configId: string, field: string): Promise<void> {
    this.sql.exec(
      `UPDATE channel_stats SET ${field} = MAXIMUM(${field} - 1, 0) WHERE channel_config_id = ?`,
      configId,
    );
  }

  private async getAgentStub(agentId: string, sessionKey: string): Promise<DurableObjectStub> {
    // Get agent DO stub (assumes CHAT_AGENT binding in env)
    const env = (this as any).env;
    if (!env.CHAT_AGENT) {
      throw new Error('CHAT_AGENT binding not found');
    }

    const id = env.CHAT_AGENT.idFromName(sessionKey);
    return env.CHAT_AGENT.get(id);
  }

  // ------------------------------------------------------------------------
  // Idempotency Support (OpenClaw Pattern)
  // ------------------------------------------------------------------------

  /**
   * Check if operation was already processed
   * Returns cached result if found within TTL
   */
  private async checkIdempotency(key: string, orgId: string): Promise<any | null> {
    const now = Date.now();

    // Clean up expired keys periodically
    if (Math.random() < 0.01) { // 1% chance per call
      this.sql.exec(
        `DELETE FROM idempotency_keys WHERE expires_at < ?`,
        now,
      );
    }

    const row = this.sql.exec(
      `SELECT result FROM idempotency_keys
       WHERE key = ? AND org_id = ? AND expires_at > ?`,
      key,
      orgId,
      now,
    ).one();

    if (row) {
      return JSON.parse((row as any).result);
    }

    return null;
  }

  /**
   * Store operation result for idempotency
   * TTL: 24 hours (OpenClaw pattern)
   */
  private async storeIdempotency(
    key: string,
    orgId: string,
    channelType: string,
    operation: string,
    result: any,
  ): Promise<void> {
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours

    this.sql.exec(
      `INSERT OR REPLACE INTO idempotency_keys (
        key, org_id, channel_type, operation, result, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      key,
      orgId,
      channelType,
      operation,
      JSON.stringify(result),
      now,
      now + ttl,
    );
  }

  // ------------------------------------------------------------------------
  // Message Deduplication (OpenClaw Pattern)
  // ------------------------------------------------------------------------

  /**
   * Check if message has already been processed
   * Prevents duplicate processing when channels retry delivery
   */
  private async isDuplicateMessage(envelope: MessageEnvelope): Promise<boolean> {
    const now = Date.now();

    // Clean up expired entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.sql.exec(
        `DELETE FROM processed_messages WHERE expires_at < ?`,
        now,
      );
    }

    const row = this.sql.exec(
      `SELECT message_id FROM processed_messages
       WHERE message_id = ? AND org_id = ? AND expires_at > ?`,
      envelope.messageId,
      envelope.orgId,
      now,
    ).one();

    return row !== null;
  }

  /**
   * Mark message as processed
   * TTL: 24 hours (matches idempotency TTL)
   */
  private async markMessageProcessed(envelope: MessageEnvelope, sessionKey: string): Promise<void> {
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours

    this.sql.exec(
      `INSERT OR IGNORE INTO processed_messages (
        message_id, org_id, channel_type, sender_id, session_key,
        processed_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      envelope.messageId,
      envelope.orgId,
      envelope.channelType,
      envelope.sender.id,
      sessionKey,
      now,
      now + ttl,
    );
  }

  // ------------------------------------------------------------------------
  // Row Converters
  // ------------------------------------------------------------------------

  private rowToConfig(row: any): ChannelConfig {
    return {
      id: row.id,
      orgId: row.org_id,
      channelType: row.channel_type,
      accountId: row.account_id,
      enabled: row.enabled === 1,
      dmPolicy: row.dm_policy,
      groupPolicy: row.group_policy,
      textChunkLimit: row.text_chunk_limit,
      chunkMode: row.chunk_mode,
      sendReadReceipts: row.send_read_receipts === 1,
      settings: JSON.parse(row.settings),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToBinding(row: any): ChannelBinding {
    return {
      id: row.id,
      orgId: row.org_id,
      channelConfigId: row.channel_config_id,
      peer: row.peer_id ? { id: row.peer_id } as Peer : undefined,
      conversationId: row.conversation_id,
      scope: row.scope,
      agentId: row.agent_id,
      agentType: row.agent_type,
      priority: row.priority,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToSession(row: any): SessionEntry {
    return {
      sessionKey: row.session_key,
      orgId: row.org_id,
      channelType: row.channel_type,
      scope: row.scope,
      peer: JSON.parse(row.peer_data),
      conversationId: row.conversation_id,
      agentId: row.agent_id,
      agentStubId: row.agent_stub_id,
      lastMessageAt: row.last_message_at,
      messageCount: row.message_count,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToPairing(row: any): PairingRequest {
    return {
      id: row.id,
      orgId: row.org_id,
      channelConfigId: row.channel_config_id,
      peer: JSON.parse(row.peer_data),
      conversationId: row.conversation_id,
      scope: row.scope,
      firstMessage: row.first_message,
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
