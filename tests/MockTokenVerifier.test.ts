import { MockTokenVerifier } from '../src/auth/mock/MockTokenVerifier';
import { Roles } from '../src/auth/roles';
import ApiError from '../src/errors/ApiError';

describe('MockTokenVerifier', () => {
  let verifier: MockTokenVerifier;

  beforeEach(() => {
    verifier = new MockTokenVerifier();
  });

  it('should resolve user-001 to VENUE_OWNER principal from shared/mocks', async () => {
    const principal = await verifier.verify('user-001');

    expect(principal).toEqual({
      userId: 'user-001',
      roles: [Roles.VENUE_OWNER],
    });
  });

  it('should resolve user-002 to ORGANIZER principal from shared/mocks', async () => {
    const principal = await verifier.verify('user-002');

    expect(principal).toEqual({
      userId: 'user-002',
      roles: [Roles.ORGANIZER],
    });
  });

  it('should throw 401 when token is empty or whitespace', async () => {
    await expect(verifier.verify('')).rejects.toThrow(ApiError);
    await expect(verifier.verify('   ')).rejects.toThrow(ApiError);
  });

  it('should throw 401 when mock user ID is not found', async () => {
    await expect(verifier.verify('non-existent-user')).rejects.toThrow(ApiError);
    await expect(verifier.verify('non-existent-user')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Unknown mock user: non-existent-user',
    });
  });
});
