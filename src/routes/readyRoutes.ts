import { Router } from 'express';
import { readinessService } from '../services/ReadinessService';

/** Readiness contract consumed by the route, independent of the concrete service. */
export interface ReadinessProbe {
  checkVenueStore(): Promise<boolean>;
}

/**
 * `GET /ready` — unauthenticated readiness probe. Answers 503 while the venue
 * store is unreachable so orchestrators stop routing traffic to this replica.
 */
export function createReadyRouter(probe: ReadinessProbe = readinessService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const reachable = await probe.checkVenueStore();
      res.status(reachable ? 200 : 503).json({
        status: reachable ? 'ready' : 'not_ready',
        venueStore: reachable ? 'up' : 'down',
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createReadyRouter();