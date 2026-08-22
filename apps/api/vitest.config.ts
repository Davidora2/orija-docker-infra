import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration suites share TEST_DATABASE_URL and truncate tables.
    fileParallelism: false,
  },
});
