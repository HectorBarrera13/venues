module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
