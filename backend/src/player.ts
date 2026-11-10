import { blockId, splitIntoWords, toFinalBlock, toInitialBlock } from './blocks.ts';
import type { ChatStore } from './chatStore.ts';
import type { BlockStep, ScriptStep } from './script.ts';

const THINKING_MS = 700;
const WORD_MS = 40;
const BLOCK_MS = 400;

export type Delay = (ms: number) => Promise<void>;

export const createDelay =
  (scale: number): Delay =>
  (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms * scale));

type PlayContext = {
  store: ChatStore;
  chatId: string;
  messageId: string;
  delay: Delay;
};

const playBlockStep = async (
  { store, chatId, messageId, delay }: PlayContext,
  id: string,
  step: BlockStep,
): Promise<void> => {
  switch (step.op) {
    case 'markdown':
      store.addBlock(chatId, messageId, toInitialBlock(id, step));
      for (const word of splitIntoWords(step.text)) {
        await delay(WORD_MS);
        store.appendText(chatId, messageId, id, word);
      }
      return;
    case 'tool_call':
      store.addBlock(chatId, messageId, toInitialBlock(id, step));
      await delay(step.durationMs);
      store.replaceBlock(chatId, messageId, toFinalBlock(id, step));
      return;
    default:
      await delay(BLOCK_MS);
      store.addBlock(chatId, messageId, toFinalBlock(id, step));
  }
};

export const playAssistantMessage = async (
  store: ChatStore,
  chatId: string,
  steps: ScriptStep[],
  delay: Delay,
): Promise<void> => {
  await delay(THINKING_MS);

  const messageId = store.nextMessageId(chatId);
  store.addMessage(chatId, {
    id: messageId,
    role: 'assistant',
    status: 'streaming',
    blocks: [],
    createdAt: new Date().toISOString(),
  });

  const context = { store, chatId, messageId, delay };
  let blockCount = 0;
  for (const step of steps) {
    if (step.op === 'pause') {
      await delay(step.durationMs);
      continue;
    }
    blockCount += 1;
    await playBlockStep(context, blockId(messageId, blockCount), step);
  }

  store.completeMessage(chatId, messageId);
};
