/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  clearMocks: true,
};
