import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/root",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4174/",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "npm run preview -- --outDir dist-root --port 4174 --strictPort",
    env: { DEPLOY_BASE_PATH: "/" },
    url: "http://127.0.0.1:4174/",
    reuseExistingServer: !process.env.CI,
  },
});
