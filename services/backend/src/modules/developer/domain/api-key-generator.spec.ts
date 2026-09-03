import { ApiKeyGenerator } from './api-key-generator';

describe('ApiKeyGenerator', () => {
  it('generates a valid API key with proper live prefix and sha256 hash', () => {
    const key = ApiKeyGenerator.generate('live');

    expect(key.rawKey).toMatch(/^sk_live_[a-f0-9]{40}$/);
    expect(key.prefix).toBe(key.rawKey.substring(0, 14));
    expect(key.hash).toBe(ApiKeyGenerator.hashKey(key.rawKey));
  });

  it('generates unique keys across invocations', () => {
    const key1 = ApiKeyGenerator.generate('live');
    const key2 = ApiKeyGenerator.generate('live');

    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.hash).not.toBe(key2.hash);
  });

  it('computes HMAC-SHA256 signature for webhooks deterministically', () => {
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const secret = 'whsec_testing_secret_123';

    const sig1 = ApiKeyGenerator.computeHmacSignature(secret, payload);
    const sig2 = ApiKeyGenerator.computeHmacSignature(secret, payload);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });
});
