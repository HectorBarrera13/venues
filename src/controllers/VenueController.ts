import type { NextFunction, Request, Response } from 'express';
import { venueService, type VenueService } from '../services/VenueService';
import { currentUserProvider, type ICurrentUserProvider } from '../providers/CurrentUserProvider';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Internal Server Error';
}

export class VenueController {
  constructor(
    private readonly service: Pick<VenueService, 'listVenues' | 'registerVenue'> = venueService,
    private readonly userProvider: ICurrentUserProvider = currentUserProvider,
  ) {}

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

  create = async (req: Request, res: Response, next?: NextFunction): Promise<Response | void> => {
    try {
      const currentUser = this.userProvider.getCurrentUser(req);
      const venue = await this.service.registerVenue(req.body, currentUser);
      const body = typeof venue?.toJSON === 'function' ? venue.toJSON() : venue;
      return res.status(201).json(body);
    } catch (error) {
      if (next) return next(error);
      const status = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
      return res.status(status).json({ error: errorMessage(error) });
    }
  };
}

export const venueController = new VenueController();
