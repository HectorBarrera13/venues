import express from 'express';
import cors from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import notFound from './middleware/notFound';
import { MAP_BODY_LIMIT } from './maps/mapFormat';
import healthRoutes from './routes/healthRoutes';
import mapRoutes from './routes/mapRoutes';
import readyRoutes from './routes/readyRoutes';
import venueRoutes from './routes/venueRoutes';

const app = express();

app.use(cors);
// Seat maps can hold up to MAP_LIMITS.maxSeats seats, far above the default 100 kB body limit.
app.use(['/venues/:id/map', '/api/venues/:id/map'], express.json({ limit: MAP_BODY_LIMIT }));
app.use(express.json());
app.use('/venues/:id/map', mapRoutes);
app.use('/api/venues/:id/map', mapRoutes);
app.use('/venues', venueRoutes);
app.use('/api/venues', venueRoutes);
app.use('/health', healthRoutes);
app.use('/ready', readyRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;