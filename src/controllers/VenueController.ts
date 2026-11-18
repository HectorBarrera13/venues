import type { NextFunction, Request, Response } from 'express';
import type Venue from '../entities/Venue';
import { venueService, type VenueService, type VenueUser } from '../services/VenueService';

type VenueRequest = Request & { user?: VenueUser };

function render(venue: Venue): unknown {
  return venue.toJSON();
}

export class VenueController {
  constructor(
    private readonly service: Pick<VenueService, 'listVenues' | 'registerVenue' | 'getVenueById'> = venueService
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data, pagination } = await this.service.listVenues(req.query);
      res.status(200).json({ data: data.map(render), pagination });
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
