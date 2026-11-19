/**
 * Persistence for immutable seat-map versions (VEN-203/VEN-205).
 *
 * By design this store exposes only `saveNewVersion` and reads: there is no
 * update or delete path anywhere in the service — versions are immutable and
 * the contract test in tests/map/repository.test.ts asserts that surface.
 * The unique index `@@unique([venueId, version])` makes concurrent saves of
 * the same version impossible; one of them gets `MapVersionConflictError` and
 * the service retries with the freshly read pointer.
 */
import { Prisma, type MapVersion as PrismaMapVersion } from '@prisma/client';
import { prisma } from '../../database/prisma';
import MapVersion from '../../entities/MapVersion';
import ApiError from '../../errors/ApiError';
import type { MapPayload } from '../../maps/mapFormat';

/** Thrown when another save committed the same `venueId + version` first. */
export class MapVersionConflictError extends Error {
  constructor(venueId: string, version: number) {
    super(`Map version ${version} of venue "${venueId}" was saved concurrently`);
    this.name = 'MapVersionConflictError';
  }
}

/** Prisma reports a unique index violation (including raw MongoDB indexes) as P2002. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002');
}

function toDomain(record: PrismaMapVersion): MapVersion {
  return new MapVersion({
    venueId: record.venueId,
    version: record.version,
    createdAt: record.createdAt,
    stage: record.stage as unknown as MapPayload['stage'],
    zones: record.zones as unknown as MapPayload['zones'],
    seats: record.seats as unknown as MapPayload['seats'],
  });
}

export interface MapVersionStore {
  saveNewVersion(venueId: string, map: MapPayload): Promise<MapVersion>;
  findByVenueVersion(venueId: string, version: number): Promise<MapVersion | null>;
  findLatest(venueId: string): Promise<MapVersion | null>;
}

export class MapVersionRepository implements MapVersionStore {
  constructor(private readonly client: typeof prisma = prisma) {}

  /**
   * Inserts version `latestMapVersion + 1` and moves the venue pointer in ONE
   * transaction: if either write fails, nothing is persisted and the pointer
   * stays where it was.
   */
  async saveNewVersion(venueId: string, map: MapPayload): Promise<MapVersion> {
    let attemptedVersion = 0;
    try {
      const record = await this.client.$transaction(async (tx) => {
        const venue = await tx.venue.findUnique({ where: { id: venueId } });
        if (!venue) throw ApiError.notFound(`Venue "${venueId}" not found`);
        const version = venue.latestMapVersion + 1;
        attemptedVersion = version;
        const created = await tx.mapVersion.create({
          data: {
            venue: { connect: { id: venueId } },
            version,
            stage: map.stage as unknown as Prisma.InputJsonValue,
            zones: map.zones as unknown as Prisma.InputJsonValue,
            seats: map.seats as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.venue.update({ where: { id: venueId }, data: { latestMapVersion: version } });
        return created;
      });
      return toDomain(record);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // The version number read in this transaction was taken by a concurrent save.
        throw new MapVersionConflictError(venueId, attemptedVersion);
      }
      throw error;
    }
  }

  async findByVenueVersion(venueId: string, version: number): Promise<MapVersion | null> {
    const record = await this.client.mapVersion.findFirst({ where: { venueId, version } });
    return record ? toDomain(record) : null;
  }

  async findLatest(venueId: string): Promise<MapVersion | null> {
    const record = await this.client.mapVersion.findFirst({
      where: { venueId },
      orderBy: { version: 'desc' },
    });
    return record ? toDomain(record) : null;
  }
}

export const mapVersionRepository = new MapVersionRepository();
