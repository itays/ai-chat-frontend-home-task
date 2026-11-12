# Backend

A scripted chat backend. It runs as a Cloudflare Worker with one Durable Object and speaks JSON over a WebSocket at `/ws`. It has no database and no real model: every conversation follows a fixed script in [`scripts/`](scripts).

[`PROTOCOL.md`](PROTOCOL.md) documents everything your client needs: requests, events, block types, and ordering guarantees. You should not need to read the source code.

Run it from the repository root with `npm start`, together with the frontend, or on its own with `npm start -w backend`. Both run `wrangler dev` on port 4000.

Run its tests with `npm test -w backend`. They start the Worker in local workerd for each test.

Deploy it together with the frontend with `npm run deploy` from the repository root (see the root README).
