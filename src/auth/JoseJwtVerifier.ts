import { jwtVerify, type JWTHeaderParameters } from 'jose';
import ApiError from '../errors/ApiError';
import type { AuthenticatedPrincipal } from './AuthenticatedPrincipal';
import type { ClaimsMapper } from './ClaimsMapper';
import { ConfigurableClaimsMapper } from './ConfigurableClaimsMapper';
import type { TokenVerifier } from './TokenVerifier';
import type { VerificationKeyProvider } from './VerificationKeyProvider';

export interface JoseJwtVerifierOptions {
  keyProvider: VerificationKeyProvider;
  claimsMapper?: ClaimsMapper;
  algorithms?: string[];
  maxTokenAgeSeconds?: number;
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
}

export class JoseJwtVerifier implements TokenVerifier {
  private readonly keyProvider: VerificationKeyProvider;
  private readonly claimsMapper: ClaimsMapper;
  private readonly algorithms?: string[];
  private readonly maxTokenAgeSeconds: number;
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly clockTolerance: number;

  constructor(options: JoseJwtVerifierOptions) {
    if (!options.keyProvider) {
      throw new Error('JoseJwtVerifier requires a VerificationKeyProvider');
    }
    this.keyProvider = options.keyProvider;
    this.claimsMapper = options.claimsMapper || new ConfigurableClaimsMapper();
    this.algorithms = options.algorithms && options.algorithms.length > 0 ? options.algorithms : undefined;
    this.maxTokenAgeSeconds = options.maxTokenAgeSeconds ?? 8 * 60 * 60; // 8 hours
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.clockTolerance = options.clockTolerance ?? 5; // 5 seconds
  }

  async verify(token: string): Promise<AuthenticatedPrincipal> {
    if (!token || typeof token !== 'string' || !token.trim()) {
      throw ApiError.unauthorized('Token is missing or empty');
    }

    try {
      const keyResolver = async (header: JWTHeaderParameters, input: unknown) => {
        return await this.keyProvider.getKey(header, input);
      };

      const verifyOptions: Record<string, unknown> = {
        clockTolerance: this.clockTolerance,
      };
      if (this.algorithms) {
        verifyOptions.algorithms = this.algorithms;
      }
      if (this.issuer) {
        verifyOptions.issuer = this.issuer;
      }
      if (this.audience) {
        verifyOptions.audience = this.audience;
      }

      const { payload } = await jwtVerify(token, keyResolver, verifyOptions);

      // Verify mandatory expiration claim
      if (typeof payload.exp !== 'number') {
        throw ApiError.unauthorized('Token must include a valid exp claim');
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now - this.clockTolerance) {
        throw ApiError.unauthorized('Token has expired');
      }

      // Verify mandatory issued-at claim & 8-hour maximum age policy
      if (typeof payload.iat !== 'number') {
        throw ApiError.unauthorized('Token must include a valid iat claim');
      }

      const tokenAge = now - payload.iat;
      if (tokenAge > this.maxTokenAgeSeconds) {
        throw ApiError.unauthorized('Token age exceeds maximum allowed age of 8 hours');
      }

      if (payload.iat > now + this.clockTolerance) {
        throw ApiError.unauthorized('Token was issued in the future');
      }

      return this.claimsMapper.map(payload as Record<string, unknown>);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Invalid token';
      throw ApiError.unauthorized(message);
    }
  }
}
