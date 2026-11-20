/**
 * VEN-704 — End-to-end happy path against the real Express app, Prisma client
 * and MongoDB replica set (with 2dsphere + partial unique osmRef indexes).
 *
 * Covers the full C1 -> C2/C3 -> C4 -> C5 lifecycle:
 *   1. Register an OSM-backed venue (201) + verify global dedupe (409).
 *   2. Save seat map v1 (stage + zones + seats -> 201, latestMapVersion becomes 1).
 *   3. Edit map ("Upper Tier split") -> save v2 (201, v1 stays immutable).
 *   4. Geospatial radius search returns venues sorted ascending with distance_km,
 *      excluding unmapped venues (latestMapVersion === 0).
 *   5. Accent- and case-insensitive name search ("sála" matches "Sala Riviera Madrid").
 *   6. Another user can read venue + map (200, ownerId !== sub -> read-only in UI)
 *      and cannot overwrite the map (403).
 */
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { AUTH_CONFIG } from '../../src/auth/authConfig';
import { expectToMatchContract } from '../contracts/openapiContract';
import { prisma, resetDatabase } from './setup/database';

const E2E_SECRET = process.env.JWT_SECRET || 'e2e-integration-secret';
process.env.JWT_SECRET = E2E_SECRET;

function tokenFor(role: string, sub: string, name: string): string {
  return `Bearer ${jwt.sign(
    { [AUTH_CONFIG.claims.role]: role, [AUTH_CONFIG.claims.name]: name },
    E2E_SECRET,
    { algorithm: AUTH_CONFIG.algorithm, subject: sub, expiresIn: '1h' },
  )}`;
}

const OWNER_A = tokenFor(AUTH_CONFIG.roles.VENUE_OWNER, 'owner-alice', 'Alice Owner');
const OWNER_B = tokenFor(AUTH_CONFIG.roles.VENUE_OWNER, 'owner-bob', 'Bob Owner');
const ORGANIZER = tokenFor(AUTH_CONFIG.roles.ORGANIZER, 'org-carlos', 'Carlos Organizer');

const validMapV1 = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../fixtures/maps/valid-v1.json'), 'utf8'),
) as {
  stage: unknown;
  zones: Array<{ id: string; name: string; outline: Array<{ x: number; y: number }> }>;
  seats: Array<{ id: string; label: string; row: string | null; zone: string | null; position: { x: number; y: number }; rotation?: number }>;
};

