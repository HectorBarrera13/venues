import type { NextFunction, Request, Response } from 'express';
import { venueService, type VenueService, type VenueUser } from '../services/VenueService';

type VenueRequest = Request & { user?: VenueUser };

function render(venue: { toJSON?: () => unknown }): unknown {
  return typeof venue?.toJSON === 'function' ? venue.toJSON() : venue;
}

export class VenueController {
  constructor(
    private readonly service: Pick<
      VenueService,
      'listVenues' | 'registerVenue' | 'getVenueById'
    > = venueService
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const venues = await this.service.listVenues();
      res.status(200).json(venues.map((venue) => render(venue)));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const venue = await this.service.getVenueById(String(req.params.id ?? ''));
      res.status(200).json(render(venue));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: VenueRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const venue = await this.service.registerVenue(req.body, req.user);
      res.status(201).json(render(venue));
    } catch (error) {
      next(error);
    }
  };
}

export const venueController = new VenueController();