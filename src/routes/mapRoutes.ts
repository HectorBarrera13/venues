import { Router, type NextFunction, type Request, type Response } from 'express';
import { AUTH_CONFIG, PARTNER_ROLES } from '../auth/authConfig';
import ApiError from '../errors/ApiError';
import authenticate from '../middleware/authenticate';
import requireRole from '../middleware/requireRole';
import { parseMapVersionQuery } from '../validation/mapInput';

/**
 * Seat-map routes, mounted at `/venues/:id/map`. Contract: docs/map-format.md.
 *
 * Contract stubs (VEN-003): authentication, roles and request parameters are
 * already enforced so clients can integrate against the final URLs and status
 * codes; the operations themselves answer 501 until they are implemented.
 */
const router = Router({ mergeParams: true });

router.post(
  '/',
  authenticate,
  requireRole(AUTH_CONFIG.roles.VENUE_OWNER),
  (_req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notImplemented('Saving a seat map is not implemented yet'));
  }
);

router.get(
  '/',
  authenticate,
  requireRole(...PARTNER_ROLES),
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      parseMapVersionQuery(req.query);
      next(ApiError.notImplemented('Reading a seat map is not implemented yet'));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
