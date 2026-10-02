import type { CryptoKey, KeyObject, JWTHeaderParameters } from 'jose';
import { importSPKI } from 'jose';

export type VerificationKey = CryptoKey | KeyObject | Uint8Array;

export interface VerificationKeyProvider {
  getKey(header?: JWTHeaderParameters, token?: unknown): Promise<VerificationKey> | VerificationKey;
}

export class StaticSecretKeyProvider implements VerificationKeyProvider {
  private readonly key: Uint8Array;

  constructor(secret: string | Uint8Array) {
    if (!secret || (typeof secret === 'string' && !secret.trim())) {
      throw new Error('StaticSecretKeyProvider requires a non-empty secret');
    }
    this.key = typeof secret === 'string' ? new TextEncoder().encode(secret) : secret;
  }

  getKey(): Uint8Array {
    return this.key;
  }
}

export class StaticPublicKeyProvider implements VerificationKeyProvider {
  private keyPromise?: Promise<VerificationKey>;
  private resolvedKey?: VerificationKey;

  constructor(keyOrPem: VerificationKey | string, private readonly alg?: string) {
    if (typeof keyOrPem === 'string') {
      this.keyPromise = importSPKI(keyOrPem, alg || 'RS256').then((key) => {
        this.resolvedKey = key;
        return key;
      });
    } else {
      this.resolvedKey = keyOrPem;
    }
  }

  async getKey(): Promise<VerificationKey> {
    if (this.resolvedKey) return this.resolvedKey;
    if (this.keyPromise) return await this.keyPromise;
    throw new Error('Public key resolution failed');
  }
}
