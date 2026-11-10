# Backend

A scripted Socket.IO backend. It has no database and no real model: every conversation follows a fixed script in [`scripts/`](scripts).

[`PROTOCOL.md`](PROTOCOL.md) documents everything your client needs: requests, events, block types, and ordering guarantees. You should not need to read the source code.

Run it from the repository root with `npm start`, together with the frontend, or on its own with `npm start -w backend`.

Run its tests with `npm test -w backend`.
