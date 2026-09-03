/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    // Consume the contracts package from SOURCE in tests, so unit tests run
    // without a prior `pnpm --filter @mystore/contracts build`.
    '^@mystore/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  maxWorkers: 2,
};