function splitBalconyMap(): typeof validMapV1 {
  const v2 = structuredClone(validMapV1);
  // Split Balcony into "Upper Tier" (row F) and keep Balcony (row E).
  v2.zones = v2.zones.map((zone) =>
    zone.id === 'z-balcony'
      ? {
          ...zone,
          outline: [
            { x: 0.1, y: 0.65 },
            { x: 0.9, y: 0.65 },
            { x: 0.9, y: 0.75 },
            { x: 0.1, y: 0.75 },
          ],
        }
      : zone,
  );
  v2.zones.push({
    id: 'z-upper-tier',
    name: 'Upper Tier',
    outline: [
      { x: 0.1, y: 0.76 },
      { x: 0.9, y: 0.76 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ],
  });
  v2.seats = v2.seats.map((seat) =>
    seat.zone === 'z-balcony' && seat.row === 'F'
      ? { ...seat, zone: 'z-upper-tier' }
      : seat,
  );
  return v2;
}

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Venues full lifecycle E2E (VEN-704)', () => {
  it('completes registration, v1/v2 map versioning, geospatial & accented search, and read-only access', async () => {
    // 1. Register main OSM-backed venue (C1)
    const rivieraRes = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_A)
      .send({
        name: 'Sala Riviera Madrid',
        description: 'Live music hall',
        address: 'Paseo Bajo de la Virgen del Puerto s/n',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.4119, lng: -3.7225 },
        externalId: '987654321',
        externalSource: 'nominatim',
        osmRef: 'way:987654321',
      })
      .expect(201);
    expectToMatchContract(rivieraRes);
    expect(rivieraRes.body.latestMapVersion).toBe(0);
    expect(rivieraRes.body.ownerId).toBe('owner-alice');
    const rivieraId = rivieraRes.body.id as string;

    // Dedupe: another owner trying to register the same osmRef gets 409 with existingVenueId
    const dedupeRes = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_B)
      .send({
        name: 'Sala Riviera Duplicate',
        address: 'Paseo Bajo',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.4119, lng: -3.7225 },
        osmRef: 'way:987654321',
      })
      .expect(409);
    expectToMatchContract(dedupeRes);
    expect(dedupeRes.body.existingVenueId).toBe(rivieraId);

    // Register a second mapped venue farther from Madrid center, plus an unmapped venue nearby
    const wizinkRes = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_A)
      .send({
        name: 'WiZink Center',
        address: 'Av. Felipe II s/n',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.4239, lng: -3.6717 },
        osmRef: 'way:111222333',
      })
      .expect(201);
    const wizinkId = wizinkRes.body.id as string;

    const unmappedRes = await request(app)
      .post('/venues')
      .set('Authorization', OWNER_A)
      .send({
        name: 'Teatro Sin Mapa',
        address: 'Gran Via 10',
        city: 'Madrid',
        country: 'ES',
        location: { lat: 40.419, lng: -3.701 },
        osmRef: 'node:555666777',
      })
      .expect(201);
    expect(unmappedRes.body.latestMapVersion).toBe(0);

    // 2. Save v1 seat map (C2/C3)
    const v1Res = await request(app)
      .post(`/venues/${rivieraId}/map`)
      .set('Authorization', OWNER_A)
      .send(validMapV1)
      .expect(201);
    expectToMatchContract(v1Res);
    expect(v1Res.body.version).toBe(1);
    expect(v1Res.body.zones).toHaveLength(3);

    // Also save v1 for WiZink so both appear in search
    await request(app)
      .post(`/venues/${wizinkId}/map`)
      .set('Authorization', OWNER_A)
      .send(validMapV1)
      .expect(201);

    // 3. Edit map ("Upper Tier split") -> save v2 and verify v1 immutability
    const v2Payload = splitBalconyMap();
    const v2Res = await request(app)
      .post(`/venues/${rivieraId}/map`)
      .set('Authorization', OWNER_A)
      .send(v2Payload)
      .expect(201);
    expectToMatchContract(v2Res);
    expect(v2Res.body.version).toBe(2);
    expect(v2Res.body.zones.map((z: { name: string }) => z.name)).toContain('Upper Tier');

    const readV1Res = await request(app)
      .get(`/venues/${rivieraId}/map?version=1`)
      .set('Authorization', ORGANIZER)
      .expect(200);
    expectToMatchContract(readV1Res);
    expect(readV1Res.body.version).toBe(1);
    expect(readV1Res.body.zones).toHaveLength(3);

    const readLatestRes = await request(app)
      .get(`/venues/${rivieraId}/map`)
      .set('Authorization', ORGANIZER)
      .expect(200);
    expectToMatchContract(readLatestRes);
    expect(readLatestRes.body.version).toBe(2);
    expect(readLatestRes.body.zones).toHaveLength(4);

    // 4. Geospatial search around Puerta del Sol (40.4168, -3.7038): excludes unmapped venue, includes distance_km sorted ASC
    const geoRes = await request(app)
      .get('/venues?lat=40.4168&lng=-3.7038&radius_km=20')
      .set('Authorization', ORGANIZER)
      .expect(200);
    expectToMatchContract(geoRes);
    expect(geoRes.body.data).toHaveLength(2);
    const distances = geoRes.body.data.map((v: { distance_km: number }) => v.distance_km);
    expect(distances[0]).toBeLessThanOrEqual(distances[1]);
    expect(geoRes.body.data.map((v: { id: string }) => v.id)).not.toContain(unmappedRes.body.id);

    // 5. Accent- and case-insensitive search ("sála" finds "Sala Riviera Madrid")
    const nameRes = await request(app)
      .get('/venues?name=s%C3%A1la&country=ES&city=madrid')
      .set('Authorization', ORGANIZER)
      .expect(200);
    expectToMatchContract(nameRes);
    expect(nameRes.body.data).toHaveLength(1);
    expect(nameRes.body.data[0].id).toBe(rivieraId);
    expect(nameRes.body.data[0].latestMapVersion).toBe(2);

    // 6. Another user opens venue in read-only (200 on GET, ownerId !== caller, 403 on POST map)
    const detailRes = await request(app)
      .get(`/venues/${rivieraId}`)
      .set('Authorization', OWNER_B)
      .expect(200);
    expectToMatchContract(detailRes);
    expect(detailRes.body.ownerId).toBe('owner-alice');
    expect(detailRes.body.latestMapVersion).toBe(2);

    const forbiddenSaveRes = await request(app)
      .post(`/venues/${rivieraId}/map`)
      .set('Authorization', OWNER_B)
      .send(validMapV1)
      .expect(403);
    expectToMatchContract(forbiddenSaveRes);
  });
});
