import { defineConfig } from "@playwright/test";
import path from "node:path";
const baseURL = "http://127.0.0.1:8765";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL,
    headless: true,
  },
  reporter: "list",
  webServer: {
    command: `${process.env.PYTHON || ".venv/bin/python"} manage.py migrate --noinput && ${process.env.PYTHON || ".venv/bin/python"} manage.py seed_demo && ${process.env.PYTHON || ".venv/bin/python"} manage.py runserver 127.0.0.1:8765 --noreload`,
    url: `${baseURL}/api/session`,
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      DATABASE_URL: `sqlite:///${path.resolve("db.e2e.sqlite3")}`,
      NONHUMAN_DEBUG: "1",
      DEMO_MODE: "1",
      PUBLIC_URL: baseURL,
      ALLOWED_HOSTS: "localhost,127.0.0.1",
    },
  },
});
