const { createDefaultPreset } = require('ts-jest');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$'],
  transform: { ...createDefaultPreset().transform },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/instrument.ts',
    '!src/prisma.ts',
    '!src/config.ts',
    '!src/integracao/**',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 75,
      functions: 90,
      lines: 85,
    },
  },
};