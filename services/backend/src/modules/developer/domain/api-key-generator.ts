import * as crypto from 'crypto';

export interface GeneratedApiKey {
  rawKey: string;
  prefix: string;
  hash: string;
}

export class ApiKeyGenerator {
  /**
   * Generates a cryptographically strong API key.
   * Format: sk_{mode}_{32 hex chars}
   * Example: sk_live_4a8f9b2c1d0e...
   */
  static generate(mode: 'live' | 'test' = 'live'): GeneratedApiKey {
    const entropy = crypto.randomBytes(20).toString('hex');
    const rawKey = `sk_${mode}_${entropy}`;
    const prefix = rawKey.substring(0, 14); // e.g. 'sk_live_4a8f9b'
    const hash = this.hashKey(rawKey);

    return { rawKey, prefix, hash };
  }

  /**
   * Hashes the raw key using SHA-256 for persistent database storage.
   */
  static hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Computes an HMAC-SHA256 signature for outgoing webhook payloads.
   */
  static computeHmacSignature(secret: string, payload: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}
