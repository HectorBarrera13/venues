import type { NextFunction, Request, Response } from 'express';
import { venueService, type VenueService, type VenueUser } from '../services/VenueService';

type VenueRequest = Request & { user?: VenueUser };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error';
}

export class VenueController {
  constructor(private readonly service: Pick<VenueService, 'listVenues' | 'registerVenue'> = venueService) {}

  list = async (_req: Request, res: Response, next?: NextFunction): Promise<Response | void> => {
    try {
      const venues = await this.service.listVenues();
      return res.status(200).json(venues.map((venue) =>
        typeof venue?.toJSON === 'function' ? venue.toJSON() : venue
      ));
    } catch (error) {
      if (next) return next(error);
      return res.status(500).json({ error: errorMessage(error) });
    }
  };

  create = async (req: VenueRequest, res: Response, next?: NextFunction): Promise<Response | void> => {
    try {
      const venue = await this.service.registerVenue(req.body, req.user);
      const body = typeof venue?.toJSON === 'function' ? venue.toJSON() : venue;
      return res.status(201).json(body);
    } catch (error) {
      if (next) return next(error);
      const candidate = typeof error === 'object' && error !== null
        ? error as { statusCode?: number; status?: number }
        : {};
      const status = candidate.statusCode || candidate.status || 500;
      return res.status(status).json({ error: errorMessage(error) });
    }
  };
}

export const venueController = new VenueController();
