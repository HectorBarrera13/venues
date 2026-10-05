import type { PrismaClient } from '@prisma/client';
import { prisma } from '../database/prisma';

/** Minimal client surface the readiness probe needs from the venue store. */
export type VenueStoreConnection = Pick<PrismaClient, '$runCommandRaw'>;

/**
 * Milliseconds the probe waits before declaring the venue store unreachable.
 * Orchestrators use short readiness timeouts, so a store that accepts the
 * connection but never answers must not hold the probe open.
 */
const DEFAULT_TIMEOUT_MS = 2000;

export class ReadinessService {
  constructor(
    private readonly client: VenueStoreConnection = prisma,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  async checkVenueStore(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), this.timeoutMs);
      });
      const ping = this.client.$runCommandRaw({ ping: 1 }).then(() => true);

      return await Promise.race([ping, timeout]);
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const readinessService = new ReadinessService();

export default readinessService;