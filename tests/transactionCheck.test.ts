import { checkTransactions, PROBE_ID_PREFIX } from '../src/database/transactionCheck';

type Owner = { id: string; name: string };

/**
 * Minimal Prisma double with real commit/rollback semantics: writes made
 * inside `$transaction` are staged and only applied when the callback resolves.
 */
function fakeClient({ setName = 'rs0', transactional = true }: { setName?: string; transactional?: boolean } = {}) {
  const owners = new Map<string, Owner>();
  const ownerApi = (target: Map<string, Owner>) => ({
    create: jest.fn(async ({ data }: { data: Owner }) => {
      target.set(data.id, data);
      return data;
    }),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => owners.get(where.id) ?? null),
    deleteMany: jest.fn(async ({ where }: { where: { id: { startsWith: string } } }) => {
      for (const id of [...owners.keys()]) if (id.startsWith(where.id.startsWith)) owners.delete(id);
      return { count: 0 };
    }),
  });

  const client = {
    owners,
    $runCommandRaw: jest.fn(async () => (setName ? { setName } : {})),
    venueOwner: ownerApi(owners),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const staged = transactional ? new Map<string, Owner>() : owners;
      const result = await fn({ venueOwner: ownerApi(staged) });
      for (const [id, owner] of staged) owners.set(id, owner);
      return result;
    }),
  };
  return client;
}

describe('checkTransactions (VEN-701)', () => {
  it('reports the replica set, a committed write and a rolled-back write', async () => {
    const client = fakeClient();
    await expect(checkTransactions(client as any)).resolves.toEqual({
      replicaSet: 'rs0',
      committed: true,
      rolledBack: true,
    });
  });

  it('removes every probe document it wrote', async () => {
    const client = fakeClient();
    await checkTransactions(client as any);
    expect([...client.owners.keys()].filter((id) => id.startsWith(PROBE_ID_PREFIX))).toEqual([]);
  });

  it('fails fast on a standalone server, before writing anything', async () => {
    const client = fakeClient({ setName: '' });
    await expect(checkTransactions(client as any)).rejects.toThrow(/not running as a replica set/);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('detects a store that ignores rollbacks', async () => {
    const client = fakeClient({ transactional: false });
    const result = await checkTransactions(client as any);
    expect(result.rolledBack).toBe(false);
  });
});
