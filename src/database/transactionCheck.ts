import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Proves that the venue store accepts multi-document transactions (VEN-701).
 *
 * MongoDB only supports transactions on a replica set; on a standalone server
 * `prisma.$transaction` fails, and the seat-map save (VEN-203) would lose its
 * atomicity guarantee. This check writes probe documents only, which are
 * always removed before returning.
 */
export interface TransactionCheckResult {
  /** Replica set name reported by the server (`hello.setName`). */
  replicaSet: string;
  /** A committed transaction left its write behind. */
  committed: boolean;
  /** A transaction that threw left nothing behind. */
  rolledBack: boolean;
}

type TransactionClient = Pick<PrismaClient, '$runCommandRaw' | '$transaction' | 'venueOwner'>;

/** Prefix of the probe owners, so a crashed run can always be cleaned up. */
export const PROBE_ID_PREFIX = 'tx-probe-';

class ForcedRollback extends Error {
  constructor() {
    super('forced rollback (transaction check)');
    this.name = 'ForcedRollback';
  }
}

export async function checkTransactions(client: TransactionClient): Promise<TransactionCheckResult> {
  const hello = (await client.$runCommandRaw({ hello: 1 })) as { setName?: unknown };
  if (typeof hello.setName !== 'string' || !hello.setName) {
    throw new Error('MongoDB is not running as a replica set: transactions are unavailable (see compose.yaml)');
  }

  const committedId = `${PROBE_ID_PREFIX}${randomUUID()}`;
  const rolledBackId = `${PROBE_ID_PREFIX}${randomUUID()}`;

  try {
    await client.$transaction(async (tx) => {
      await tx.venueOwner.create({ data: { id: committedId, name: 'transaction probe' } });
    });
    const committed = (await client.venueOwner.findUnique({ where: { id: committedId } })) !== null;

    try {
      await client.$transaction(async (tx) => {
        await tx.venueOwner.create({ data: { id: rolledBackId, name: 'transaction probe' } });
        throw new ForcedRollback();
      });
    } catch (error) {
      if (!(error instanceof ForcedRollback)) throw error;
    }
    const rolledBack = (await client.venueOwner.findUnique({ where: { id: rolledBackId } })) === null;

    return { replicaSet: hello.setName, committed, rolledBack };
  } finally {
    await client.venueOwner.deleteMany({ where: { id: { startsWith: PROBE_ID_PREFIX } } });
  }
}
