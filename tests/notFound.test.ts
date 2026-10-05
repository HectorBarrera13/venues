const request = require('supertest');
const app = require('../src/app').default;

describe('Unknown Route Handling', () => {
  it('should return 404 with the standard error body for an unknown path', async () => {
    const response = await request(app)
      .get('/does-not-exist')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toEqual({ error: 'Route GET /does-not-exist not found' });
  });

  it('should name the method and path of the unmatched request', async () => {
    const response = await request(app).post('/venues/unknown/route').expect(404);

    expect(response.body.error).toContain('POST');
    expect(response.body.error).toContain('/venues/unknown/route');
  });

  it('should still answer known routes normally', async () => {
    await request(app).get('/health').expect(200);
  });
});

export {};