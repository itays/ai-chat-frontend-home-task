# Scripted AI Chat Client

Build a React client for a scripted, streaming AI chat backend.

**ai.work · ServiceNow — Frontend Engineer home assignment**

- **Time window:** 4 hours
- **Stack:** React, TypeScript, Socket.IO
- **AI tools:** Required
- **Deliverable:** Private GitHub repository

## 1. Objective

Your challenge is to build the frontend for a small AI chat product:
a sidebar with a list of conversations, and an active conversation
that streams AI responses made of rich blocks.

We provide a starter repository with a ready-to-run Node.js backend
and an empty frontend app. The backend has no database and no real
model; every conversation follows a fixed script, so it is fully
deterministic. All of your time goes into the frontend.

This exercise is short on purpose. We are not looking for a complete
product or a polished design. We want to see the architectural
decisions you make and how good you can get the code in a few hours.
Choose what to build carefully, and tell us openly what you left
out.

This exercise is time-boxed and must be completed using AI coding
tools throughout planning and implementation. You should still
understand the submitted solution and be ready to explain its code,
architecture, behavior, and trade-offs.

You have four hours. The interviewer will provide the start time and
deadline.

## 2. What we provide

The starter repository,
[`ai-work-hiring/ai-chat-home-task`](https://github.com/ai-work-hiring/ai-chat-home-task), is an npm workspace containing:

- `backend/` — a Socket.IO server with three scripted
  conversations, each demonstrating an IT use case.
- `backend/PROTOCOL.md` — the contract between the
  backend and your client: events, payloads, block types, and
  ordering guarantees.
- `frontend/` — a bare Vite, React, and TypeScript app.
  Build your solution here.
- A root `npm start` that runs the backend and the
  frontend together.

```
npm install
npm start # backend on http://localhost:4000, frontend on http://localhost:5173
npm test
```

The backend keeps all state in memory. Refreshing the browser keeps
conversation state; restarting the backend resets every conversation
to its initial state.

Do not modify `backend/`. If you believe the protocol has
a gap, work around it in the client.

## 3. Functional requirements

### 3.1 Layout

- A sidebar lists the three conversations, with their title and
  current status.
- The remaining area shows the selected conversation and its message
  input.
- When no conversation is selected, the chat area shows a useful empty
  state.

### 3.2 Conversation

- Each conversation opens with its history, which starts with two
  messages from the AI.
- AI messages and user messages are visually distinct: AI messages on
  one side, user messages on the other.
- AI responses are streamed. Render them progressively as events
  arrive, not only when they complete.
- The UI makes it clear when the AI is responding and when the
  conversation is finished.

### 3.3 Blocks

An AI message is a list of blocks. Render at least these block
types, as described in the protocol:

| Type | Description |
| --- | --- |
| `markdown` | Formatted text that streams in. |
| `tool_call` | A status card for an action the AI performs, which moves from running to a final state. |
| `table` | Tabular data. |

The backend may send block types that are not listed in the
protocol. Your client must handle them without breaking the
conversation.

Treat all content from the backend as untrusted.

### 3.4 Scripted input

The backend only accepts the next message in its script.

- Show the next expected message as a suggestion in the message
  input.
- Pressing `Tab` accepts the suggestion into the input. The
  user can also type the message themselves.
- If the backend rejects a message because it does not match the
  script, show a clear message such as “Sorry, that's not the
  message I expected.” and let the user try again.

### 3.5 Multiple active conversations

- The user can switch to another conversation while the AI is still
  responding in the current one.
- The conversation that is still responding keeps receiving its
  events. Returning to it shows the up-to-date response, and the
  sidebar indicates which conversations are responding.
- Refreshing the browser restores every conversation, including one
  that is still responding.

## 4. Technical constraints

- Use React and TypeScript. The frontend app comes with Vite; you may
  change its configuration.
- Choose your own state management, styling approach, testing tools,
  and supporting libraries, including chat UI and block-rendering
  libraries. Whatever you use, the way protocol events become
  conversation state is your own design.
- Use the Socket.IO client to talk to the backend.
- The root `npm start` must keep running the backend and
  your frontend together.

## 5. Submission

When your solution is ready:

1. Before you start, open the starter repository on GitHub, choose
   **Use this template**, and create a
   **private** repository named
   `ai-chat-frontend-home-task` in your account:
     
   `https://github.com/<your-username>/ai-chat-frontend-home-task`
2. Invite these GitHub users as collaborators on the private
   repository so they can clone it:
   - `tomer-fidel-ai`
   - `shlomisas`
3. Ensure the repository can be cloned and run.
4. Ensure the final commit is made within the home-task time window
   provided by the interviewer.
5. Send the repository URL to:
   - [tomer.fidel@servicenow.com](mailto:tomer.fidel@servicenow.com)
   - [shlomi.sasson@servicenow.com](mailto:shlomi.sasson@servicenow.com)

---

ai.work · ServiceNow Advanced Technology Group · Frontend Engineer home assignment
