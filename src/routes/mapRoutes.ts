import { Router } from 'express';
import { mapController } from '../controllers/MapController';
import { AUTH_CONFIG, PARTNER_ROLES } from '../auth/authConfig';
import authenticate from '../middleware/authenticate';
import requireRole from '../middleware/requireRole';

/**
 * Seat-map routes, mounted at `/venues/:id/map`. Contract: docs/map-format.md.
 *
 * POST saves a new immutable version (VEN-203) and must come from the venue's
 * owner; GET reads the latest or an exact version and is open to every
 * authenticated partner role (VEN-204/VEN-308). Status ordering is enforced by
 * MapService: 404 unknown venue, 403 not the owner, 400 malformed payload,
 * 422 business-rule violations.
 */
const router = Router({ mergeParams: true });

router.post('/', authenticate, requireRole(AUTH_CONFIG.roles.VENUE_OWNER), mapController.save);

router.get('/', authenticate, requireRole(...PARTNER_ROLES), mapController.read);

export default router;
