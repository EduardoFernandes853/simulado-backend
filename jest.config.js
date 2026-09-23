const { createDefaultPreset } = require('ts-jest');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: { ...createDefaultPreset().transform },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/prisma.ts', '!src/config.ts'],
  coverageDirectory: 'coverage',
};