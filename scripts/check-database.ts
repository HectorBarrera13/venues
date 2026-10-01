import { prisma } from '../src/database/prisma';

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$runCommandRaw({ ping: 1 });
    console.log('MongoDB connection is ready');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('MongoDB connection failed:', error);
  process.exitCode = 1;
});
