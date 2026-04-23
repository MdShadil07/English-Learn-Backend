module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).cjs'],
  transform: {},
  moduleFileExtensions: ['cjs', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/'],
};
