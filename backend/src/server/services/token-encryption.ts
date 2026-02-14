/**
 * Token Encryption Service
 *
 * Provides AES-256-GCM encryption for storing OAuth tokens securely.
 * Uses Web Crypto API with PBKDF2 key derivation.
 *
 * Security measures:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 with 100,000 iterations for key derivation
 * - Unique salt and IV per encryption
 * - Constant-time comparison for decryption verification
 */

import type { EncryptedToken } from '@/types/social-connections';

// PBKDF2 configuration
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // 128 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const KEY_LENGTH = 256; // bits

/**
 * Generate cryptographically secure random bytes
 */
function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an encryption key from a secret using PBKDF2
 */
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  // Import the secret as a raw key for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a token string using AES-256-GCM
 *
 * @param plaintext - The token to encrypt
 * @param secret - The encryption secret (from environment)
 * @returns EncryptedToken with encrypted data, IV, and salt
 */
export async function encryptToken(plaintext: string, secret: string): Promise<EncryptedToken> {
  // Generate unique salt and IV for this encryption
  const salt = generateRandomBytes(SALT_LENGTH);
  const iv = generateRandomBytes(IV_LENGTH);

  // Derive the encryption key
  const key = await deriveKey(secret, salt);

  // Encrypt the plaintext
  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plaintextBytes
  );

  // Return the encrypted data with salt and IV
  return {
    encrypted: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
    salt: uint8ArrayToBase64(salt),
  };
}

/**
 * Decrypt an encrypted token using AES-256-GCM
 *
 * @param encryptedToken - The encrypted token data
 * @param secret - The encryption secret (from environment)
 * @returns The decrypted plaintext token
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export async function decryptToken(encryptedToken: EncryptedToken, secret: string): Promise<string> {
  // Decode the base64 values
  const ciphertext = base64ToUint8Array(encryptedToken.encrypted);
  const iv = base64ToUint8Array(encryptedToken.iv);
  const salt = base64ToUint8Array(encryptedToken.salt);

  // Derive the decryption key using the same salt
  const key = await deriveKey(secret, salt);

  // Decrypt the ciphertext
  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    return new TextDecoder().decode(plaintextBuffer);
  } catch (error) {
    throw new Error('Token decryption failed: invalid key or corrupted data');
  }
}

/**
 * Encrypt an OAuth state object for passing through the OAuth flow
 *
 * @param state - The state object to encrypt
 * @param secret - The encryption secret
 * @returns Base64-encoded encrypted state
 */
export async function encryptOAuthState<T extends object>(state: T, secret: string): Promise<string> {
  const plaintext = JSON.stringify(state);
  const encrypted = await encryptToken(plaintext, secret);

  // Combine into a single string for URL transport
  const combined = JSON.stringify(encrypted);
  return btoa(combined);
}

/**
 * Decrypt an OAuth state object
 *
 * @param encryptedState - The base64-encoded encrypted state
 * @param secret - The encryption secret
 * @returns The decrypted state object
 * @throws Error if decryption fails or state is invalid
 */
export async function decryptOAuthState<T extends object>(
  encryptedState: string,
  secret: string
): Promise<T> {
  try {
    const combined = atob(encryptedState);
    const encrypted = JSON.parse(combined) as EncryptedToken;
    const plaintext = await decryptToken(encrypted, secret);
    return JSON.parse(plaintext) as T;
  } catch (error) {
    throw new Error('Invalid or expired OAuth state');
  }
}

/**
 * Generate a secure random nonce for OAuth state
 */
export function generateNonce(): string {
  const bytes = generateRandomBytes(32);
  return uint8ArrayToBase64(bytes);
}

/**
 * Generate a PKCE code verifier for OAuth 2.0 PKCE flow (used by TikTok)
 *
 * Code verifier requirements:
 * - 43-128 characters
 * - URL-safe characters only: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 */
export function generateCodeVerifier(): string {
  const bytes = generateRandomBytes(32);
  // Use URL-safe base64 encoding
  return uint8ArrayToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a PKCE code challenge from a code verifier
 *
 * Uses SHA-256 hash, then base64url encoding
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Convert to base64url
  return uint8ArrayToBase64(new Uint8Array(digest))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generate a webhook secret for verifying incoming webhook requests
 */
export function generateWebhookSecret(): string {
  const bytes = generateRandomBytes(32);
  return uint8ArrayToBase64(bytes);
}
