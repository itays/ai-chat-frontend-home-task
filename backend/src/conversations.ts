import { blockId, messageId, toFinalBlock } from './blocks.ts';
import type { ChatStore } from './chatStore.ts';
import { failure } from './errors.ts';
import { playAssistantMessage, type Delay } from './player.ts';
import type { Chat, Failure } from './protocol.ts';
import type { ChatScript, ScriptTurn } from './script.ts';

export type SendResult = { ok: true; messageId: string } | Failure;

type Progress = {
  script: ChatScript;
  turnIndex: number;
  responding: boolean;
};

const HISTORY_SPACING_MS = 60_000;

const buildInitialChat = (script: ChatScript, startedAt: number): Chat => {
  const { history, turns } = script;
  return {
    id: script.id,
    title: script.title,
    status: turns.length > 0 ? 'idle' : 'finished',
    updatedAt: new Date(startedAt).toISOString(),
    suggestion: turns[0]?.expect ?? null,
    seq: 0,
    messages: history.map(({ steps }, index) => {
      const id = messageId(script.id, index + 1);
      return {
        id,
        role: 'assistant',
        status: 'completed',
        blocks: steps.map((step, stepIndex) =>
          toFinalBlock(blockId(id, stepIndex + 1), step),
        ),
        createdAt: new Date(
          startedAt - (history.length - index) * HISTORY_SPACING_MS,
        ).toISOString(),
      };
    }),
  };
};

export class Conversations {
  #store: ChatStore;
  #delay: Delay;
  #progress = new Map<string, Progress>();

  constructor(scripts: ChatScript[], store: ChatStore, delay: Delay) {
    this.#store = store;
    this.#delay = delay;
    const startedAt = Date.now();
    for (const script of scripts) {
      store.add(buildInitialChat(script, startedAt));
      this.#progress.set(script.id, { script, turnIndex: 0, responding: false });
    }
  }

  send(chatId: string, text: string): SendResult {
    const progress = this.#progress.get(chatId);
    if (!progress) {
      return failure('UNKNOWN_CHAT');
    }
    if (progress.responding) {
      return failure('CHAT_RESPONDING');
    }
    const turn = progress.script.turns[progress.turnIndex];
    if (!turn) {
      return failure('CHAT_FINISHED');
    }
    const trimmed = text.trim();
    if (trimmed !== turn.expect) {
      return failure('UNEXPECTED_MESSAGE');
    }

    progress.responding = true;
    progress.turnIndex += 1;
    const userMessageId = this.#store.nextMessageId(chatId);
    // Deferred so the acknowledgement reaches the client before the turn's events.
    setTimeout(() => {
      void this.#runTurn(progress, turn, userMessageId, trimmed);
    }, 0);
    return { ok: true, messageId: userMessageId };
  }

  async #runTurn(
    progress: Progress,
    turn: ScriptTurn,
    userMessageId: string,
    text: string,
  ): Promise<void> {
    const store = this.#store;
    const { id: chatId, turns } = progress.script;

    store.setSuggestion(chatId, null);
    store.setStatus(chatId, 'responding');
    store.addMessage(chatId, {
      id: userMessageId,
      role: 'user',
      status: 'completed',
      blocks: [{ id: blockId(userMessageId, 1), type: 'markdown', text }],
      createdAt: new Date().toISOString(),
    });

    try {
      await playAssistantMessage(store, chatId, turn.steps, this.#delay);
    } finally {
      progress.responding = false;
      const nextTurn = turns[progress.turnIndex];
      store.setStatus(chatId, nextTurn ? 'idle' : 'finished');
      if (nextTurn) {
        store.setSuggestion(chatId, nextTurn.expect);
      }
    }
  }
}
