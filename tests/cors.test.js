const request = require('supertest');
const app = require('../src/app');
const { isAllowedOrigin } = require('../src/middleware/cors');

describe('CORS Origin Validation (Unit)', () => {
  const originalEnv = process.env.CORS_ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.CORS_ALLOWED_ORIGINS = originalEnv;
  });

  it('should allow requests without origin header (direct tools, mobile, same-origin)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin(null)).toBe(true);
    expect(isAllowedOrigin('')).toBe(true);
  });

  it('should allow localhost origins on any port', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    expect(isAllowedOrigin('https://localhost:8080')).toBe(true);
    expect(isAllowedOrigin('http://localhost')).toBe(true);
  });

  it('should allow 127.0.0.1 origins on any port', () => {
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(isAllowedOrigin('https://127.0.0.1')).toBe(true);
  });

  it('should allow IPv6 loopback origins', () => {
    expect(isAllowedOrigin('http://[::1]:5173')).toBe(true);
    expect(isAllowedOrigin('http://[::1]:3000')).toBe(true);
  });

  it('should allow origin matching incoming request host IP', () => {
    const req = { headers: { host: '192.168.1.100:3000' } };
    expect(isAllowedOrigin('http://192.168.1.100:5173', req)).toBe(true);
  });

  it('should allow origin matching req.hostname', () => {
    const req = { hostname: '10.0.0.25' };
    expect(isAllowedOrigin('http://10.0.0.25:5173', req)).toBe(true);
  });

  it('should allow origins configured in CORS_ALLOWED_ORIGINS env variable', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'http://custom-client.local,https://staging.example.com';
    expect(isAllowedOrigin('http://custom-client.local')).toBe(true);
    expect(isAllowedOrigin('https://staging.example.com')).toBe(true);
  });

  it('should reject disallowed external origins', () => {
    const req = { headers: { host: 'localhost:3000' } };
    expect(isAllowedOrigin('http://malicious-site.com', req)).toBe(false);
    expect(isAllowedOrigin('https://phishing.example.org', req)).toBe(false);
  });

  it('should reject malformed origin URLs', () => {
    expect(isAllowedOrigin('not-a-valid-url')).toBe(false);
  });
});

describe('CORS Integration (Express app)', () => {
  it('should pass through normal requests when no Origin header is sent', async () => {
    const response = await request(app).get('/venues');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should include CORS headers when request has allowed localhost origin', async () => {
    const response = await request(app)
      .get('/venues')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers.vary).toContain('Origin');
  });

  it('should include CORS headers when request has allowed 127.0.0.1 origin', async () => {
    const response = await request(app)
      .get('/venues')
      .set('Origin', 'http://127.0.0.1:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });

  it('should include CORS headers when request origin matches host IP', async () => {
    const response = await request(app)
      .get('/venues')
      .set('Host', '192.168.1.50:3000')
      .set('Origin', 'http://192.168.1.50:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://192.168.1.50:5173');
  });

  it('should handle preflight OPTIONS requests with 204 and correct CORS headers', async () => {
    const response = await request(app)
      .options('/venues')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(response.headers['access-control-allow-headers']).toBeDefined();
    expect(response.headers['access-control-max-age']).toBe('86400');
  });

  it('should reflect requested headers in preflight Access-Control-Allow-Headers', async () => {
    const customHeaders = 'Content-Type, Authorization, X-Requested-With';
    const response = await request(app)
      .options('/venues')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Headers', customHeaders);

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-headers']).toBe(customHeaders);
  });

  it('should reject requests with disallowed external origin with 403', async () => {
    const response = await request(app)
      .get('/venues')
      .set('Origin', 'http://unauthorized-domain.com');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'CORS origin not allowed' });
  });

  it('should reject preflight OPTIONS from disallowed origin with 403', async () => {
    const response = await request(app)
      .options('/venues')
      .set('Origin', 'http://unauthorized-domain.com');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'CORS origin not allowed' });
  });

  it('should preserve CORS headers on application error responses', async () => {
    const response = await request(app)
      .post('/venues')
      .set('Origin', 'http://localhost:5173')
      .send({}); // Invalid body missing name

    expect(response.status).toBe(400);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.body).toHaveProperty('error');
  });
});
