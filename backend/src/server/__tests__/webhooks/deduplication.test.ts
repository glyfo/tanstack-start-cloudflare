/**
 * Lead Deduplication Service Tests
 *
 * Tests for checkForDuplicate, registerLead, normalizeEmail, normalizePhone, and areDuplicates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkForDuplicate,
  registerLead,
  normalizeEmail,
  normalizePhone,
  areDuplicates,
  deleteLead,
  updateLeadRegistration,
} from '../../utils/deduplication';

// Mock the logger
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Deduplication Service', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('John@Example.COM')).toBe('john@example.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  john@example.com  ')).toBe('john@example.com');
    });

    it('should remove dots from Gmail local part', () => {
      expect(normalizeEmail('j.o.h.n@gmail.com')).toBe('john@gmail.com');
    });

    it('should preserve dots in non-Gmail addresses', () => {
      expect(normalizeEmail('john.doe@company.com')).toBe('john.doe@company.com');
    });

    it('should return undefined for empty email', () => {
      expect(normalizeEmail('')).toBeUndefined();
      expect(normalizeEmail(undefined)).toBeUndefined();
    });
  });

  describe('normalizePhone', () => {
    it('should remove non-digit characters', () => {
      expect(normalizePhone('+1 (555) 123-4567')).toBe('15551234567');
    });

    it('should add country code to 10-digit numbers', () => {
      expect(normalizePhone('5551234567')).toBe('15551234567');
    });

    it('should preserve existing country code', () => {
      expect(normalizePhone('15551234567')).toBe('15551234567');
    });

    it('should handle international numbers', () => {
      expect(normalizePhone('+44 7911 123456')).toBe('447911123456');
    });

    it('should return undefined for too short numbers', () => {
      expect(normalizePhone('12345')).toBeUndefined();
    });

    it('should return undefined for empty phone', () => {
      expect(normalizePhone('')).toBeUndefined();
      expect(normalizePhone(undefined)).toBeUndefined();
    });
  });

  describe('areDuplicates', () => {
    it('should return true for matching emails', () => {
      const lead1 = { email: 'john@example.com', phone: '1111111111' };
      const lead2 = { email: 'john@example.com', phone: '2222222222' };
      expect(areDuplicates(lead1, lead2)).toBe(true);
    });

    it('should return true for matching phones', () => {
      const lead1 = { email: 'john@example.com', phone: '5551234567' };
      const lead2 = { email: 'jane@example.com', phone: '5551234567' };
      expect(areDuplicates(lead1, lead2)).toBe(true);
    });

    it('should return true for case-insensitive email match', () => {
      const lead1 = { email: 'John@Example.com' };
      const lead2 = { email: 'john@example.com' };
      expect(areDuplicates(lead1, lead2)).toBe(true);
    });

    it('should return true for Gmail with dots vs without', () => {
      const lead1 = { email: 'john.doe@gmail.com' };
      const lead2 = { email: 'johndoe@gmail.com' };
      expect(areDuplicates(lead1, lead2)).toBe(true);
    });

    it('should return true for phone with and without country code', () => {
      const lead1 = { phone: '5551234567' };
      const lead2 = { phone: '+1 555-123-4567' };
      expect(areDuplicates(lead1, lead2)).toBe(true);
    });

    it('should return false for non-matching leads', () => {
      const lead1 = { email: 'john@example.com', phone: '5551234567' };
      const lead2 = { email: 'jane@example.com', phone: '5559876543' };
      expect(areDuplicates(lead1, lead2)).toBe(false);
    });

    it('should return false when both have no contact info', () => {
      const lead1 = {};
      const lead2 = {};
      expect(areDuplicates(lead1, lead2)).toBe(false);
    });
  });

  describe('checkForDuplicate', () => {
    let mockEnv: { LEADS_KV: { get: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
      mockEnv = {
        LEADS_KV: {
          get: vi.fn(),
        },
      };
    });

    it('should return isDuplicate: true when email exists', async () => {
      mockEnv.LEADS_KV.get.mockResolvedValueOnce('existing-lead-123');

      const result = await checkForDuplicate(mockEnv, 'john@example.com', undefined, 'tiktok');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLeadId).toBe('existing-lead-123');
      expect(result.matchedOn).toBe('email');
    });

    it('should return isDuplicate: true when phone exists', async () => {
      mockEnv.LEADS_KV.get
        .mockResolvedValueOnce(null) // email not found
        .mockResolvedValueOnce('existing-lead-456'); // phone found

      const result = await checkForDuplicate(mockEnv, 'new@example.com', '5551234567', 'facebook');

      expect(result.isDuplicate).toBe(true);
      expect(result.existingLeadId).toBe('existing-lead-456');
      expect(result.matchedOn).toBe('phone');
    });

    it('should return isDuplicate: false when no match', async () => {
      mockEnv.LEADS_KV.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await checkForDuplicate(mockEnv, 'new@example.com', '5551234567', 'whatsapp');

      expect(result.isDuplicate).toBe(false);
      expect(result.existingLeadId).toBeUndefined();
    });

    it('should return isDuplicate: false when no email or phone', async () => {
      const result = await checkForDuplicate(mockEnv, undefined, undefined, 'tiktok');

      expect(result.isDuplicate).toBe(false);
      expect(mockEnv.LEADS_KV.get).not.toHaveBeenCalled();
    });

    it('should return isDuplicate: false when LEADS_KV not configured', async () => {
      const envWithoutKV = {};

      const result = await checkForDuplicate(envWithoutKV, 'john@example.com', '5551234567', 'tiktok');

      expect(result.isDuplicate).toBe(false);
    });

    it('should handle KV errors gracefully', async () => {
      mockEnv.LEADS_KV.get.mockRejectedValueOnce(new Error('KV error'));

      const result = await checkForDuplicate(mockEnv, 'john@example.com', undefined, 'tiktok');

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('registerLead', () => {
    let mockEnv: { LEADS_KV: { put: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
      mockEnv = {
        LEADS_KV: {
          put: vi.fn().mockResolvedValue(undefined),
        },
      };
    });

    it('should register lead by email', async () => {
      await registerLead(mockEnv, 'lead-123', 'john@example.com', undefined, 'tiktok');

      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledWith(
        'lead:email:john@example.com',
        'lead-123',
        { expirationTtl: 30 * 24 * 60 * 60 }
      );
    });

    it('should register lead by phone', async () => {
      await registerLead(mockEnv, 'lead-456', undefined, '5551234567', 'facebook');

      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledWith(
        'lead:phone:15551234567',
        'lead-456',
        { expirationTtl: 30 * 24 * 60 * 60 }
      );
    });

    it('should register lead by both email and phone', async () => {
      await registerLead(mockEnv, 'lead-789', 'jane@example.com', '5559876543', 'whatsapp');

      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledTimes(2);
      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledWith(
        'lead:email:jane@example.com',
        'lead-789',
        expect.any(Object)
      );
      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledWith(
        'lead:phone:15559876543',
        'lead-789',
        expect.any(Object)
      );
    });

    it('should not call KV when no email or phone', async () => {
      await registerLead(mockEnv, 'lead-000', undefined, undefined, 'tiktok');

      expect(mockEnv.LEADS_KV.put).not.toHaveBeenCalled();
    });

    it('should skip registration when LEADS_KV not configured', async () => {
      const envWithoutKV = {};

      // Should not throw
      await expect(
        registerLead(envWithoutKV, 'lead-123', 'john@example.com', undefined, 'tiktok')
      ).resolves.not.toThrow();
    });

    it('should handle KV errors gracefully', async () => {
      mockEnv.LEADS_KV.put.mockRejectedValueOnce(new Error('KV write error'));

      // Should not throw
      await expect(
        registerLead(mockEnv, 'lead-123', 'john@example.com', undefined, 'tiktok')
      ).resolves.not.toThrow();
    });
  });

  describe('deleteLead', () => {
    let mockEnv: { LEADS_KV: { delete: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
      mockEnv = {
        LEADS_KV: {
          delete: vi.fn().mockResolvedValue(undefined),
        },
      };
    });

    it('should delete lead by email', async () => {
      await deleteLead(mockEnv, 'john@example.com', undefined);

      expect(mockEnv.LEADS_KV.delete).toHaveBeenCalledWith('lead:email:john@example.com');
    });

    it('should delete lead by phone', async () => {
      await deleteLead(mockEnv, undefined, '5551234567');

      expect(mockEnv.LEADS_KV.delete).toHaveBeenCalledWith('lead:phone:15551234567');
    });

    it('should delete lead by both email and phone', async () => {
      await deleteLead(mockEnv, 'john@example.com', '5551234567');

      expect(mockEnv.LEADS_KV.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateLeadRegistration', () => {
    let mockEnv: { LEADS_KV: { put: ReturnType<typeof vi.fn> } };

    beforeEach(() => {
      mockEnv = {
        LEADS_KV: {
          put: vi.fn().mockResolvedValue(undefined),
        },
      };
    });

    it('should update registration with new lead ID', async () => {
      await updateLeadRegistration(mockEnv, 'old-lead', 'new-lead', 'john@example.com', undefined);

      expect(mockEnv.LEADS_KV.put).toHaveBeenCalledWith(
        'lead:email:john@example.com',
        'new-lead',
        expect.any(Object)
      );
    });
  });
});
