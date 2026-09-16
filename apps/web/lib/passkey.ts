/**
 * Browser-side WebAuthn plumbing.
 *
 * The WebAuthn API speaks ArrayBuffer while JSON speaks base64url, so every
 * ceremony needs converting on the way in and on the way out. `toJSON()` on
 * PublicKeyCredential would do this for us but is still too new to rely on
 * (Chrome 119+/Safari 17.4+), so the conversion is explicit here.
 */

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator?.credentials?.create === 'function'
  );
}

/** True when the device itself can store a passkey (Touch ID, Windows Hello…). */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64urlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Server-issued creation options (JSON) -> the ArrayBuffer shape the API needs. */
function toCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: { ...options.user, id: base64urlToBuffer(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}

function toRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}

export class PasskeyCancelledError extends Error {
  constructor() {
    super('Passkey prompt was dismissed.');
    this.name = 'PasskeyCancelledError';
  }
}

function rethrow(err: unknown): never {
  // NotAllowedError covers both an explicit dismissal and a timeout; neither is
  // worth surfacing as a scary failure.
  if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
    throw new PasskeyCancelledError();
  }
  throw err;
}

/** Runs the create() ceremony and returns a JSON-serialisable attestation. */
export async function createPasskeyCredential(options: any): Promise<Record<string, unknown>> {
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: toCreationOptions(options),
    })) as PublicKeyCredential | null;
  } catch (err) {
    rethrow(err);
  }
  if (!credential) throw new Error('No passkey was created.');

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
      transports:
        typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
  };
}

/** Runs the get() ceremony and returns a JSON-serialisable assertion. */
export async function getPasskeyAssertion(options: any): Promise<Record<string, unknown>> {
  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: toRequestOptions(options),
    })) as PublicKeyCredential | null;
  } catch (err) {
    rethrow(err);
  }
  if (!credential) throw new Error('No passkey was selected.');

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}
