import express from 'express';
import cors from './middleware/cors';
import errorHandler from './middleware/errorHandler';
import notFound from './middleware/notFound';
import healthRoutes from './routes/healthRoutes';
import readyRoutes from './routes/readyRoutes';
import venueRoutes from './routes/venueRoutes';

const app = express();

app.use(cors);
app.use(express.json());
app.use('/venues', venueRoutes);
app.use('/api/venues', venueRoutes);
app.use('/health', healthRoutes);
app.use('/ready', readyRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;