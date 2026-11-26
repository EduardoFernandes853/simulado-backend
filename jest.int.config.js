const { createDefaultPreset } = require('ts-jest');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.int.test.ts'],
  transform: { ...createDefaultPreset().transform },
  setupFiles: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.int.setup.ts'],
  maxWorkers: 1, // um banco só: os arquivos não podem rodar em paralelo
  testTimeout: 30000,
};