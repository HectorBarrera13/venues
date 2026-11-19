import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/AuthenticatedUser';
import { mapService, type MapService } from '../services/map/MapService';
import { parseMapVersionQuery } from '../validation/mapInput';

type MapRequest = Request & { user?: AuthenticatedUser };

/**
 * Thin HTTP layer for `/venues/{id}/map` (VEN-203/VEN-204). All rules live in
 * `MapService`; errors are forwarded to the single `errorHandler`.
 */
export class MapController {
  constructor(private readonly service: MapService = mapService) {}

  save = async (req: MapRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const map = await this.service.saveMap(String(req.params.id ?? ''), req.body, req.user);
      res.status(201).json(map.toJSON());
    } catch (error) {
      next(error);
    }
  };

  read = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const version = parseMapVersionQuery(req.query);
      const map = await this.service.getMap(String(req.params.id ?? ''), version);
      res.status(200).json(map.toJSON());
    } catch (error) {
      next(error);
    }
  };
}

export const mapController = new MapController();
