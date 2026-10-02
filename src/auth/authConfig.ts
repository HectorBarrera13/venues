export interface AuthConfig {
  mode: 'jwt' | 'mock';
  maxTokenAgeSeconds: number;
  userIdClaim: string;
  rolesClaim: string;
  algorithms: string[];
  secret?: string;
  publicKey?: string;
  jwksUri?: string;
  issuer?: string;
  audience?: string;
  nodeEnv: string;
}

export function parseDuration(value?: string | number, fallbackSeconds = 28800): number {
  if (value === undefined || value === null || value === '') {
    return fallbackSeconds;
  }
  if (typeof value === 'number') {
    return value;
  }
  const str = value.trim().toLowerCase();
  const match = str.match(/^(\d+)(h|m|s)?$/);
  if (!match) {
    const num = Number(str);
    return isNaN(num) ? fallbackSeconds : num;
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'h') return amount * 3600;
  if (unit === 'm') return amount * 60;
  if (unit === 's') return amount;
  return amount;
}

export function loadAuthConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  const nodeEnv = overrides?.nodeEnv || process.env.NODE_ENV || 'development';
  const mode = overrides?.mode || (process.env.AUTH_MODE === 'mock' ? 'mock' : 'jwt');

  const maxTokenAgeSeconds = overrides?.maxTokenAgeSeconds ?? parseDuration(process.env.AUTH_MAX_TOKEN_AGE, 8 * 3600);
  const userIdClaim = overrides?.userIdClaim || process.env.AUTH_USER_ID_CLAIM || 'sub';
  const rolesClaim = overrides?.rolesClaim || process.env.AUTH_ROLES_CLAIM || 'roles';

  const rawAlgorithms = overrides?.algorithms
    ? overrides.algorithms
    : process.env.AUTH_ALGORITHMS
    ? process.env.AUTH_ALGORITHMS.split(',').map((a) => a.trim()).filter(Boolean)
    : ['HS256'];

  const secret = overrides?.secret ?? process.env.AUTH_SECRET;
  const publicKey = overrides?.publicKey ?? process.env.AUTH_PUBLIC_KEY;
  const jwksUri = overrides?.jwksUri ?? process.env.AUTH_JWKS_URI;
  const issuer = overrides?.issuer ?? process.env.AUTH_ISSUER;
  const audience = overrides?.audience ?? process.env.AUTH_AUDIENCE;

  // Validation — Fail Closed
  if (mode === 'mock') {
    if (nodeEnv === 'production') {
      throw new Error('AUTH_MODE=mock is not allowed in production');
    }
  } else if (mode === 'jwt') {
    if (!secret && !publicKey && !jwksUri) {
      if (nodeEnv === 'test') {
        // Safe default fixture secret exclusively for test environment execution
        return {
          mode,
          maxTokenAgeSeconds,
          userIdClaim,
          rolesClaim,
          algorithms: rawAlgorithms,
          secret: 'test-secret-venue-service-at-least-32-chars-long!',
          publicKey,
          jwksUri,
          issuer,
          audience,
          nodeEnv,
        };
      }
      throw new Error('JWT authentication is misconfigured: AUTH_SECRET, AUTH_PUBLIC_KEY, or AUTH_JWKS_URI must be provided when AUTH_MODE=jwt');
    }
  }

  return {
    mode,
    maxTokenAgeSeconds,
    userIdClaim,
    rolesClaim,
    algorithms: rawAlgorithms,
    secret,
    publicKey,
    jwksUri,
    issuer,
    audience,
    nodeEnv,
  };
}

export const authConfig = loadAuthConfig();
