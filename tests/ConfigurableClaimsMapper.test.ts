import { ConfigurableClaimsMapper } from '../src/auth/ConfigurableClaimsMapper';
import ApiError from '../src/errors/ApiError';

describe('ConfigurableClaimsMapper', () => {
  it('should map valid payload with sub and roles array to AuthenticatedPrincipal', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-123',
      roles: ['VENUE_OWNER'],
    };

    const principal = mapper.map(payload);

    expect(principal).toEqual({
      userId: 'user-123',
      roles: ['VENUE_OWNER'],
    });
  });

  it('should normalize lowercase roles to uppercase and trim whitespace', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-456',
      roles: [' venue_owner ', 'organizer '],
    };

    const principal = mapper.map(payload);

    expect(principal).toEqual({
      userId: 'user-456',
      roles: ['VENUE_OWNER', 'ORGANIZER'],
    });
  });

  it('should support custom userIdClaim and rolesClaim options with single string role', () => {
    const mapper = new ConfigurableClaimsMapper({
      userIdClaim: 'userId',
      rolesClaim: 'role',
    });
    const payload = {
      userId: 'custom-user-789',
      role: 'VENUE_OWNER',
    };

    const principal = mapper.map(payload);

    expect(principal).toEqual({
      userId: 'custom-user-789',
      roles: ['VENUE_OWNER'],
    });
  });

  it('should throw ApiError(401) when userId claim is missing', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      roles: ['VENUE_OWNER'],
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
    expect(() => mapper.map(payload)).toThrow('User ID claim "sub" is missing or invalid');
  });

  it('should throw ApiError(401) when userId claim is empty string or whitespace', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: '   ',
      roles: ['VENUE_OWNER'],
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
  });

  it('should throw ApiError(401) when roles claim is missing', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-123',
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
    expect(() => mapper.map(payload)).toThrow('Roles claim "roles" is missing');
  });

  it('should throw ApiError(401) when roles claim is an empty array', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-123',
      roles: [],
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
    expect(() => mapper.map(payload)).toThrow('Roles claim "roles" cannot be empty');
  });

  it('should throw ApiError(401) when roles claim contains non-string elements', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-123',
      roles: [123, null],
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
    expect(() => mapper.map(payload)).toThrow('Roles claim "roles" contains invalid role format');
  });

  it('should throw ApiError(401) when roles claim is neither array nor string', () => {
    const mapper = new ConfigurableClaimsMapper();
    const payload = {
      sub: 'user-123',
      roles: { role: 'VENUE_OWNER' },
    };

    expect(() => mapper.map(payload)).toThrow(ApiError);
    expect(() => mapper.map(payload)).toThrow('Roles claim "roles" has an invalid format');
  });

  it('should throw ApiError(401) when payload is not a valid object', () => {
    const mapper = new ConfigurableClaimsMapper();

    expect(() => mapper.map(null as unknown as Record<string, unknown>)).toThrow(ApiError);
  });
});
