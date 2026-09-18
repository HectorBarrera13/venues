const express = require('express');
const venueRoutes = require('./routes/venueRoutes');

const app = express();

app.use(express.json());

// Routes
app.use('/venues', venueRoutes);
app.use('/api/venues', venueRoutes);

// Error-handling middleware placeholder (Task 7 will formalize ApiError)
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

module.exports = app;
