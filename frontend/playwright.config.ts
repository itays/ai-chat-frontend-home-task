import { defineConfig, devices } from "@playwright/test";
import { BACKEND_PORT, BACKEND_URL as backendURL } from "./e2e/backend.ts";

// E2E runs its own backend and frontend on dedicated ports so it never
// touches the `npm start` servers (4000 / 5173) or their in-memory state.
const FRONTEND_PORT = 5174;
const baseURL = `http://127.0.0.1:${FRONTEND_PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node ../backend/src/main.ts",
      env: { PORT: String(BACKEND_PORT), DELAY_SCALE: "0.05" },
      // Socket.IO's polling handshake answers 200 once the server is up.
      url: `${backendURL}/socket.io/?EIO=4&transport=polling`,
      reuseExistingServer: !isCI,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      env: { VITE_BACKEND_URL: backendURL },
      url: baseURL,
      reuseExistingServer: !isCI,
    },
  ],
});
