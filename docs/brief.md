# AI Chat Frontend Development

Take-home assignment: Build a React and TypeScript frontend for a scripted AI chat using an existing Socket.IO backend. Share a private repository with the interviewer and Shlomi by 02:00.

## Assignment overview

- The existing backend streams three scripted chats over Socket.IO. There is no database or real LLM.
- A Markdown protocol file describes the communication. A blank frontend project using Vite and TypeScript is provided.
- Do not modify the backend; any fixes must be made in the frontend.

## Functional requirements

- Show a chat list on the left and the selected chat on the right. Show an empty state when no chat is selected.
- Each conversation starts with two messages already rendered; the remaining messages arrive as a stream.
- The user's message comes as a suggestion: display it in the input, and let Tab complete it. Sending any other message returns an error.
- Support three block types: Markdown, tool calls, and tables.

## Evaluation criteria

- The app works correctly: messages render in order, edge cases are handled, and there are no bugs or dead ends.
- Clear UX matters more than visual polish.
- Be ready to discuss architectural decisions, AI use, library choices, and alternatives.
- The code will be reviewed, so it should be clear and readable.
