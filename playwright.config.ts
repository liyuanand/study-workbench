import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'small-phone',
      use: {
        ...devices['iPhone 13 Mini'],
        browserName: 'chromium',
        launchOptions: {
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        },
      },
    },
  ],
})
