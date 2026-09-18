const express = require('express');
const { venueController } = require('../controllers/VenueController');

const router = express.Router();

// GET /venues (Task 5)
router.get('/', venueController.list);

// POST /venues (Task 2)
router.post('/', venueController.create);

module.exports = router;
