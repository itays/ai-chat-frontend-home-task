# Sequence-gated reducer with Snapshot replacement on (re)connect

Chat state is built by a pure reducer that takes one Snapshot per Chat and then applies server events strictly by Sequence Number: an event at or below the Chat's current number is dropped as already reflected, the next number is applied, and anything higher is a Gap that triggers a fresh `chat:get` whose Snapshot replaces the Chat wholesale. Events that arrive before a Chat's Snapshot are buffered and replayed through the same gate. On every socket (re)connect we refetch all three Snapshots and replace — never merge — because a backend restart resets Sequence Numbers to 0, and a merge would silently discard every new event as "already seen".

The socket, buffering, and Gap refetch live in a `chatSync` module that writes into a Zustand store; the reducer itself imports neither Zustand, React, nor Socket.IO, so it is tested in isolation and is the single place where protocol events become Chat state.

## Considered Options

- **Trust arrival order, ignore Sequence Numbers.** Simpler, but breaks on the Snapshot/event race at startup and after reconnects.
- **Refetch the Snapshot on every event.** Correct but turns each streamed word into a round trip.
- **Vercel AI SDK / TanStack AI `useChat` with a custom transport.** Both model a client-initiated request → response stream; this backend pushes events for every Chat (including Turns this tab never started), and we would still need the same sequencing logic plus a translation layer into their message model.
