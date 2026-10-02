module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  transformIgnorePatterns: ['node_modules/(?!jose)/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
