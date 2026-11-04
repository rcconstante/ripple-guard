import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Backend unit tests (risk engine, validation, services). Mock only in tests.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
