# Scripted AI Chat

A client for a backend that plays fixed, deterministic chat scripts between a single user and an AI assistant, streaming the assistant's responses as rich content.

## Language

### Chats

**Chat**:
One scripted exchange between the user and the assistant, identified by a stable ID and title.
_Avoid_: Conversation, thread, session

**Chat Status**:
Where a Chat stands in its script: idle (waiting for the user), responding (the assistant is producing a response), or finished (the script has ended).
_Avoid_: State, phase

**Turn**:
One user Message that the script accepted, together with the assistant Message it triggers.
_Avoid_: Round, exchange

**Suggestion**:
The exact next user Message the script will accept; absent while the assistant is responding and once the Chat is finished.
_Avoid_: Hint, prompt, expected message

**Rejected Message**:
A user Message the backend refused, most often because it did not match the Suggestion; it leaves the Chat unchanged.
_Avoid_: Invalid message, failed message

### Content

**Message**:
One contribution to a Chat by either the user or the assistant, made of an ordered list of Blocks.

**Block**:
One unit of rendered content inside a Message, identified by an ID and a type.
_Avoid_: Part, chunk, segment

**Tool Call**:
A Block reporting an action the assistant performs, which moves from running to succeeded or failed.
_Avoid_: Action, step, task

**Unknown Block**:
A Block whose type the client does not recognise, or whose shape does not match its declared type; shown as unsupported content rather than breaking the Chat.
_Avoid_: Invalid block, custom block

### Synchronisation

**Snapshot**:
The full state of one Chat as the backend reports it on request, valid up to and including its Sequence Number.
_Avoid_: Initial state, history

**Sequence Number**:
A per-Chat counter that increases by exactly one with every event, used to tell whether an event is already reflected, next, or missing.
_Avoid_: Version, revision, offset

**Gap**:
An event whose Sequence Number skips past the next expected one, meaning the client has missed events for that Chat and must take a fresh Snapshot.
_Avoid_: Out-of-order event

## Relationships

- A **Chat** has many **Messages**; each **Message** has many **Blocks**.
- A **Turn** starts when the user sends the **Suggestion** and ends when the assistant **Message** completes.
- A **Snapshot** plus every event with a higher **Sequence Number** fully describes a **Chat**.

## Example dialogue

> **Dev:** "If the user switches **Chats** mid-**Turn**, do we stop listening to the first one?"
> **Domain expert:** "No — events for every **Chat** keep flowing. When we come back, its state is already current, unless we hit a **Gap**, in which case we take a new **Snapshot**."
