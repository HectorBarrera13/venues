import { Router } from 'express';
import { AUTH_CONFIG, PARTNER_ROLES } from '../auth/authConfig';
import { venueController } from '../controllers/VenueController';
import authenticate from '../middleware/authenticate';
import requireRole from '../middleware/requireRole';

const router = Router();

router.get('/', authenticate, requireRole(...PARTNER_ROLES), venueController.list);
router.get('/:id', authenticate, requireRole(...PARTNER_ROLES), venueController.getById);
router.post('/', authenticate, requireRole(AUTH_CONFIG.roles.VENUE_OWNER), venueController.create);

export default router;
