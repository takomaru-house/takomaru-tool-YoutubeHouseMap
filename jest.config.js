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
    // Sprint 2 完了時点の達成水準。Sprint 5 で branches を 80% に引き上げる。
    global: {
      branches: 70,
      functions: 85,
      lines: 95,
      statements: 90,
    },
  },
  setupFiles: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
};
