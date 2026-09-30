import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/visual.spec.js',
  timeout: 45_000,
  retries: 1,
  workers: 2,
  // Failing test names must be readable from the Actions summary without downloading logs.
  reporter: process.env.CI ? [['dot'], ['github']] : [['list']],
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
