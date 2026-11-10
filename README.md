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

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_BACKEND_URL` | `frontend/.env.local` | `http://localhost:4000` | Backend URL used by the frontend. |
| `PORT` | Environment | `4000` | Backend port. |
| `DELAY_SCALE` | Environment | `1` | Multiplies every streaming delay. `0.2` is five times faster; `0` is instant. |

The backend keeps all state in memory. Restart `npm start` to reset every conversation.
