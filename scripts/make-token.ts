/**
 * Development helper: mints access tokens signed with JWT_SECRET.
 *
 * Usage:
 *   npm run token:make -- --role VENUE_OWNER --sub owner-1
 *   npm run token:make -- --role ORGANIZER --sub organizer-1 --expired
 *   TOKEN=$(scripts/make-token --role VENUE_OWNER --sub owner-1)
 *
 * This script only issues tokens; there is no login endpoint and the
 * production middleware is the one used in every environment.
 */
import path from 'node:path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { AUTH_CONFIG, getJwtSecret, normalizeRole } from '../src/auth/authConfig';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60;
const VALID_ROLES: readonly string[] = Object.values(AUTH_CONFIG.roles);

interface Options {
  role: string;
  sub: string;
  expiresInSeconds: number;
}

function usage(): string {
  return [
    'Usage: scripts/make-token --role <VENUE_OWNER|ORGANIZER> --sub <user-id> [options]',
    '',
    'Options:',
    `  --role <role>      Required. Role claim value: ${VALID_ROLES.join(' | ')}`,
    '  --sub <user-id>    Required. Value of the "sub" claim (user id).',
    `  --expires-in <s>   Token lifetime in seconds (default ${DEFAULT_EXPIRES_IN_SECONDS}).`,
    '  --expired          Issue an already expired token (lifetime -60s).',
    '  --name <name>      Optional value for the "name" claim.',
    '  --help             Show this message.',
  ].join('\n');
}

function readValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseArgs(argv: string[]): Options {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    process.exit(0);
  }

  const rawRole = readValue(argv, '--role');
  if (!rawRole) {
    throw new Error(`Missing required --role\n\n${usage()}`);
  }

  const role = normalizeRole(rawRole);
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Unknown role "${rawRole}". Valid roles: ${VALID_ROLES.join(', ')}`);
  }

  const sub = readValue(argv, '--sub');
  if (!sub) {
    throw new Error(`Missing required --sub\n\n${usage()}`);
  }

  const expiresIn = readValue(argv, '--expires-in');
  const expiresInSeconds = expiresIn ? Number(expiresIn) : DEFAULT_EXPIRES_IN_SECONDS;
  if (!Number.isFinite(expiresInSeconds)) {
    throw new Error(`--expires-in must be a number, received "${expiresIn}"`);
  }

  return {
    role,
    sub,
    expiresInSeconds: argv.includes('--expired') ? -60 : expiresInSeconds,
  };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const claims: Record<string, unknown> = { [AUTH_CONFIG.claims.role]: options.role };

  const name = readValue(process.argv.slice(2), '--name');
  if (name) {
    claims[AUTH_CONFIG.claims.name] = name;
  }

  const token = jwt.sign(claims, getJwtSecret(), {
    algorithm: AUTH_CONFIG.algorithm,
    subject: options.sub,
    expiresIn: options.expiresInSeconds,
  });

  console.log(token);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}