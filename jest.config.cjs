module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  // tests/integration needs a MongoDB replica set: run it with `npm run test:integration`.
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/tests/integration/'],
};
