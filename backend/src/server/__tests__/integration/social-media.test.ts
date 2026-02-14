/**
 * Social Media Integration Tests
 *
 * End-to-end tests for lead capture flows across TikTok, Facebook, and WhatsApp platforms.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock cloudflare:workers before any imports that use it
vi.mock('cloudflare:workers', () => ({
  DurableObject: class DurableObject {
    ctx: any;
    env: any;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock rate limiter to avoid cloudflare imports
vi.mock('../../middleware/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientId: vi.fn().mockReturnValue('test-client'),
  rateLimitResponse: vi.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

// Mock deduplication with the actual implementation
vi.mock('../../utils/deduplication', async () => {
  const actual = await vi.importActual('../../utils/deduplication');
  return actual;
});

// Mock facebook-api
vi.mock('../../services/facebook-api', () => ({
  fetchLeadData: vi.fn().mockResolvedValue(null),
}));

// Mock opportunity workflows
vi.mock('../../workflows/opportunity-workflows', () => ({
  createOpportunityFromLead: vi.fn().mockResolvedValue({ success: true, opportunityId: 'opp-1' }),
  syncQualificationScore: vi.fn().mockResolvedValue(undefined),
}));

import {
  searchLeads,
  getLeadStats,
  indexLead,
  removeLeadFromIndex,
  exportLeadsToCSV,
  type UnifiedLead,
} from '../../services/unified-lead-service';
import {
  checkForDuplicate,
  registerLead,
  normalizeEmail,
  normalizePhone,
  areDuplicates,
} from '../../utils/deduplication';
import { verifyMetaSignature, verifyTikTokSignature } from '../../utils/webhook-verification';
import { extractContactInfo, extractBANTData } from '../../webhooks/facebook';

describe('Social Media Integration', () => {
  describe('Cross-Platform Deduplication', () => {
    it('should detect duplicate leads across TikTok and Facebook by email', () => {
      const tiktokLead = {
        email: 'john@example.com',
        phone: '5551111111',
      };

      const facebookLead = {
        email: 'john@example.com',
        phone: '5552222222',
      };

      expect(areDuplicates(tiktokLead, facebookLead)).toBe(true);
    });

    it('should detect duplicate leads across platforms by phone', () => {
      const facebookLead = {
        email: 'john@example.com',
        phone: '5551234567',
      };

      const whatsappLead = {
        email: 'different@example.com',
        phone: '+1 (555) 123-4567',
      };

      expect(areDuplicates(facebookLead, whatsappLead)).toBe(true);
    });

    it('should normalize Gmail addresses consistently', () => {
      expect(normalizeEmail('john.doe@gmail.com')).toBe('johndoe@gmail.com');
      expect(normalizeEmail('J.O.H.N.D.O.E@gmail.com')).toBe('johndoe@gmail.com');
      expect(normalizeEmail('johndoe@gmail.com')).toBe('johndoe@gmail.com');
    });

    it('should normalize phone numbers consistently across platforms', () => {
      // TikTok format
      expect(normalizePhone('+15551234567')).toBe('15551234567');
      // Facebook format
      expect(normalizePhone('(555) 123-4567')).toBe('15551234567');
      // WhatsApp format
      expect(normalizePhone('+1 555-123-4567')).toBe('15551234567');
    });
  });

  describe('Unified Lead Service', () => {
    let mockEnv: any;

    beforeEach(() => {
      const mockLeads = new Map<string, any>();

      mockEnv = {
        LEAD_INDEX_KV: {
          list: vi.fn().mockImplementation(({ prefix }) => {
            const keys = Array.from(mockLeads.keys())
              .filter((k) => k.startsWith(prefix))
              .map((name) => ({ name }));
            return { keys };
          }),
          get: vi.fn().mockImplementation((key) => mockLeads.get(key) || null),
          put: vi.fn().mockImplementation((key, value) => {
            mockLeads.set(key, JSON.parse(value));
          }),
          delete: vi.fn().mockImplementation((key) => {
            mockLeads.delete(key);
          }),
        },
        _mockLeads: mockLeads,
      };
    });

    it('should index and search leads across platforms', async () => {
      // Index TikTok lead
      await indexLead(mockEnv, 'tiktok', 'lead-1', {
        leadId: 'lead-1',
        name: 'John Doe',
        email: 'john@example.com',
        createdTime: new Date().toISOString(),
        campaignName: 'TikTok Campaign',
      });

      // Index Facebook lead
      await indexLead(mockEnv, 'facebook', 'lead-2', {
        leadId: 'lead-2',
        userDetails: {
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        createdTime: new Date().toISOString(),
        campaignName: 'Facebook Campaign',
      });

      // Search all leads
      const results = await searchLeads(mockEnv);

      expect(results.length).toBe(2);
    });

    it('should filter leads by source', async () => {
      await indexLead(mockEnv, 'tiktok', 'lead-1', {
        leadId: 'lead-1',
        name: 'John Doe',
        createdTime: new Date().toISOString(),
      });

      await indexLead(mockEnv, 'facebook', 'lead-2', {
        leadId: 'lead-2',
        userDetails: { name: 'Jane Smith' },
        createdTime: new Date().toISOString(),
      });

      const tiktokLeads = await searchLeads(mockEnv, { sources: ['tiktok'] });
      const facebookLeads = await searchLeads(mockEnv, { sources: ['facebook'] });

      expect(tiktokLeads.length).toBe(1);
      expect(facebookLeads.length).toBe(1);
    });

    it('should search leads by query', async () => {
      await indexLead(mockEnv, 'tiktok', 'lead-1', {
        leadId: 'lead-1',
        name: 'John Doe',
        email: 'john@acme.com',
        company: 'Acme Inc',
        createdTime: new Date().toISOString(),
      });

      await indexLead(mockEnv, 'facebook', 'lead-2', {
        leadId: 'lead-2',
        userDetails: {
          name: 'Jane Smith',
          email: 'jane@widgets.com',
          company: 'Widgets Co',
        },
        createdTime: new Date().toISOString(),
      });

      const acmeLeads = await searchLeads(mockEnv, { searchQuery: 'acme' });

      expect(acmeLeads.length).toBe(1);
      expect(acmeLeads[0].company).toBe('Acme Inc');
    });

    it('should remove lead from index', async () => {
      await indexLead(mockEnv, 'tiktok', 'lead-1', {
        leadId: 'lead-1',
        name: 'John Doe',
        createdTime: new Date().toISOString(),
      });

      let results = await searchLeads(mockEnv, { sources: ['tiktok'] });
      expect(results.length).toBe(1);

      await removeLeadFromIndex(mockEnv, 'tiktok', 'lead-1');

      results = await searchLeads(mockEnv, { sources: ['tiktok'] });
      expect(results.length).toBe(0);
    });

    it('should export leads to CSV', () => {
      const leads: UnifiedLead[] = [
        {
          id: 'lead-1',
          source: 'tiktok',
          timestamp: Date.now(),
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+15551234567',
          company: 'Acme Inc',
          classification: 'hot',
          qualificationScore: 85,
          campaignName: 'Summer Campaign',
          platformData: {},
        },
        {
          id: 'lead-2',
          source: 'facebook',
          timestamp: Date.now(),
          name: 'Jane Smith',
          email: 'jane@example.com',
          classification: 'warm',
          qualificationScore: 60,
          campaignName: 'Fall Campaign',
          platformData: {},
        },
      ];

      const csv = exportLeadsToCSV(leads);

      expect(csv).toContain('Source,Name,Email,Phone,Company,Classification,Score,Campaign,Date');
      expect(csv).toContain('tiktok');
      expect(csv).toContain('facebook');
      expect(csv).toContain('John Doe');
      expect(csv).toContain('Jane Smith');
    });

    it('should calculate lead statistics', async () => {
      const now = Date.now();

      await indexLead(mockEnv, 'tiktok', 'lead-1', {
        leadId: 'lead-1',
        name: 'John Doe',
        createdTime: new Date(now).toISOString(),
        classification: 'hot',
        qualificationScore: 90,
      });

      await indexLead(mockEnv, 'facebook', 'lead-2', {
        leadId: 'lead-2',
        userDetails: { name: 'Jane Smith' },
        createdTime: new Date(now - 1000).toISOString(),
        classification: 'warm',
        qualificationScore: 60,
      });

      await indexLead(mockEnv, 'whatsapp', 'lead-3', {
        conversationId: 'lead-3',
        contactName: 'Bob Wilson',
        phoneNumber: '+15551234567',
        firstMessageTime: now - 2000,
        classification: 'cold',
        qualificationScore: 30,
      });

      const stats = await getLeadStats(mockEnv);

      expect(stats.total).toBe(3);
      expect(stats.bySource.tiktok).toBe(1);
      expect(stats.bySource.facebook).toBe(1);
      expect(stats.bySource.whatsapp).toBe(1);
      expect(stats.newToday).toBe(3);
    });
  });

  describe('Webhook Signature Verification', () => {
    it('should verify and reject different platform signatures independently', async () => {
      const payload = '{"test":"data"}';
      const metaSecret = 'meta-app-secret';
      const tiktokSecret = 'tiktok-webhook-secret';

      // Generate Meta signature
      const encoder = new TextEncoder();
      const metaKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(metaSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const metaBuffer = await crypto.subtle.sign('HMAC', metaKey, encoder.encode(payload));
      const metaSignature =
        'sha256=' +
        Array.from(new Uint8Array(metaBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      // Generate TikTok signature
      const tiktokKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(tiktokSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const tiktokBuffer = await crypto.subtle.sign('HMAC', tiktokKey, encoder.encode(payload));
      const tiktokSignature = btoa(String.fromCharCode(...new Uint8Array(tiktokBuffer)));

      // Verify correct signatures pass
      expect(await verifyMetaSignature(payload, metaSignature, metaSecret)).toBe(true);
      expect(await verifyTikTokSignature(payload, tiktokSignature, tiktokSecret)).toBe(true);

      // Verify cross-verification fails
      expect(await verifyMetaSignature(payload, tiktokSignature, metaSecret)).toBe(false);
      expect(await verifyTikTokSignature(payload, metaSignature, tiktokSecret)).toBe(false);
    });
  });

  describe('Facebook Lead Field Mapping', () => {
    it('should extract BANT data from various field formats', () => {
      const customFields = {
        budget_range: '$25,000-$50,000',
        purchase_timeline: '1-3 months',
        challenge: 'Need better lead management',
        job_title: 'VP of Marketing',
      };

      const bant = extractBANTData(customFields);

      expect(bant.budget).toBeDefined();
      expect(bant.budget.range).toBe('$25,000-$50,000');

      expect(bant.timeline).toBeDefined();
      expect(bant.timeline.range).toBe('1-3 months');

      expect(bant.need).toBeDefined();
      expect(bant.need.description).toBe('Need better lead management');

      expect(bant.authority).toBeDefined();
      expect(bant.authority.role).toBe('decision_maker');
    });

    it('should map various Facebook field names to contact info', () => {
      const fieldData = [
        { name: 'full_name', values: ['John Doe'] },
        { name: 'phone_number', values: ['+15551234567'] },
        { name: 'company_name', values: ['Acme Inc'] },
        { name: 'postal_code', values: ['94102'] },
        { name: 'province', values: ['California'] },
      ];

      const contact = extractContactInfo(fieldData);

      expect(contact.name).toBe('John Doe');
      expect(contact.phone).toBe('+15551234567');
      expect(contact.company).toBe('Acme Inc');
      expect(contact.zip).toBe('94102');
      expect(contact.state).toBe('California');
    });
  });

  describe('Lead Deduplication Flow', () => {
    let mockEnv: any;

    beforeEach(() => {
      const kvStore = new Map<string, string>();

      mockEnv = {
        LEADS_KV: {
          get: vi.fn().mockImplementation((key) => kvStore.get(key) || null),
          put: vi.fn().mockImplementation((key, value) => {
            kvStore.set(key, value);
          }),
          delete: vi.fn().mockImplementation((key) => {
            kvStore.delete(key);
          }),
        },
        _kvStore: kvStore,
      };
    });

    it('should handle full deduplication flow', async () => {
      // First lead from TikTok
      const tiktokCheck = await checkForDuplicate(
        mockEnv,
        'john@example.com',
        '+15551234567',
        'tiktok'
      );
      expect(tiktokCheck.isDuplicate).toBe(false);

      // Register the TikTok lead
      await registerLead(mockEnv, 'tiktok-lead-1', 'john@example.com', '+15551234567', 'tiktok');

      // Same person submits via Facebook
      const facebookCheck = await checkForDuplicate(
        mockEnv,
        'john@example.com',
        '+15559999999',
        'facebook'
      );
      expect(facebookCheck.isDuplicate).toBe(true);
      expect(facebookCheck.existingLeadId).toBe('tiktok-lead-1');

      // Different person via WhatsApp should not be duplicate
      const whatsappCheck = await checkForDuplicate(
        mockEnv,
        'jane@example.com',
        '+15558888888',
        'whatsapp'
      );
      expect(whatsappCheck.isDuplicate).toBe(false);
    });

    it('should detect duplicates by phone even with different formatting', async () => {
      // Register lead with formatted phone
      await registerLead(mockEnv, 'lead-1', undefined, '+1 (555) 123-4567', 'tiktok');

      // Check with different format
      const check = await checkForDuplicate(mockEnv, undefined, '5551234567', 'facebook');

      expect(check.isDuplicate).toBe(true);
    });
  });

  describe('End-to-End Lead Capture Flow', () => {
    it('should process TikTok lead through full pipeline', async () => {
      // 1. Verify signature
      const payload = '{"event":"lead.create","leads":[]}';
      const secret = 'tiktok-secret';
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const isValid = await verifyTikTokSignature(payload, signature, secret);
      expect(isValid).toBe(true);

      // 2. Normalize contact data
      const email = normalizeEmail('John.Doe@gmail.com');
      const phone = normalizePhone('+1 (555) 123-4567');
      expect(email).toBe('johndoe@gmail.com');
      expect(phone).toBe('15551234567');

      // 3. Check deduplication (would use KV in real implementation)
      // Skipped for unit test - covered in deduplication tests

      // 4. Lead would be indexed (covered in unified lead service tests)
    });

    it('should process Facebook lead through full pipeline', async () => {
      // 1. Verify signature
      const payload = '{"object":"page","entry":[]}';
      const secret = 'facebook-app-secret';
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
      const signature =
        'sha256=' +
        Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

      const isValid = await verifyMetaSignature(payload, signature, secret);
      expect(isValid).toBe(true);

      // 2. Extract contact info
      const fieldData = [
        { name: 'email', values: ['jane@example.com'] },
        { name: 'first_name', values: ['Jane'] },
        { name: 'last_name', values: ['Smith'] },
        { name: 'phone_number', values: ['+15559876543'] },
        { name: 'budget', values: ['$10,000-$25,000'] },
      ];

      const contact = extractContactInfo(fieldData);
      expect(contact.email).toBe('jane@example.com');
      expect(contact.name).toBe('Jane Smith');

      // 3. Extract BANT data
      const bant = extractBANTData(contact.customFields);
      expect(bant.budget).toBeDefined();
    });
  });
});
