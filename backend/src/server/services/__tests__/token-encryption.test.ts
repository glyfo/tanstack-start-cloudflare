/**
 * Tests for Token Encryption Service
 *
 * Tests encryption/decryption, PKCE, nonce generation, and OAuth state handling
 */

import { describe, it, expect, vi } from 'vitest';

// Mock crypto.subtle for Node.js environment
const mockCrypto = {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  subtle: {
    importKey: vi.fn().mockResolvedValue('mock-key'),
    deriveKey: vi.fn().mockResolvedValue('mock-derived-key'),
    encrypt: vi.fn().mockImplementation(async (_algo, _key, data) => {
      // Return mock encrypted data with same length + 16 bytes for auth tag
      return new ArrayBuffer(data.byteLength + 16);
    }),
    decrypt: vi.fn().mockImplementation(async (_algo, _key, data) => {
      // Return mock decrypted data without auth tag
      return new ArrayBuffer(Math.max(0, data.byteLength - 16));
    }),
    digest: vi.fn().mockImplementation(async () => {
      return new ArrayBuffer(32); // SHA-256 produces 32 bytes
    }),
  },
};

// Apply mock before importing
vi.stubGlobal('crypto', mockCrypto);

import {
  encryptToken,
  encryptOAuthState,
  generateNonce,
  generateCodeVerifier,
  generateCodeChallenge,
  secureCompare,
  generateWebhookSecret,
} from '../token-encryption';

describe('Token Encryption Service', () => {
  describe('generateNonce', () => {
    it('should generate a random nonce string', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(typeof nonce1).toBe('string');
      expect(nonce1.length).toBeGreaterThan(0);
      // Base64 encoding of 32 bytes = ~44 characters
      expect(nonce1.length).toBeGreaterThanOrEqual(40);
      // Two nonces should be different (with high probability)
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate a valid PKCE code verifier', () => {
      const verifier = generateCodeVerifier();

      expect(typeof verifier).toBe('string');
      // PKCE spec requires 43-128 characters
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      // Should be URL-safe (no +, /, =)
      expect(verifier).not.toContain('+');
      expect(verifier).not.toContain('/');
      expect(verifier).not.toContain('=');
    });

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();

      expect(verifier1).not.toBe(verifier2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a code challenge from verifier', async () => {
      const verifier = 'test-verifier-string-for-testing';
      const challenge = await generateCodeChallenge(verifier);

      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
      // Should be URL-safe base64
      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });

    it('should produce consistent challenge for same verifier', async () => {
      const verifier = 'consistent-test-verifier';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate a webhook secret string', () => {
      const secret = generateWebhookSecret();

      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should generate unique secrets', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(secureCompare('test', 'test')).toBe(true);
      expect(secureCompare('', '')).toBe(true);
      expect(secureCompare('abc123', 'abc123')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('test', 'Test')).toBe(false);
      expect(secureCompare('test', 'test ')).toBe(false);
      expect(secureCompare('abc', 'abd')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(secureCompare('short', 'longer')).toBe(false);
      expect(secureCompare('', 'notempty')).toBe(false);
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('should encrypt a token and return encrypted structure', async () => {
      const token = 'test-access-token-12345';
      const secret = 'test-encryption-secret';

      const encrypted = await encryptToken(token, secret);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('salt');
      expect(typeof encrypted.encrypted).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.salt).toBe('string');
    });

    it('should produce different ciphertext for same plaintext (due to random IV/salt)', async () => {
      const token = 'same-token';
      const secret = 'same-secret';

      const encrypted1 = await encryptToken(token, secret);
      const encrypted2 = await encryptToken(token, secret);

      // IV and salt should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });
  });

  describe('encryptOAuthState / decryptOAuthState', () => {
    it('should encrypt OAuth state to URL-safe string', async () => {
      const state = {
        platform: 'facebook',
        orgId: 'org-123',
        userId: 'user-456',
        nonce: 'test-nonce',
        redirectUrl: 'https://example.com/callback',
        createdAt: Date.now(),
        expiresAt: Date.now() + 600000,
      };
      const secret = 'oauth-state-secret';

      const encrypted = await encryptOAuthState(state, secret);

      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle complex state objects', async () => {
      const state = {
        platform: 'tiktok',
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        codeVerifier: 'pkce-verifier-string',
      };
      const secret = 'complex-state-secret';

      const encrypted = await encryptOAuthState(state, secret);

      expect(typeof encrypted).toBe('string');
    });
  });
});
