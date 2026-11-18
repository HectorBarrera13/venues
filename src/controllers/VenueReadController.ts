import type { NextFunction, Request, Response } from 'express';
import type { VenueJSON } from '../entities/Venue';
import type { VenueSearchHit } from '../repositories/VenueRepository';
import { venueSearchService, type VenueSearchService } from '../services/VenueSearchService';

export type VenueSearchResultJSON = VenueJSON & { distance_km?: number };

/** Serializes a search hit; `distance_km` is included only when present (geospatial searches). */
export function serializeVenueSearchHit(hit: VenueSearchHit): VenueSearchResultJSON {
  const base = hit.venue.toJSON();
  return hit.distanceKm !== undefined ? { ...base, distance_km: hit.distanceKm } : base;
}

/** HTTP controller for venue read and search endpoints (C4-info & C5). */
export class VenueReadController {
  constructor(
    private readonly service: Pick<VenueSearchService, 'searchVenues' | 'getVenueById'> = venueSearchService
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, pagination } = await this.service.searchVenues(req.query);
      res.status(200).json({ data: data.map(serializeVenueSearchHit), pagination });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const venue = await this.service.getVenueById(String(req.params.id ?? ''));
      res.status(200).json(venue.toJSON());
    } catch (error) {
      next(error);
    }
  };
}

export const venueReadController = new VenueReadController();
