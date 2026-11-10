# Chat Protocol

The backend is a Socket.IO server at `http://localhost:4000`. There is no authentication and a single implicit user.

All state lives in backend memory. It survives browser refreshes and resets when the backend restarts.

## Conversations

The backend serves three scripted conversations, listed in this order:

| ID | Title | Use case |
| --- | --- | --- |
| `vpn-access` | VPN access issue | Diagnose and fix a user's VPN sign-in |
| `new-hire-setup` | New hire setup | Provision a laptop and app access for a new employee |
| `incident-triage` | Incident triage | Investigate a priority incident and related tickets |

Each conversation starts with two AI messages. The user then sends the scripted messages one at a time, and the AI responds to each. A conversation is finished when its script ends.

AI responses take several seconds to stream, which leaves time to switch conversations while one is responding.

## Types

```ts
type ChatStatus = 'idle' | 'responding' | 'finished';

type ChatSummary = {
  id: string;
  title: string;
  status: ChatStatus;
  updatedAt: string; // ISO 8601
};

type Chat = ChatSummary & {
  messages: Message[];
  suggestion: string | null;
  seq: number;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  status: 'streaming' | 'completed';
  blocks: Block[];
  createdAt: string; // ISO 8601
};

type Block = MarkdownBlock | ToolCallBlock | TableBlock;

type MarkdownBlock = {
  id: string;
  type: 'markdown';
  text: string;
};

type ToolCallBlock = {
  id: string;
  type: 'tool_call';
  title: string;
  status: 'running' | 'succeeded' | 'failed';
  summary: string | null;
};

type TableBlock = {
  id: string;
  type: 'table';
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
};
```

Message and block IDs are unique across all chats.

User messages always contain a single `markdown` block with the text the user sent.

Any block may arrive with a `type` not listed above. Such blocks always have `id` and `type`, and any other fields are unspecified.

`markdown` text is untrusted. Do not render raw HTML from it.

## Client requests

Requests are emitted with a Socket.IO acknowledgement callback, for example `socket.emitWithAck('chat:get', { chatId })`. Every acknowledgement has the shape `{ ok: true, ... } | { ok: false, error: ProtocolError }`.

```ts
type ProtocolError = {
  code:
    | 'INVALID_REQUEST'
    | 'UNKNOWN_CHAT'
    | 'UNEXPECTED_MESSAGE'
    | 'CHAT_RESPONDING'
    | 'CHAT_FINISHED';
  message: string;
};
```

### `chats:list`

Payload: none.

Acknowledgement: `{ ok: true, chats: ChatSummary[] }`.

### `chat:get`

Payload: `{ chatId: string }`.

Acknowledgement: `{ ok: true, chat: Chat }`.

### `message:send`

Payload: `{ chatId: string; text: string }`.

Acknowledgement: `{ ok: true, messageId: string }` when the message is accepted. `messageId` is the ID of the user message, which then arrives as an event together with the AI response.

The text must match the chat's current `suggestion` exactly, after trimming surrounding whitespace. Otherwise the request fails:

| Code | When |
| --- | --- |
| `INVALID_REQUEST` | The payload is malformed, or `text` is longer than 2,000 characters. |
| `UNKNOWN_CHAT` | No chat has this ID. |
| `UNEXPECTED_MESSAGE` | The text does not match the script. |
| `CHAT_RESPONDING` | The AI is still responding in this chat. |
| `CHAT_FINISHED` | The script has ended. |

A rejected message does not change the chat.

## Server events

The server emits events for **every** chat to every connected client, whether or not the client is displaying that chat.

Every event payload includes `chatId` and `seq`.

### `chat:status`

`{ chatId, seq, status: ChatStatus, updatedAt: string }`

### `chat:suggestion`

`{ chatId, seq, suggestion: string | null }`

`suggestion` is `null` while the AI is responding and after the chat is finished.

### `message:created`

`{ chatId, seq, message: Message }`

Sent for the accepted user message (with `status: 'completed'`) and for each new AI message (with `status: 'streaming'` and no blocks).

### `block:created`

`{ chatId, seq, messageId, block: Block }`

Appends a block to the message. A streaming `markdown` block starts with empty `text`.

### `block:delta`

`{ chatId, seq, messageId, blockId, text: string }`

Appends `text` to an existing `markdown` block.

### `block:updated`

`{ chatId, seq, messageId, block: Block }`

Replaces an existing block with the same `id`. Used, for example, when a `tool_call` moves from `running` to `succeeded`.

### `message:completed`

`{ chatId, seq, messageId }`

The message will receive no more events.

## Ordering guarantees

- `seq` is per chat. It starts at the `seq` in the chat's initial state and increases by exactly one with every event for that chat.
- Events for a chat are emitted in `seq` order.
- A `Chat` returned by `chat:get` includes every event up to and including its `seq`. Events with a `seq` less than or equal to that value are already reflected in the snapshot.
- Events for different chats may interleave.
- The acknowledgement of an accepted `message:send` arrives before any event of the turn it starts.

## Example turn

```text
→ message:send       { chatId: "vpn-access", text: "Yes, please reset it." }
← ack                { ok: true, messageId: "vpn-access-m3" }
← chat:suggestion    { chatId: "vpn-access", seq: 1, suggestion: null }
← chat:status        { chatId: "vpn-access", seq: 2, status: "responding", ... }
← message:created    { chatId: "vpn-access", seq: 3, message: { id: "vpn-access-m3", role: "user", ... } }
← message:created    { chatId: "vpn-access", seq: 4, message: { id: "vpn-access-m4", role: "assistant", status: "streaming", blocks: [] } }
← block:created      { chatId: "vpn-access", seq: 5, messageId: "vpn-access-m4", block: { id: "vpn-access-m4-b1", type: "tool_call", status: "running", ... } }
← block:updated      { chatId: "vpn-access", seq: 6, messageId: "vpn-access-m4", block: { id: "vpn-access-m4-b1", type: "tool_call", status: "succeeded", ... } }
← block:created      { chatId: "vpn-access", seq: 7, messageId: "vpn-access-m4", block: { id: "vpn-access-m4-b2", type: "markdown", text: "" } }
← block:delta        { chatId: "vpn-access", seq: 8, messageId: "vpn-access-m4", blockId: "vpn-access-m4-b2", text: "Done. " }
  … more block:delta events …
← message:completed  { chatId: "vpn-access", seq: 49, messageId: "vpn-access-m4" }
← chat:status        { chatId: "vpn-access", seq: 50, status: "idle", ... }
← chat:suggestion    { chatId: "vpn-access", seq: 51, suggestion: "I signed in, but the VPN disconnects every few minutes." }
```
