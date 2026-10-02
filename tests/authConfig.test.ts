import { loadAuthConfig, parseDuration } from '../src/auth/authConfig';

describe('authConfig', () => {
  describe('parseDuration', () => {
    it('should parse hours correctly (e.g. 8h -> 28800)', () => {
      expect(parseDuration('8h')).toBe(28800);
      expect(parseDuration('1h')).toBe(3600);
    });

    it('should parse minutes correctly (e.g. 30m -> 1800)', () => {
      expect(parseDuration('30m')).toBe(1800);
    });

    it('should parse seconds correctly (e.g. 60s -> 60)', () => {
      expect(parseDuration('60s')).toBe(60);
    });

    it('should parse raw numbers or numeric strings', () => {
      expect(parseDuration(1200)).toBe(1200);
      expect(parseDuration('5000')).toBe(5000);
    });

    it('should return fallback if undefined or empty', () => {
      expect(parseDuration(undefined, 28800)).toBe(28800);
      expect(parseDuration('', 1000)).toBe(1000);
    });
  });

  describe('fail-closed security validation', () => {
    it('should throw when AUTH_MODE=mock is attempted in production', () => {
      expect(() => {
        loadAuthConfig({
          mode: 'mock',
          nodeEnv: 'production',
        });
      }).toThrow('AUTH_MODE=mock is not allowed in production');
    });

    it('should throw when AUTH_MODE=jwt in production has no secret, public key, or JWKS URI', () => {
      expect(() => {
        loadAuthConfig({
          mode: 'jwt',
          nodeEnv: 'production',
          secret: undefined,
          publicKey: undefined,
          jwksUri: undefined,
        });
      }).toThrow('JWT authentication is misconfigured: AUTH_SECRET, AUTH_PUBLIC_KEY, or AUTH_JWKS_URI must be provided when AUTH_MODE=jwt');
    });

    it('should succeed when AUTH_MODE=jwt has secret provided', () => {
      const config = loadAuthConfig({
        mode: 'jwt',
        nodeEnv: 'production',
        secret: 'prod-secret-must-be-secure-and-long',
      });
      expect(config.mode).toBe('jwt');
      expect(config.secret).toBe('prod-secret-must-be-secure-and-long');
    });

    it('should allow AUTH_MODE=mock in development or test', () => {
      const configDev = loadAuthConfig({
        mode: 'mock',
        nodeEnv: 'development',
      });
      expect(configDev.mode).toBe('mock');

      const configTest = loadAuthConfig({
        mode: 'mock',
        nodeEnv: 'test',
      });
      expect(configTest.mode).toBe('mock');
    });
  });
});
