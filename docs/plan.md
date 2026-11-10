# Implementation plan

Outcome of the design grilling. Vocabulary follows [`GLOSSARY.md`](../GLOSSARY.md); architecture decisions are in [`docs/adr/`](./adr/). Work lands on `main`, one commit per slice.

## Decisions

### State and synchronisation
- **Pure reducer** (`applySnapshot`, `applyEvent`) with no Zustand/React/Socket.IO imports. Sequence-gated: `seq ≤ current` → drop, `seq === current + 1` → apply, `seq > current + 1` → Gap → refetch Snapshot and replace. See ADR-0001.
- **Nested state** (chat → messages → blocks) with structural sharing; immutable updates via spreads and two small helpers (`updateMessage`, `updateBlock`). No Immer.
- **Zustand store** holds `{ chatOrder, chats: Record<id, ChatState>, connection }`. Narrow selectors: sidebar → summaries, chat view → message ids, message/block components → their own object, wrapped in `memo`.
- **`chatSync` module** owns the socket (injected, so tests use a fake): connect → `chats:list` → `chat:get` for all Chats eagerly, buffer early events, refetch on Gap, `sendMessage` with ack timeout. On every (re)connect, refetch and **replace** all Snapshots. Started from `main.tsx`, outside React.

### Layout and navigation
- Selected Chat in the URL (`?chat=<id>`), no router. Unknown id → empty state with "Chat not found".
- Sidebar in protocol order (never reorders). Each item: title, Chat Status label (Idle / Responding + spinner / Finished), relative `updatedAt`, unread dot (assistant Message completed while not viewed; in-memory only).
- shadcn `sidebar` with its built-in mobile sheet below `md`. Light theme only (dark mode is a stretch goal).

### Rendering
- **Markdown:** `react-markdown` + `remark-gfm`, no `rehype-raw`; default `urlTransform`. Accept one-word flicker on unterminated syntax (Streamdown is the noted alternative).
- **User Messages:** plain text, `whitespace-pre-wrap`.
- **Tool Call:** title, status icon (spinner / ✓ / ✗ destructive), `summary` when present.
- **Table:** headers and order from `columns`; missing cell → `—`; extra fields ignored; horizontal scroll inside the block; text only.
- **Unknown Block:** neutral card "Unsupported content · `<type>`" with a collapsed `<details>` showing raw JSON as text. Known types are shape-validated; malformed → Unknown Block. Per-block error boundary.
- **Responding indicators:** typing indicator while responding with no blocks yet; pulsing caret on a streaming Message; Finished Chats replace the input with a "This chat is finished" footer.
- **Scrolling:** existing `message-scroller` (stick-to-bottom, jump-to-latest). Switching Chats lands at the bottom.

### Input
- Auto-growing `textarea`; `Enter` sends, `Shift+Enter` newline; trim; empty never sends; `maxLength=2000`.
- Inline ghost text: when the draft is a prefix of the Suggestion, show the remainder greyed out, with a "Tab to accept" `kbd` hint. `Tab` accepts the full Suggestion; with no Suggestion, `Tab` keeps native focus behaviour.
- Typing allowed while responding; Send disabled with "Wait for the assistant to finish".
- Draft kept per Chat in memory; ghost text recomputes when the Suggestion changes.
- No optimistic bubble: input disabled while awaiting the ack; the user Message appears via `message:created`. `UNEXPECTED_MESSAGE` → keep text, inline "Sorry, that's not the message I expected.", cleared on edit. Other codes, timeout, and disconnect → generic inline error.

### Resilience
- "Reconnecting to server…" banner and send disabled while disconnected; first-connect failure → full error state with Retry.
- Selected Chat without a Snapshot yet → skeleton. One Chat's `chat:get` failing → inline error with Retry in that Chat only. App-level error boundary.

### Accessibility
- Message list `role="log"` without per-word announcements; a separate polite live region announces "Assistant is responding", "Assistant finished responding", and Rejected Message errors.
- Sidebar items are buttons with `aria-current`; status exposed as text, not only an icon.

### Testing
- **Vitest:** reducer and sequence gate (in-order, duplicate, Gap, events before Snapshot), block validation, input Suggestion/Tab behaviour.
- **Playwright e2e** (`chromium` project, all of it in CI; `@smoke` marks the full-Turn spec): real backend as a second `webServer` with `DELAY_SCALE=0.05` on port 4100, frontend on 5174 with `VITE_BACKEND_URL`. Open a Chat → Tab → send → wait for finish → reload → state restored.
- **Playwright visual** (`@visual`, local only): fake Socket.IO server with fixture Snapshots, frontend on 5175. See ADR-0002. Screenshots: empty state; all block types (incl. escaped `<img onerror>`, running/succeeded/failed Tool Call, table, `chart` and `approval_request`); responding (typing indicator, half-streamed Message); ghost-text Suggestion; Rejected Message error; finished footer; disconnected banner; sidebar with all three statuses; one mobile viewport.

### Deliverables
- README: architecture, library choices and alternatives (Zustand vs custom store, `react-markdown` vs Streamdown, `useChat` from Vercel AI SDK / TanStack AI rejected), AI usage, what was left out (dark mode, visual tests in CI via Docker, persisted drafts/unread).

## Slices

1. **Sync core** — `socket.io-client` dependency, protocol types, pure reducer + sequence gate with Vitest coverage, Zustand store, `chatSync` with injected socket.
2. **Layout** — sidebar with statuses and unread, URL selection, empty state, not-found, skeleton.
3. **Blocks** — markdown, Tool Call, table, Unknown Block with validation and per-block error boundary; user Message rendering.
4. **Input** — textarea, ghost-text Suggestion, Tab, send/ack flow, Rejected Message and other errors, per-Chat drafts.
5. **Status and scroll** — typing indicator, streaming caret, finished footer, `message-scroller`, live region. `message-scroller` replaces the interim scroll container in `MessageList.tsx` and takes over its `role="log"` with `aria-live="off"`.
6. **Resilience** — reconnect banner, first-connect error, per-Chat Snapshot error with Retry, app error boundary.
7. **Smoke e2e** — smoke spec for a full Turn (backend `webServer` and ports landed with slice 2, alongside its layout e2e tests). Play the Turn in a Chat other than `incident-triage`: `e2e/blocks.e2e.ts` advances that one on the shared backend.
8. **Visual tests** — fake Socket.IO server, fixtures, `@visual` project and baselines.
9. **Docs** — README sections; review ADRs and glossary.
