// Lightweight client-side E2EE helper for direct messages.
// - Keys are generated and stored locally per (profileType + sorted participants)
// - Outgoing encrypted messages are wrapped as: E2EE:v1:<ciphertext>
// - One-time key share messages are wrapped as: E2EESHARE:v1:<base64Key>
// - Import/export supported per-conversation

import CryptoJS from 'crypto-js';

type ProfileType = 'basic' | 'love' | 'business';

const E2EE_PREFIX = 'E2EE:v1:';
const E2EE_SHARE_PREFIX = 'E2EESHARE:v1:';
const E2EE_DISABLE_PREFIX = 'E2EEDISABLE:v1';
const E2EE_INFO_PREFIX = 'E2EEINFO:v1:'; // E2EEINFO:v1:enabled|disabled

// Storage keys
const enabledKey = (keyId: string): string => `e2ee:enabled:${keyId}`;
const secretKey = (keyId: string): string => `e2ee:key:${keyId}`;

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export interface ExportedKey {
  keyId: string;
  profileType: ProfileType;
  participants: [string, string];
  key: string; // base64 random secret used as passphrase for CryptoJS AES
  createdAt: string; // ISO timestamp
  version: 1;
}

export const e2ee = {
  getKeyId(profileType: ProfileType, me: string, other: string): string {
    const [a, b] = sortedPair(me, other);
    return `dm:${profileType}:${a}:${b}`;
  },

  // Internal: migrate old or malformed values in localStorage for a given keyId
  // - enabled flag previously may have been stored as 'true' instead of '1'
  // - key must be valid base64; if not, it's removed to avoid decryption traps
  // This runs opportunistically from getters so callers don't need to invoke it explicitly.
  _migrate(keyId: string): void {
    if (typeof window === 'undefined') return;
    try {
      const enabledRaw = window.localStorage.getItem(enabledKey(keyId));
      if (enabledRaw && enabledRaw !== '1') {
        if (enabledRaw === 'true' || enabledRaw === 'yes') {
          window.localStorage.setItem(enabledKey(keyId), '1');
        } else {
          // Unknown value: normalize by removing
          window.localStorage.removeItem(enabledKey(keyId));
        }
      }
      const k = window.localStorage.getItem(secretKey(keyId));
      if (k) {
        // Validate base64 key; if invalid, remove to prevent persistent failures
        try {
          // Will throw if invalid base64
          const parsed = CryptoJS.enc.Base64.parse(k);
          // Optionally ensure non-empty
          if (!parsed || parsed.sigBytes <= 0) {
            window.localStorage.removeItem(secretKey(keyId));
          }
        } catch {
          window.localStorage.removeItem(secretKey(keyId));
        }
      }
    } catch {
      // ignore storage errors
    }
  },

  isEnabled(keyId: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
  this._migrate(keyId);
  return window.localStorage.getItem(enabledKey(keyId)) === '1';
    } catch {
      return false;
    }
  },

  setEnabled(keyId: string, enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      if (enabled) window.localStorage.setItem(enabledKey(keyId), '1');
      else window.localStorage.removeItem(enabledKey(keyId));
    } catch {
      // ignore storage errors
    }
  },

  deleteKey(keyId: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(secretKey(keyId));
      window.localStorage.removeItem(enabledKey(keyId));
    } catch {
      // ignore storage errors
    }
  },

  hasKey(keyId: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return !!window.localStorage.getItem(secretKey(keyId));
    } catch {
      return false;
    }
  },

  getKey(keyId: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
  this._migrate(keyId);
  return window.localStorage.getItem(secretKey(keyId));
    } catch {
      return null;
    }
  },

  saveKey(keyId: string, key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(secretKey(keyId), key);
    } catch {
      // ignore
    }
  },

  generateKey(): string {
    // 32 random bytes -> base64
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      // Convert to base64
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return typeof btoa === 'function' ? btoa(bin) : CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(bin));
    }
    // Fallback
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Base64);
  },

  // Wrap plaintext into an E2EE envelope if enabled and key exists.
  encryptIfEnabled(keyId: string, plaintext: string): string {
    const key = this.getKey(keyId);
    if (!key || !this.isEnabled(keyId)) return plaintext;
    try {
      const cipher = CryptoJS.AES.encrypt(plaintext, key).toString();
      return `${E2EE_PREFIX}${cipher}`;
    } catch {
      return plaintext; // fail open
    }
  },

  // Decrypt if the content is an E2EE envelope; otherwise return the original content.
  decryptIfEnvelope(keyId: string, content: string): { ok: boolean; text: string } {
    if (!content || !content.startsWith(E2EE_PREFIX)) return { ok: true, text: content };
    const key = this.getKey(keyId);
    if (!key) return { ok: false, text: '[Encrypted message - missing key]' };
    try {
      const cipher = content.slice(E2EE_PREFIX.length);
      const bytes = CryptoJS.AES.decrypt(cipher, key);
      const text = bytes.toString(CryptoJS.enc.Utf8);
      if (!text) return { ok: false, text: '[Encrypted message - decryption failed]' };
      return { ok: true, text };
    } catch {
      return { ok: false, text: '[Encrypted message - decryption failed]' };
    }
  },

  // Check if a content string is an E2EE envelope
  isEnvelope(content: string): boolean {
    return typeof content === 'string' && content.startsWith(E2EE_PREFIX);
  },

  // Build one-time key share payload content
  buildShareMessage(key: string): string {
    return `${E2EE_SHARE_PREFIX}${key}`;
  },

  // Build disable-broadcast message content. Plaintext, no payload needed.
  buildDisableMessage(): string {
    return E2EE_DISABLE_PREFIX;
  },

  // Build info message (plaintext) announcing state changes
  buildInfoMessage(state: 'enabled' | 'disabled'): string {
    return `${E2EE_INFO_PREFIX}${state}`;
  },

  // Parse a key share message. Returns the key or null.
  parseShareMessage(content: string): string | null {
    if (!content || !content.startsWith(E2EE_SHARE_PREFIX)) return null;
    return content.slice(E2EE_SHARE_PREFIX.length) || null;
  },

  isShareMessage(content: string): boolean {
    return typeof content === 'string' && content.startsWith(E2EE_SHARE_PREFIX);
  },

  isDisableMessage(content: string): boolean {
    return typeof content === 'string' && content.startsWith(E2EE_DISABLE_PREFIX);
  },

  isInfoMessage(content: string): boolean {
    return typeof content === 'string' && content.startsWith(E2EE_INFO_PREFIX);
  },

  parseInfoMessage(content: string): 'enabled' | 'disabled' | null {
    if (!this.isInfoMessage(content)) return null;
    const val = content.slice(E2EE_INFO_PREFIX.length);
    return val === 'enabled' || val === 'disabled' ? val : null;
  },

  // Export the key for a specific conversation
  exportKey(profileType: ProfileType, me: string, other: string): ExportedKey | null {
    const keyId = this.getKeyId(profileType, me, other);
    const key = this.getKey(keyId);
    if (!key) return null;
    const [a, b] = sortedPair(me, other);
    return {
      keyId,
      profileType,
      participants: [a, b],
      key,
      createdAt: new Date().toISOString(),
      version: 1,
    };
  },

  // Import a key JSON object for this conversation. Returns true if stored.
  importKey(data: unknown, profileType: ProfileType, me: string, other: string): boolean {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Partial<ExportedKey>;
    if (obj.version !== 1 || typeof obj.key !== 'string' || typeof obj.keyId !== 'string' || typeof obj.profileType !== 'string') return false;
    if (obj.profileType !== profileType) return false;
    const expectedKeyId = this.getKeyId(profileType, me, other);
    if (obj.keyId !== expectedKeyId) return false;
    if (!obj.participants || obj.participants.length !== 2) return false;
    const [a, b] = sortedPair(me, other);
    const [pa, pb] = obj.participants;
    if (a !== pa || b !== pb) return false;
    this.saveKey(expectedKeyId, obj.key);
    this.setEnabled(expectedKeyId, true);
    return true;
  }
};

export default e2ee;
