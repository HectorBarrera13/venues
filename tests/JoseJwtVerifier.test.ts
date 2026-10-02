import { SignJWT } from 'jose';
import { JoseJwtVerifier } from '../src/auth/JoseJwtVerifier';
import { StaticSecretKeyProvider } from '../src/auth/VerificationKeyProvider';
import ApiError from '../src/errors/ApiError';

describe('JoseJwtVerifier', () => {
  const secretString = 'test-secret-must-be-at-least-32-chars-long!';
  const secretKey = new TextEncoder().encode(secretString);
  const otherSecretKey = new TextEncoder().encode('other-different-secret-for-bad-signature!!');

  let keyProvider: StaticSecretKeyProvider;
  let verifier: JoseJwtVerifier;

  beforeEach(() => {
    keyProvider = new StaticSecretKeyProvider(secretString);
    verifier = new JoseJwtVerifier({
      keyProvider,
      algorithms: ['HS256'],
      maxTokenAgeSeconds: 8 * 3600, // 8 hours
    });
  });

  async function createToken(options: {
    secret?: Uint8Array;
    alg?: string;
    sub?: string;
    roles?: unknown;
    iat?: number;
    exp?: number;
    omitIat?: boolean;
    omitExp?: boolean;
  } = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jwt = new SignJWT({
      sub: options.sub ?? 'user-test-123',
      roles: options.roles ?? ['VENUE_OWNER'],
    }).setProtectedHeader({ alg: options.alg || 'HS256' });

    if (!options.omitIat) {
      jwt.setIssuedAt(options.iat ?? now);
    }
    if (!options.omitExp) {
      jwt.setExpirationTime(options.exp ?? now + 3600);
    }

    return jwt.sign(options.secret || secretKey);
  }

  it('should successfully verify a valid signed token and return AuthenticatedPrincipal', async () => {
    const token = await createToken();

    const principal = await verifier.verify(token);

    expect(principal).toEqual({
      userId: 'user-test-123',
      roles: ['VENUE_OWNER'],
    });
  });

  it('should reject with 401 when signature is invalid', async () => {
    const token = await createToken({ secret: otherSecretKey });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should reject with 401 when algorithm is not permitted', async () => {
    const token = await createToken({ alg: 'HS512' });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should reject with 401 when token is expired (now >= exp)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createToken({
      iat: now - 3600,
      exp: now - 100, // expired in the past
    });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should reject with 401 when token age exceeds 8 hours (even if exp is in the future)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const nineHoursAgo = now - 9 * 3600;
    const token = await createToken({
      iat: nineHoursAgo,
      exp: now + 3 * 24 * 3600, // valid for 3 days, but older than 8h
    });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token age exceeds maximum allowed age of 8 hours',
    });
  });

  it('should reject with 401 when exp claim is missing', async () => {
    const token = await createToken({ omitExp: true });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token must include a valid exp claim',
    });
  });

  it('should reject with 401 when iat claim is missing', async () => {
    const token = await createToken({ omitIat: true });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token must include a valid iat claim',
    });
  });

  it('should reject with 401 when token was issued in the future', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await createToken({
      iat: now + 3600,
      exp: now + 7200,
    });

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token was issued in the future',
    });
  });

  it('should reject with 401 when claims payload is invalid (missing roles)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = new SignJWT({ sub: 'user-without-roles' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600);
    const token = await jwt.sign(secretKey);

    await expect(verifier.verify(token)).rejects.toThrow(ApiError);
    await expect(verifier.verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('should reject with 401 when token is malformed', async () => {
    await expect(verifier.verify('not-a-jwt')).rejects.toThrow(ApiError);
    await expect(verifier.verify('not-a-jwt')).rejects.toMatchObject({ statusCode: 401 });
  });
});
