import { messageId } from './blocks.ts';
import type {
  Block,
  Chat,
  ChatStatus,
  ChatSummary,
  Message,
  ServerEvent,
  ServerEventName,
  ServerEventPayloads,
} from './protocol.ts';

export type Broadcast = <N extends ServerEventName>(
  name: N,
  event: ServerEvent<N>,
) => void;

type Entry = {
  chat: Chat;
  messageCount: number;
};

export class ChatStore {
  #entries = new Map<string, Entry>();
  #broadcast: Broadcast;

  constructor(broadcast: Broadcast) {
    this.#broadcast = broadcast;
  }

  add(chat: Chat): void {
    this.#entries.set(chat.id, { chat, messageCount: chat.messages.length });
  }

  list(): ChatSummary[] {
    return [...this.#entries.values()].map(
      ({ chat: { id, title, status, updatedAt } }) => ({
        id,
        title,
        status,
        updatedAt,
      }),
    );
  }

  get(chatId: string): Chat | undefined {
    const entry = this.#entries.get(chatId);
    return entry && structuredClone(entry.chat);
  }

  nextMessageId(chatId: string): string {
    const entry = this.#entry(chatId);
    entry.messageCount += 1;
    return messageId(chatId, entry.messageCount);
  }

  setStatus(chatId: string, status: ChatStatus): void {
    const { chat } = this.#entry(chatId);
    chat.status = status;
    chat.updatedAt = new Date().toISOString();
    this.#emit(chat, 'chat:status', { status, updatedAt: chat.updatedAt });
  }

  setSuggestion(chatId: string, suggestion: string | null): void {
    const { chat } = this.#entry(chatId);
    chat.suggestion = suggestion;
    this.#emit(chat, 'chat:suggestion', { suggestion });
  }

  addMessage(chatId: string, message: Message): void {
    const { chat } = this.#entry(chatId);
    chat.messages.push(message);
    this.#emit(chat, 'message:created', { message });
  }

  addBlock(chatId: string, messageId: string, block: Block): void {
    const { chat } = this.#entry(chatId);
    this.#message(chat, messageId).blocks.push(block);
    this.#emit(chat, 'block:created', { messageId, block });
  }

  appendText(
    chatId: string,
    messageId: string,
    blockId: string,
    text: string,
  ): void {
    const { chat } = this.#entry(chatId);
    const block = this.#block(chat, messageId, blockId);
    if (block.type !== 'markdown' || typeof block.text !== 'string') {
      throw new Error(`Block ${blockId} is not a markdown block`);
    }
    block.text += text;
    this.#emit(chat, 'block:delta', { messageId, blockId, text });
  }

  replaceBlock(chatId: string, messageId: string, block: Block): void {
    const { chat } = this.#entry(chatId);
    const { blocks } = this.#message(chat, messageId);
    const index = blocks.findIndex(({ id }) => id === block.id);
    if (index === -1) {
      throw new Error(`Unknown block ${block.id} in message ${messageId}`);
    }
    blocks[index] = block;
    this.#emit(chat, 'block:updated', { messageId, block });
  }

  completeMessage(chatId: string, messageId: string): void {
    const { chat } = this.#entry(chatId);
    this.#message(chat, messageId).status = 'completed';
    this.#emit(chat, 'message:completed', { messageId });
  }

  #entry(chatId: string): Entry {
    const entry = this.#entries.get(chatId);
    if (!entry) {
      throw new Error(`Unknown chat ${chatId}`);
    }
    return entry;
  }

  #message(chat: Chat, messageId: string): Message {
    const message = chat.messages.find(({ id }) => id === messageId);
    if (!message) {
      throw new Error(`Unknown message ${messageId} in chat ${chat.id}`);
    }
    return message;
  }

  #block(chat: Chat, messageId: string, blockId: string): Block {
    const block = this.#message(chat, messageId).blocks.find(
      ({ id }) => id === blockId,
    );
    if (!block) {
      throw new Error(`Unknown block ${blockId} in message ${messageId}`);
    }
    return block;
  }

  #emit<N extends ServerEventName>(
    chat: Chat,
    name: N,
    payload: ServerEventPayloads[N],
  ): void {
    chat.seq += 1;
    // Payloads reference live state that later events mutate.
    const event = structuredClone({ ...payload, chatId: chat.id, seq: chat.seq });
    this.#broadcast(name, event as ServerEvent<N>);
  }
}
