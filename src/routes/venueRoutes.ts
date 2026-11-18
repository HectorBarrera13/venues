import { Router } from 'express';
import { AUTH_CONFIG } from '../auth/authConfig';
import { venueController } from '../controllers/VenueController';
import { venueReadController } from '../controllers/VenueReadController';
import authenticate from '../middleware/authenticate';
import requireRole from '../middleware/requireRole';

const router = Router();

router.get('/', authenticate, venueReadController.list);
router.get('/:id', authenticate, venueReadController.getById);
router.post('/', authenticate, requireRole(AUTH_CONFIG.roles.VENUE_OWNER), venueController.create);

export default router;
