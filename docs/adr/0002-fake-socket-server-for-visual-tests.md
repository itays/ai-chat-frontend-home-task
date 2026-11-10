# Fake Socket.IO server for visual tests

Visual regression tests run the real app against a fake Socket.IO server started by Playwright on its own port, which serves frozen fixture Snapshots (mid-stream responses, running and failed Tool Calls, Unknown Blocks, a finished Chat) and only emits events or rejections when a test asks it to. The app is pointed at it via the existing `VITE_BACKEND_URL`, so production code contains no test hooks, and every screenshot exercises the full path from socket to pixels with deterministic data.

Baselines are generated on macOS and the visual project is tagged `@visual` and excluded from CI, because font rendering differs between macOS and the Linux CI runner. The fix — generating and running baselines inside the official Playwright Docker image — is deferred.

## Considered Options

- **Test-only entry that seeds the store directly.** Less setup, but skips the sync layer and adds a test seam to the app.
- **Storybook stories with screenshot capture.** Good for component isolation, too much setup for the time box.
- **The real backend.** Timing-dependent; cannot freeze a mid-stream state reliably.
