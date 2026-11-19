/**
 * Map use cases for VEN-203 and VEN-204.
 *
 * `saveMap` enforces the documented check order — 404 unknown venue, 403 not the
 * owner, 400 malformed payload, 422 business rules — and only then delegates the
 * atomic `version = latestMapVersion + 1` write to the store. A concurrent save
 * that commits the same version first makes the store throw `MapVersionConflictError`;
 * the retry reads the fresh pointer again, so parallel saves end up on consecutive
 * versions instead of losing an update.
 */
import type { AuthenticatedUser } from '../../auth/AuthenticatedUser';
import type MapVersion from '../../entities/MapVersion';
import ApiError from '../../errors/ApiError';
import type { MapValidationIssue } from '../../maps/mapFormat';
import { venueRepository, type VenueStore } from '../../repositories/VenueRepository';
import { MapVersionConflictError, mapVersionRepository, type MapVersionStore } from './MapVersionRepository';
import { checkMapRules } from './mapRules';
import { parseMapPayload } from './parseMapPayload';

export const MAP_VALIDATION_MESSAGE = 'Map validation failed';

/** Retries allowed when two saves race for the same version number. */
export const SAVE_CONFLICT_RETRIES = 3;

export class MapService {
  constructor(
    private readonly venues: Pick<VenueStore, 'findById'> = venueRepository,
    private readonly maps: MapVersionStore = mapVersionRepository
  ) {}

  async saveMap(venueId: string, body: unknown, user?: AuthenticatedUser): Promise<MapVersion> {
    const venue = await this.venues.findById(venueId);
    if (!venue) throw ApiError.notFound(`Venue "${venueId}" not found`);
    if (!venue.belongsTo(user?.userId)) {
      throw ApiError.forbidden('Only the venue owner can save its seat map');
    }

    const map = parseMapPayload(body);
    const issues: MapValidationIssue[] = checkMapRules(map);
    if (issues.length > 0) throw ApiError.unprocessable(MAP_VALIDATION_MESSAGE, { errors: issues });

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.maps.saveNewVersion(venueId, map);
      } catch (error) {
        if (!(error instanceof MapVersionConflictError) || attempt > SAVE_CONFLICT_RETRIES) throw error;
      }
    }
  }

  /** Latest version, or the exact `?version=N` asked for. 404 when the venue or the map is missing. */
  async getMap(venueId: string, version?: number): Promise<MapVersion> {
    const venue = await this.venues.findById(venueId);
    if (!venue) throw ApiError.notFound(`Venue "${venueId}" not found`);

    if (version === undefined) {
      if (venue.latestMapVersion < 1) throw ApiError.notFound(`Venue "${venueId}" has no map yet`);
      const latest = await this.maps.findLatest(venueId);
      if (!latest) throw ApiError.notFound(`Venue "${venueId}" has no map yet`);
      return latest;
    }

    const found = await this.maps.findByVenueVersion(venueId, version);
    if (!found) throw ApiError.notFound(`Venue "${venueId}" has no map version ${version}`);
    return found;
  }
}

export const mapService = new MapService();
