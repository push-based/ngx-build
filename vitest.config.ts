import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['**/*/vite.config.mts', '**/*/vite.config.ts'],
  },
});
