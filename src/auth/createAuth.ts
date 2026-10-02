import type { RequestHandler } from 'express';
import { createAuthenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { authConfig, type AuthConfig } from './authConfig';
import type { ClaimsMapper } from './ClaimsMapper';
import { ConfigurableClaimsMapper } from './ConfigurableClaimsMapper';
import { JoseJwtVerifier } from './JoseJwtVerifier';
import { MockTokenVerifier } from './mock/MockTokenVerifier';
import type { TokenVerifier } from './TokenVerifier';
import {
  StaticPublicKeyProvider,
  StaticSecretKeyProvider,
  type VerificationKeyProvider,
} from './VerificationKeyProvider';

export interface AuthContext {
  tokenVerifier: TokenVerifier;
  claimsMapper: ClaimsMapper;
  authenticate: RequestHandler;
  requireRole: (role: string) => RequestHandler;
}

export function createAuth(
  config: AuthConfig = authConfig,
  customKeyProvider?: VerificationKeyProvider
): AuthContext {
  let tokenVerifier: TokenVerifier;
  let claimsMapper: ClaimsMapper;

  if (config.mode === 'mock') {
    tokenVerifier = new MockTokenVerifier();
    claimsMapper = new ConfigurableClaimsMapper();
  } else {
    claimsMapper = new ConfigurableClaimsMapper({
      userIdClaim: config.userIdClaim,
      rolesClaim: config.rolesClaim,
    });

    let keyProvider = customKeyProvider;
    if (!keyProvider) {
      if (config.secret) {
        keyProvider = new StaticSecretKeyProvider(config.secret);
      } else if (config.publicKey) {
        keyProvider = new StaticPublicKeyProvider(config.publicKey, config.algorithms[0]);
      } else {
        throw new Error('No verification key provider could be configured for JWT mode');
      }
    }

    tokenVerifier = new JoseJwtVerifier({
      keyProvider,
      claimsMapper,
      algorithms: config.algorithms,
      maxTokenAgeSeconds: config.maxTokenAgeSeconds,
      issuer: config.issuer,
      audience: config.audience,
    });
  }

  const authenticate = createAuthenticate(tokenVerifier);

  return {
    tokenVerifier,
    claimsMapper,
    authenticate,
    requireRole,
  };
}

export const defaultAuth = createAuth(authConfig);
export const authenticate = defaultAuth.authenticate;
export default defaultAuth;
