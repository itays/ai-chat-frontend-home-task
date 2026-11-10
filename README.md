# AI Chat Home Task

Starter repository for the AI chat frontend home task.

## Layout

| Folder | Contents |
| --- | --- |
| [`backend/`](backend) | The scripted Socket.IO backend. Do not modify it. [`backend/PROTOCOL.md`](backend/PROTOCOL.md) documents everything your client needs. |
| [`frontend/`](frontend) | A bare Vite, React, and TypeScript app. Build your solution here. |

## How to run

Prerequisite: Node.js 24 or later.

```bash
npm install
npm start
```

`npm start` runs both apps:

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

`npm test` runs the tests of every workspace that defines a `test` script.

## Testing

The frontend uses Vitest with React Testing Library (jsdom). Put test files next to the code they cover as `src/**/*.test.ts(x)`.

```bash
npm run test -w frontend        # run once
npm run test:watch -w frontend  # watch mode
```

End-to-end tests use Playwright (Chromium) and live in `frontend/e2e/*.e2e.ts`. Playwright starts the dev server on `http://127.0.0.1:5173`, or reuses one that is already running.

```bash
npx -w frontend playwright install chromium  # once, downloads the browser
npm run test:e2e -w frontend         # full suite
npm run test:e2e:smoke -w frontend   # @smoke-tagged tests only (what CI runs)
npm run test:e2e:headed -w frontend  # watch the browser
npm run test:e2e:ui -w frontend      # Playwright UI mode
```

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_BACKEND_URL` | `frontend/.env.local` | `http://localhost:4000` | Backend URL used by the frontend. |
| `PORT` | Environment | `4000` | Backend port. |
| `DELAY_SCALE` | Environment | `1` | Multiplies every streaming delay. `0.2` is five times faster; `0` is instant. |

The backend keeps all state in memory. Restart `npm start` to reset every conversation.
