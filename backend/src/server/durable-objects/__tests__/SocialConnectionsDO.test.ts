/**
 * Tests for SocialConnectionsDO
 *
 * Tests all DO methods, SQL storage, encryption, and event logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock cloudflare:workers before importing SocialConnectionsDO
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(public ctx: any, public env: any) {}
  },
}));

// Mock token encryption
vi.mock('../../services/token-encryption', () => ({
  encryptToken: vi.fn().mockResolvedValue({
    encrypted: 'encrypted-token-data',
    iv: 'test-iv',
    salt: 'test-salt',
  }),
  decryptToken: vi.fn().mockResolvedValue('decrypted-token'),
  generateWebhookSecret: vi.fn().mockReturnValue('generated-webhook-secret'),
}));

import { SocialConnectionsDO } from '../SocialConnectionsDO';
import { encryptToken, decryptToken } from '../../services/token-encryption';

// Mock SQL data store for testing
class MockSqlStorage {
  private connections: Map<string, any> = new Map();
  private events: Map<string, any[]> = new Map();

  exec(query: string, ...params: any[]): { toArray: () => any[] } {
    const trimmedQuery = query.trim().toUpperCase();

    // CREATE TABLE / CREATE INDEX
    if (trimmedQuery.startsWith('CREATE')) {
      return { toArray: () => [] };
    }

    // INSERT INTO connections
    if (trimmedQuery.includes('INSERT INTO CONNECTIONS')) {
      const connection = {
        id: params[0],
        platform: params[1],
        platform_user_id: params[2],
        platform_username: params[3],
        platform_page_id: params[4],
        platform_page_name: params[5],
        access_token_encrypted: params[6],
        access_token_iv: params[7],
        access_token_salt: params[8],
        refresh_token_encrypted: params[9],
        refresh_token_iv: params[10],
        refresh_token_salt: params[11],
        scope: params[12],
        expires_at: params[13],
        status: 'active',
        last_verified_at: params[14],
        webhook_secret: params[15],
        connected_at: params[16],
        connected_by: params[17],
        updated_at: params[18],
        error_message: null,
      };
      this.connections.set(connection.platform, connection);
      return { toArray: () => [] };
    }

    // INSERT INTO connection_events
    if (trimmedQuery.includes('INSERT INTO CONNECTION_EVENTS')) {
      const event = {
        id: params[0],
        connection_id: params[1],
        event_type: params[2],
        event_data: params[3],
        created_at: Math.floor(Date.now() / 1000),
      };
      const existing = this.events.get(event.connection_id) || [];
      existing.push(event);
      this.events.set(event.connection_id, existing);
      return { toArray: () => [] };
    }

    // SELECT id FROM connections WHERE platform = ?
    if (trimmedQuery.includes('SELECT ID FROM CONNECTIONS WHERE PLATFORM')) {
      const platform = params[0];
      const conn = this.connections.get(platform);
      return { toArray: () => (conn ? [{ id: conn.id }] : []) };
    }

    // SELECT * FROM connections WHERE platform = ?
    if (trimmedQuery.includes('SELECT * FROM CONNECTIONS WHERE PLATFORM')) {
      const platform = params[0];
      const conn = this.connections.get(platform);
      return { toArray: () => (conn ? [conn] : []) };
    }

    // SELECT * FROM connections ORDER BY connected_at DESC
    if (
      trimmedQuery.includes('SELECT * FROM CONNECTIONS ORDER BY')
    ) {
      const conns = Array.from(this.connections.values());
      conns.sort((a, b) => b.connected_at - a.connected_at);
      return { toArray: () => conns };
    }

    // SELECT access_token fields
    if (trimmedQuery.includes('SELECT ACCESS_TOKEN_ENCRYPTED')) {
      const platform = params[0];
      const conn = this.connections.get(platform);
      if (conn && conn.status === 'active') {
        return {
          toArray: () => [
            {
              access_token_encrypted: conn.access_token_encrypted,
              access_token_iv: conn.access_token_iv,
              access_token_salt: conn.access_token_salt,
            },
          ],
        };
      }
      return { toArray: () => [] };
    }

    // SELECT refresh_token fields
    if (trimmedQuery.includes('SELECT REFRESH_TOKEN_ENCRYPTED')) {
      const platform = params[0];
      const conn = this.connections.get(platform);
      if (conn && conn.refresh_token_encrypted) {
        return {
          toArray: () => [
            {
              refresh_token_encrypted: conn.refresh_token_encrypted,
              refresh_token_iv: conn.refresh_token_iv,
              refresh_token_salt: conn.refresh_token_salt,
            },
          ],
        };
      }
      return { toArray: () => [] };
    }

    // SELECT webhook_secret
    if (trimmedQuery.includes('SELECT WEBHOOK_SECRET')) {
      const platform = params[0];
      const conn = this.connections.get(platform);
      return { toArray: () => (conn ? [{ webhook_secret: conn.webhook_secret }] : []) };
    }

    // SELECT * FROM connections WHERE status = 'active' AND expires_at
    if (trimmedQuery.includes('WHERE STATUS') && trimmedQuery.includes('EXPIRES_AT')) {
      const threshold = params[0];
      const conns = Array.from(this.connections.values()).filter(
        (c) => c.status === 'active' && c.expires_at !== null && c.expires_at <= threshold
      );
      conns.sort((a, b) => a.expires_at - b.expires_at);
      return { toArray: () => conns };
    }

    // SELECT * FROM connection_events
    if (trimmedQuery.includes('SELECT * FROM CONNECTION_EVENTS')) {
      const connectionId = params[0];
      const limit = params[1] || 50;
      const events = (this.events.get(connectionId) || [])
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);
      return { toArray: () => events };
    }

    // UPDATE connections SET (for token update)
    if (trimmedQuery.includes('UPDATE CONNECTIONS SET')) {
      // Find the platform in params (it's the last one)
      const platform = params[params.length - 1];
      const conn = this.connections.get(platform);

      if (conn) {
        // Handle different types of updates based on query content
        // Order matters - check more specific patterns first
        if (query.includes('platform_user_id = ?')) {
          // Full connection update (saveConnection)
          let idx = 0;
          conn.platform_user_id = params[idx++];
          conn.platform_username = params[idx++];
          conn.platform_page_id = params[idx++];
          conn.platform_page_name = params[idx++];
          conn.access_token_encrypted = params[idx++];
          conn.access_token_iv = params[idx++];
          conn.access_token_salt = params[idx++];
          conn.refresh_token_encrypted = params[idx++];
          conn.refresh_token_iv = params[idx++];
          conn.refresh_token_salt = params[idx++];
          conn.scope = params[idx++];
          conn.expires_at = params[idx++];
          conn.status = 'active';
          conn.last_verified_at = params[idx++];
          // webhook_secret handled via COALESCE, skip
          idx++;
          conn.updated_at = params[idx++];
          conn.error_message = null;
        } else if (query.includes('status = ?') && query.includes('error_message = ?')) {
          // Status update
          let idx = 0;
          conn.status = params[idx++];
          conn.error_message = params[idx++];
          conn.last_verified_at = params[idx++];
          conn.updated_at = params[idx++];
        } else if (query.includes('access_token_encrypted = ?')) {
          // Token update (updateTokens)
          let idx = 0;
          conn.access_token_encrypted = params[idx++];
          conn.access_token_iv = params[idx++];
          conn.access_token_salt = params[idx++];
          conn.expires_at = params[idx++];
          conn.last_verified_at = params[idx++];
          conn.status = 'active';
          conn.error_message = null;
        }
      }
      return { toArray: () => [] };
    }

    // DELETE FROM connections
    if (trimmedQuery.includes('DELETE FROM CONNECTIONS')) {
      const platform = params[0];
      this.connections.delete(platform);
      return { toArray: () => [] };
    }

    return { toArray: () => [] };
  }

  // Helper to clear data between tests
  clear() {
    this.connections.clear();
    this.events.clear();
  }

  // Helper to get connection count
  getConnectionCount(): number {
    return this.connections.size;
  }

  // Helper to get raw connection
  getConnection(platform: string): any {
    return this.connections.get(platform);
  }
}

// Mock Durable Object state
class MockDurableObjectState {
  storage = {
    sql: new MockSqlStorage(),
    setAlarm: vi.fn().mockResolvedValue(undefined),
  };

  id = {
    toString: () => 'test-org-id',
  };
}

describe('SocialConnectionsDO', () => {
  let socialConnectionsDO: SocialConnectionsDO;
  let mockState: MockDurableObjectState;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = new MockDurableObjectState();
    mockEnv = {
      TOKEN_ENCRYPTION_SECRET: 'test-encryption-secret',
    };
    socialConnectionsDO = new SocialConnectionsDO(mockState as any, mockEnv);
  });

  afterEach(() => {
    (mockState.storage.sql as MockSqlStorage).clear();
  });

  // ==========================================================================
  // saveConnection
  // ==========================================================================

  describe('saveConnection', () => {
    it('should create a new connection', async () => {
      const connection = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        scope: 'pages_show_list,pages_messaging',
        platformUserId: 'fb-user-123',
        platformUsername: 'Test User',
        connectedBy: 'user-456',
      });

      expect(connection).toBeDefined();
      expect(connection.platform).toBe('facebook');
      expect(connection.status).toBe('active');
      expect(connection.platformUserId).toBe('fb-user-123');
      expect(encryptToken).toHaveBeenCalled();
    });

    it('should update existing connection', async () => {
      // Create initial connection
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'old-token',
        connectedBy: 'user-1',
      });

      // Update connection
      const updated = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'new-token',
        platformUsername: 'Updated User',
        connectedBy: 'user-1',
      });

      expect(updated.platform).toBe('facebook');
      expect(updated.platformUsername).toBe('Updated User');

      // Should only be one connection
      const connections = await socialConnectionsDO.listConnections();
      expect(connections).toHaveLength(1);
    });

    it('should generate webhook secret', async () => {
      const connection = await socialConnectionsDO.saveConnection({
        platform: 'instagram',
        accessToken: 'ig-token',
        connectedBy: 'user-1',
      });

      expect(connection.webhookSecret).toBeDefined();
    });

    it('should log connection event', async () => {
      const connection = await socialConnectionsDO.saveConnection({
        platform: 'tiktok',
        accessToken: 'tt-token',
        connectedBy: 'user-1',
      });

      const events = await socialConnectionsDO.getEvents(connection.id);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('connected');
    });
  });

  // ==========================================================================
  // getConnection
  // ==========================================================================

  describe('getConnection', () => {
    it('should return connection by platform', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'fb-token',
        platformUsername: 'FB User',
        connectedBy: 'user-1',
      });

      const connection = await socialConnectionsDO.getConnection('facebook');

      expect(connection).not.toBeNull();
      expect(connection!.platform).toBe('facebook');
      expect(connection!.platformUsername).toBe('FB User');
    });

    it('should return null for non-existent connection', async () => {
      const connection = await socialConnectionsDO.getConnection('tiktok');

      expect(connection).toBeNull();
    });
  });

  // ==========================================================================
  // listConnections
  // ==========================================================================

  describe('listConnections', () => {
    it('should return all connections', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'fb-token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.saveConnection({
        platform: 'instagram',
        accessToken: 'ig-token',
        connectedBy: 'user-1',
      });

      const connections = await socialConnectionsDO.listConnections();

      expect(connections).toHaveLength(2);
    });

    it('should return empty array if no connections', async () => {
      const connections = await socialConnectionsDO.listConnections();

      expect(connections).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getAccessToken
  // ==========================================================================

  describe('getAccessToken', () => {
    it('should return decrypted access token', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'encrypted-token',
        connectedBy: 'user-1',
      });

      const token = await socialConnectionsDO.getAccessToken('facebook');

      expect(token).toBe('decrypted-token');
      expect(decryptToken).toHaveBeenCalled();
    });

    it('should return null for non-existent connection', async () => {
      const token = await socialConnectionsDO.getAccessToken('tiktok');

      expect(token).toBeNull();
    });

    it('should return null if decryption fails', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      vi.mocked(decryptToken).mockRejectedValueOnce(new Error('Decryption failed'));

      const token = await socialConnectionsDO.getAccessToken('facebook');

      expect(token).toBeNull();
    });
  });

  // ==========================================================================
  // getRefreshToken
  // ==========================================================================

  describe('getRefreshToken', () => {
    it('should return decrypted refresh token', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'tiktok',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        connectedBy: 'user-1',
      });

      const token = await socialConnectionsDO.getRefreshToken('tiktok');

      expect(token).toBe('decrypted-token');
    });

    it('should return null if no refresh token', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'access-token',
        connectedBy: 'user-1',
      });

      const token = await socialConnectionsDO.getRefreshToken('facebook');

      expect(token).toBeNull();
    });
  });

  // ==========================================================================
  // updateTokens
  // ==========================================================================

  describe('updateTokens', () => {
    it('should update access token', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'old-token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateTokens({
        platform: 'facebook',
        accessToken: 'new-token',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      });

      // Verify encryption was called for new token
      expect(encryptToken).toHaveBeenCalledWith('new-token', 'test-encryption-secret');
    });

    it('should update both access and refresh token', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'tiktok',
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateTokens({
        platform: 'tiktok',
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      });

      // Encryption should be called for both tokens
      expect(encryptToken).toHaveBeenCalledTimes(4); // 2 for save, 2 for update
    });

    it('should log token refresh event', async () => {
      const conn = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateTokens({
        platform: 'facebook',
        accessToken: 'new-token',
      });

      const events = await socialConnectionsDO.getEvents(conn.id);
      const refreshEvent = events.find((e) => e.eventType === 'token_refreshed');
      expect(refreshEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // updateStatus
  // ==========================================================================

  describe('updateStatus', () => {
    it('should update connection status', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateStatus('facebook', 'expired', 'Token expired');

      const connection = await socialConnectionsDO.getConnection('facebook');
      expect(connection!.status).toBe('expired');
      expect(connection!.errorMessage).toBe('Token expired');
    });

    it('should log status change event', async () => {
      const conn = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateStatus('facebook', 'error', 'API error');

      const events = await socialConnectionsDO.getEvents(conn.id);
      const errorEvent = events.find((e) => e.eventType === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // disconnect
  // ==========================================================================

  describe('disconnect', () => {
    it('should delete connection', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      const result = await socialConnectionsDO.disconnect('facebook');

      expect(result).toBe(true);
      const connection = await socialConnectionsDO.getConnection('facebook');
      expect(connection).toBeNull();
    });

    it('should return false for non-existent connection', async () => {
      const result = await socialConnectionsDO.disconnect('tiktok');

      expect(result).toBe(false);
    });

    it('should log disconnection event before deleting', async () => {
      const conn = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      // Save connection ID before disconnect
      const connectionId = conn.id;

      await socialConnectionsDO.disconnect('facebook');

      // Events should still exist (they're not cascade deleted in our mock)
      const events = await socialConnectionsDO.getEvents(connectionId);
      const disconnectEvent = events.find((e) => e.eventType === 'disconnected');
      expect(disconnectEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // getExpiringConnections
  // ==========================================================================

  describe('getExpiringConnections', () => {
    it('should return connections expiring within N days', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000);

      // Connection expiring in 3 days
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'fb-token',
        expiresAt: nowSeconds + 3 * 24 * 60 * 60,
        connectedBy: 'user-1',
      });

      // Connection expiring in 10 days
      await socialConnectionsDO.saveConnection({
        platform: 'instagram',
        accessToken: 'ig-token',
        expiresAt: nowSeconds + 10 * 24 * 60 * 60,
        connectedBy: 'user-1',
      });

      const expiring = await socialConnectionsDO.getExpiringConnections(7);

      expect(expiring).toHaveLength(1);
      expect(expiring[0].platform).toBe('facebook');
    });

    it('should return empty array if no expiring connections', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        connectedBy: 'user-1',
      });

      const expiring = await socialConnectionsDO.getExpiringConnections(7);

      expect(expiring).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getWebhookSecret
  // ==========================================================================

  describe('getWebhookSecret', () => {
    it('should return webhook secret', async () => {
      await socialConnectionsDO.saveConnection({
        platform: 'whatsapp',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      const secret = await socialConnectionsDO.getWebhookSecret('whatsapp');

      expect(secret).toBeDefined();
    });

    it('should return null for non-existent connection', async () => {
      const secret = await socialConnectionsDO.getWebhookSecret('facebook');

      expect(secret).toBeNull();
    });
  });

  // ==========================================================================
  // scheduleRefreshCheck
  // ==========================================================================

  describe('scheduleRefreshCheck', () => {
    it('should schedule alarm for 24 hours', async () => {
      await socialConnectionsDO.scheduleRefreshCheck();

      expect(mockState.storage.setAlarm).toHaveBeenCalled();
      const alarmTime = mockState.storage.setAlarm.mock.calls[0][0];
      const expectedTime = Date.now() + 24 * 60 * 60 * 1000;
      // Allow 1 second tolerance
      expect(Math.abs(alarmTime - expectedTime)).toBeLessThan(1000);
    });
  });

  // ==========================================================================
  // getEvents
  // ==========================================================================

  describe('getEvents', () => {
    it('should return events for a connection', async () => {
      const conn = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      await socialConnectionsDO.updateStatus('facebook', 'expired');

      const events = await socialConnectionsDO.getEvents(conn.id);

      expect(events.length).toBeGreaterThanOrEqual(2); // connected + expired
    });

    it('should return empty array for unknown connection', async () => {
      const events = await socialConnectionsDO.getEvents('unknown-id');

      expect(events).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const conn = await socialConnectionsDO.saveConnection({
        platform: 'facebook',
        accessToken: 'token',
        connectedBy: 'user-1',
      });

      // Create multiple events
      for (let i = 0; i < 5; i++) {
        await socialConnectionsDO.updateStatus('facebook', 'active');
      }

      const events = await socialConnectionsDO.getEvents(conn.id, 3);

      expect(events.length).toBeLessThanOrEqual(3);
    });
  });
});
