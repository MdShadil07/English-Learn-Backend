module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{2}/.*)\\.js$': '$1.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }],
  },
  globals: {
    'ts-jest': {
      diagnostics: {
        ignoreCodes: [151002],
      },
    },
  },
  testPathIgnorePatterns: ['<rootDir>/src/test.ts'],
};
