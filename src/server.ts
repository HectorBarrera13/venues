import app from './app';
import { prisma } from './database/prisma';

const port = Number(process.env.PORT || 3000);

prisma.$connect()
  .then(() => {
    app.listen(port, () => console.log(`Server listening on port ${port}`));
  })
  .catch((error: unknown) => {
    console.error('MongoDB connection failed:', error);
    process.exitCode = 1;
  });
