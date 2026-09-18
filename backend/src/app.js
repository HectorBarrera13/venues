const express = require('express');
const venueRoutes = require('./routes/venueRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Routes
app.use('/venues', venueRoutes);
app.use('/api/venues', venueRoutes);

// Error-handling middleware
app.use(errorHandler);

module.exports = app;
