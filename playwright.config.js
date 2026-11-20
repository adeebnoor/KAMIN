import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Task 48: e2e/zz-*.spec.js are local probes (git-ignored); they never run with the suite or count on the tests page.
  testIgnore: ['**/visual.spec.js', '**/zz-*.spec.js'],
  timeout: 45_000,
  retries: 1,
  workers: 2,
  // Failing test names must be readable from the Actions summary without downloading logs.
  // Task 17: every run also leaves reports/playwright.json for `npm run test:report` (public/tests.html).
  reporter: [...(process.env.CI ? [['dot'], ['github']] : [['list']]), ['json', { outputFile: 'reports/playwright.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
