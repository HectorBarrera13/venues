import { prisma } from '../src/database/prisma';
import { ensureVenueIndexes, RAW_VENUE_INDEXES } from '../src/database/indexes';

async function main(): Promise<void> {
  try {
    await ensureVenueIndexes(prisma);
    console.log(`Venue indexes ready: ${RAW_VENUE_INDEXES.map((index) => index.name).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Creating venue indexes failed:', error);
  process.exitCode = 1;
});
