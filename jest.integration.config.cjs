/**
 * Integration and end-to-end suites (VEN-701, VEN-704): real Express app +
 * real Prisma client + a MongoDB replica set. Run with `npm run test:integration`.
 * See tests/integration/setup/globalSetup.ts for how the database is provided.
 */
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testMatch: ['<rootDir>/tests/integration/**/*.int.test.ts'],
  globalSetup: '<rootDir>/tests/integration/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/integration/setup/globalTeardown.ts',
  testTimeout: 60000,
};
