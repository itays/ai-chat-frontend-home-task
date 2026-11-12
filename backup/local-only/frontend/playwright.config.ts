import { defineConfig, devices } from "@playwright/test";
import { BACKEND_PORT, BACKEND_URL as backendURL } from "./e2e/backend.ts";
import { FAKE_SERVER_URL } from "./e2e/visual/fixtures.ts";

// E2E runs its own backend and frontend on dedicated ports so it never
// touches the `npm start` servers (4000 / 5173) or their in-memory state.
const FRONTEND_PORT = 5174;
const baseURL = `http://127.0.0.1:${FRONTEND_PORT}`;
// Visual tests point a second frontend at the fake server (see ADR-0002).
const VISUAL_FRONTEND_PORT = 5175;
const visualBaseURL = `http://127.0.0.1:${VISUAL_FRONTEND_PORT}`;
const isCI = !!process.env.CI;

// Socket.IO's polling handshake answers once the server is up.
const socketIoReadyURL = (serverURL: string) =>
  `${serverURL}/socket.io/?EIO=4&transport=polling`;

export default defineConfig({
  testDir: "./e2e",
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
      testMatch: "**/*.e2e.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Local only: baselines are rendered on macOS (see ADR-0002).
      name: "visual",
      testMatch: "**/*.visual.ts",
      // The fake server's state is shared, so tests take turns.
      workers: 1,
      use: { ...devices["Desktop Chrome"], baseURL: visualBaseURL },
    },
  ],
  webServer: [
    {
      command: "node ../backend/src/main.ts",
      env: { PORT: String(BACKEND_PORT), DELAY_SCALE: "0.05" },
      url: socketIoReadyURL(backendURL),
      reuseExistingServer: !isCI,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      env: { VITE_BACKEND_URL: backendURL },
      url: baseURL,
      reuseExistingServer: !isCI,
    },
    // CI never runs the visual project, so it skips the servers that feed it.
    ...(isCI
      ? []
      : [
          {
            command: "node e2e/visual/fakeServer.ts",
            url: socketIoReadyURL(FAKE_SERVER_URL),
            reuseExistingServer: true,
          },
          {
            command: `npm run dev -- --host 127.0.0.1 --port ${VISUAL_FRONTEND_PORT}`,
            env: { VITE_BACKEND_URL: FAKE_SERVER_URL },
            url: visualBaseURL,
            reuseExistingServer: true,
          },
        ]),
  ],
});
