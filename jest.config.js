module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/tests/security/**/*.test.js',
    '<rootDir>/tests/schema/**/*.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/admin/public/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  setupFiles: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
};
