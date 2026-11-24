import { prisma } from '../src/database/prisma';
import { checkTransactions } from '../src/database/transactionCheck';

/**
 * `npm run db:verify-tx` — commits one transaction and rolls another back
 * against DATABASE_URL, failing unless both behave as expected (VEN-701).
 */
async function main(): Promise<void> {
  try {
    const result = await checkTransactions(prisma);
    console.log(`Replica set: ${result.replicaSet}`);
    console.log(`Commit:   ${result.committed ? 'ok' : 'FAILED'}`);
    console.log(`Rollback: ${result.rolledBack ? 'ok' : 'FAILED'}`);
    if (!result.committed || !result.rolledBack) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Transaction check failed:', error);
  process.exitCode = 1;
});
