const request = require('supertest');
const app = require('../src/app').default;

describe('GET /health Route Integration', () => {
  it('should return 200 with { status: "ok" }', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should not require a request body', async () => {
    await request(app).get('/health').expect(200);
  });
});
