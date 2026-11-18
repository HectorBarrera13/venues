import { ensureVenueIndexes, RAW_VENUE_INDEXES } from '../src/database/indexes';

describe('ensureVenueIndexes', () => {
  it('creates the 2dsphere and the partial unique osmRef indexes on venues', async () => {
    const client = { $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1 }) };

    await ensureVenueIndexes(client as any);

    expect(client.$runCommandRaw).toHaveBeenCalledWith({
      createIndexes: 'venues',
      indexes: [
        { name: 'venues_location_2dsphere', key: { location: '2dsphere' } },
        {
          name: 'venues_osmRef_unique_partial',
          key: { osmRef: 1 },
          unique: true,
          partialFilterExpression: { osmRef: { $type: 'string' } },
        },
      ],
    });
    expect(RAW_VENUE_INDEXES).toHaveLength(2);
  });
});
