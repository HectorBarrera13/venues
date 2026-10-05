const express = require('express');
const request = require('supertest');
const { createReadyRouter } = require('../src/routes/readyRoutes');
const { ReadinessService } = require('../src/services/ReadinessService');
const errorHandler = require('../src/middleware/errorHandler').default;

function appWithProbe(probe) {
  const app = express();
  app.use('/ready', createReadyRouter(probe));
  app.use(errorHandler);
  return app;
}

describe('GET /ready Route Integration', () => {
  it('should return 200 with { status: "ready", venueStore: "up" } when the venue store answers', async () => {
    const probe = { checkVenueStore: jest.fn().mockResolvedValue(true) };

    const response = await request(appWithProbe(probe))
      .get('/ready')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ready', venueStore: 'up' });
  });

  it('should return 503 with { status: "not_ready", venueStore: "down" } when the venue store is unreachable', async () => {
    const probe = { checkVenueStore: jest.fn().mockResolvedValue(false) };

    const response = await request(appWithProbe(probe))
      .get('/ready')
      .expect('Content-Type', /json/)
      .expect(503);

    expect(response.body).toEqual({ status: 'not_ready', venueStore: 'down' });
  });

  it('should not require authentication', async () => {
    const probe = { checkVenueStore: jest.fn().mockResolvedValue(true) };

    await request(appWithProbe(probe)).get('/ready').expect(200);

    expect(probe.checkVenueStore).toHaveBeenCalledTimes(1);
  });

  it('should forward unexpected probe failures to the error handler', async () => {
    const probe = {
      checkVenueStore: jest.fn().mockRejectedValue(new Error('probe exploded')),
    };

    const response = await request(appWithProbe(probe)).get('/ready').expect(500);

    expect(response.body).toEqual({ error: 'probe exploded' });
  });
});

describe('ReadinessService', () => {
  let client;

  beforeEach(() => {
    client = { $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }) };
  });

  it('should ping the venue store and report it as reachable', async () => {
    const service = new ReadinessService(client);

    await expect(service.checkVenueStore()).resolves.toBe(true);
    expect(client.$runCommandRaw).toHaveBeenCalledWith({ ping: 1 });
  });

  it('should report the venue store as unreachable when the ping throws', async () => {
    const service = new ReadinessService({
      $runCommandRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });

    await expect(service.checkVenueStore()).resolves.toBe(false);
  });

  it('should give up once the timeout elapses instead of waiting on a silent store', async () => {
    const client = { $runCommandRaw: jest.fn(() => new Promise(() => {})) };
    const service = new ReadinessService(client, 10);

    await expect(service.checkVenueStore()).resolves.toBe(false);
  });

  it('should still report reachable when the ping beats the timeout', async () => {
    const client = { $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }) };
    const service = new ReadinessService(client, 1000);

    await expect(service.checkVenueStore()).resolves.toBe(true);
  });
});

export {};