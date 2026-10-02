import { Router } from 'express';
import { authenticate } from '../auth/createAuth';
import { Roles } from '../auth/roles';
import { venueController } from '../controllers/VenueController';
import { rejectOwnershipInjection } from '../middleware/rejectOwnershipInjection';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/', venueController.list);
router.post(
  '/',
  authenticate,
  requireRole(Roles.VENUE_OWNER),
  rejectOwnershipInjection,
  venueController.create,
);

export default router;
