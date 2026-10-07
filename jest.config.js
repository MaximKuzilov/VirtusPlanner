module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/VirtusPlanner/VirtusPlanner/'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
};
