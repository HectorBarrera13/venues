import { prisma } from '../../../src/database/prisma';

/** Empties every collection the service owns. Integration suites start from a blank store. */
export async function resetDatabase(): Promise<void> {
  await prisma.mapVersion.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.venueOwner.deleteMany();
}

export { prisma };
