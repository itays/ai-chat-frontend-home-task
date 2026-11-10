import type { Block } from './protocol.ts';
import type { BlockStep } from './script.ts';

export const messageId = (chatId: string, index: number): string =>
  `${chatId}-m${index}`;

export const blockId = (ownerMessageId: string, index: number): string =>
  `${ownerMessageId}-b${index}`;

export const toFinalBlock = (id: string, step: BlockStep): Block => {
  switch (step.op) {
    case 'markdown':
      return { id, type: 'markdown', text: step.text };
    case 'tool_call':
      return {
        id,
        type: 'tool_call',
        title: step.title,
        status: step.result,
        summary: step.summary,
      };
    case 'table':
      return {
        id,
        type: 'table',
        columns: structuredClone(step.columns),
        rows: structuredClone(step.rows),
      };
    case 'raw_block':
      return { ...structuredClone(step.block), id };
  }
};

export const toInitialBlock = (id: string, step: BlockStep): Block => {
  switch (step.op) {
    case 'markdown':
      return { id, type: 'markdown', text: '' };
    case 'tool_call':
      return {
        id,
        type: 'tool_call',
        title: step.title,
        status: 'running',
        summary: null,
      };
    default:
      return toFinalBlock(id, step);
  }
};

export const splitIntoWords = (text: string): string[] =>
  text.split(/(?<=\s)(?=\S)/);
