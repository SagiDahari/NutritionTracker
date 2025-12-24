export default {
  testEnvironment: 'node',

  maxWorkers: 1,
  
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',  
    '!**/node_modules/**'
  ],
  
  transform: {},
  
  extensionsToTreatAsEsm: [],
  
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  verbose: true,
  
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};