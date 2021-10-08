module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: [
    '<rootDir>/test/**/*.test.(ts|js)'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts'
  ]
};
