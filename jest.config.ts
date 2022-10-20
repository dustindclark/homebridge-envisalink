export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**',
    '!src/constants.ts',
    '!src/**Types.ts',
    '!src/types.ts',
    '!src/settings.ts',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: [
    'text',
    'lcov',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 15,
      lines: 7,
      statements: 7,
    },
  },
  preset: 'ts-jest',
};
