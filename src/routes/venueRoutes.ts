import { Router } from 'express';
import { venueController } from '../controllers/VenueController';

const router = Router();

router.get('/', venueController.list);
router.post('/', venueController.create);

export default router;
