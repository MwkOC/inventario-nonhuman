import { defineConfig } from "@playwright/test";
import path from "node:path";
const baseURL = "http://127.0.0.1:8766";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  use: {
    baseURL,
    headless: true,
  },
  reporter: "list",
  webServer: [
    {
      command:
        "node scripts/manage.mjs migrate && node scripts/manage.mjs seed-demo && npx next start --hostname 127.0.0.1 --port 8766",
      url: `${baseURL}/api/session`,
      reuseExistingServer: false,
      timeout: 90000,
      env: {
        DATABASE_URL: `sqlite:${path.resolve("db.next.e2e.sqlite3")}`,
        APP_ENV: "development",
        DEMO_MODE: "1",
        LOCAL_EMAIL_DIR: path.resolve("test-results/emails"),
        PUBLIC_URL: baseURL,
      },
    },
  ],
});
