module.exports = {
  testEnvironment: "node",
  testTimeout: 120000, // 2 minutes 
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  verbose: true,
  // Don't run tests in parallel against the same in-memory DB instance
  maxWorkers: 1,
};
