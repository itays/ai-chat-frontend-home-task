import type { Block, Chat, Message, ServerEvent } from "./protocol.ts";

export type ApplyResult =
  { kind: "applied"; chat: Chat } | { kind: "stale" } | { kind: "gap" };

/**
 * Applies one server event to a Chat, gated by Sequence Number:
 * already-reflected events are stale, the next one is applied, and a skipped
 * number is a Gap that the caller resolves with a fresh Snapshot.
 *
 * An event that refers to a message or block the Chat does not have also
 * means the client is out of sync, so it is reported as a Gap too.
 */
export const applyEvent = (chat: Chat, event: ServerEvent): ApplyResult => {
  if (event.seq <= chat.seq) {
    return { kind: "stale" };
  }
  if (event.seq > chat.seq + 1) {
    return { kind: "gap" };
  }
  const next = reduce(chat, event);
  return next
    ? { kind: "applied", chat: { ...next, seq: event.seq } }
    : { kind: "gap" };
};

/** Returns the updated chat, or null when the event does not fit its state. */
const reduce = (chat: Chat, event: ServerEvent): Chat | null => {
  switch (event.name) {
    case "chat:status":
      return { ...chat, status: event.status, updatedAt: event.updatedAt };
    case "chat:suggestion":
      return { ...chat, suggestion: event.suggestion };
    case "message:created":
      return { ...chat, messages: [...chat.messages, event.message] };
    case "message:completed":
      return updateMessage(chat, event.messageId, (message) => ({
        ...message,
        status: "completed",
      }));
    case "block:created":
      return updateMessage(chat, event.messageId, (message) => ({
        ...message,
        blocks: [...message.blocks, event.block],
      }));
    case "block:updated":
      return updateBlock(
        chat,
        event.messageId,
        event.block.id,
        () => event.block
      );
    case "block:delta":
      return updateBlock(chat, event.messageId, event.blockId, (block) =>
        block.type === "markdown" && typeof block.text === "string"
          ? { ...block, text: block.text + event.text }
          : null
      );
  }
};

const updateMessage = (
  chat: Chat,
  messageId: string,
  update: (message: Message) => Message | null
): Chat | null => {
  const index = chat.messages.findIndex(({ id }) => id === messageId);
  const message = chat.messages[index];
  const updated = message && update(message);
  return updated
    ? { ...chat, messages: chat.messages.with(index, updated) }
    : null;
};

const updateBlock = (
  chat: Chat,
  messageId: string,
  blockId: string,
  update: (block: Block) => Block | null
): Chat | null =>
  updateMessage(chat, messageId, (message) => {
    const index = message.blocks.findIndex(({ id }) => id === blockId);
    const block = message.blocks[index];
    const updated = block && update(block);
    return updated
      ? { ...message, blocks: message.blocks.with(index, updated) }
      : null;
  });
