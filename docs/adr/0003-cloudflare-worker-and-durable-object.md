# Cloudflare Worker and Durable Object over plain WebSockets

The app is deployed on Cloudflare's free plan as one Worker. The Worker serves the built frontend as static assets and forwards `/ws` to a single Durable Object, `ChatRoom`, which holds every Chat in memory and speaks JSON request, acknowledgement, and event frames over plain WebSockets (see `backend/PROTOCOL.md`). Socket.IO is gone from both ends.

Socket.IO's server needs a Node `http` server, and a Worker cannot host one. A Durable Object can accept WebSockets, and one instance keeps the backend's model: a single process with all state in memory, broadcasting every event to every client. The Chat logic (`ChatStore`, `Conversations`, the scripts) moved unchanged; only the transport glue was rewritten. The frontend kept its `ChatTransport` seam, so `chatSync` and the reducer did not change.

The Durable Object accepts sockets with the standard API, not the Hibernation API. Hibernation would evict the Chats and the timers of a playing Turn while clients are still connected. State still resets when the Durable Object is evicted after its last client leaves, as it did when the old backend restarted.

## Considered Options

- **Keep Socket.IO on Cloudflare Containers.** Runs the Node server as it was, but Containers need the Workers Paid plan ($5 a month).
- **One Durable Object per Chat.** Would scale past one instance, but every client wants every Chat's events, so it adds fan-out for no benefit at this size.
