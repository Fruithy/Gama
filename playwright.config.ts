import { defineConfig, devices } from "@playwright/test";

/**
 * Critical mobile flows against a real production build (`next build && next start`)
 * with a fresh, throwaway PGlite database.
 */
const PORT = Number(process.env.E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone 13"],
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `rm -rf .data/e2e-db && npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI && !!process.env.E2E_REUSE,
    env: {
      PGLITE_DATA_DIR: ".data/e2e-db",
      SESSION_SECRET: "e2e-session-secret-0123456789abcdef",
      ADMIN_SECRET: "e2e-admin-secret",
      AUTO_SEED: "false",
      RATE_LIMIT_MULTIPLIER: "50",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
    },
  },
});
