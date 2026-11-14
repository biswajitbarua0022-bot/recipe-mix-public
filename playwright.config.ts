import { defineConfig, devices } from '@playwright/test'

const host = 'http://127.0.0.1:4174'

export default defineConfig({
  testDir: './e2e',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `${host}/recipe-mix-public/`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174',
    url: `${host}/recipe-mix-public/`,
  },
})
