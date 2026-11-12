import { readdirSync, readFileSync } from 'node:fs';
import type { TableColumn } from './protocol.ts';

export type BlockStep =
  | { op: 'markdown'; text: string }
  | {
      op: 'tool_call';
      title: string;
      durationMs: number;
      result: 'succeeded' | 'failed';
      summary: string;
    }
  | { op: 'table'; columns: TableColumn[]; rows: Record<string, string>[] }
  | { op: 'raw_block'; block: { type: string; [field: string]: unknown } };

export type ScriptStep = BlockStep | { op: 'pause'; durationMs: number };

export type ScriptTurn = {
  expect: string;
  steps: ScriptStep[];
};

export type ChatScript = {
  id: string;
  title: string;
  history: { steps: BlockStep[] }[];
  turns: ScriptTurn[];
};

const SCRIPTS_DIR = new URL('../scripts/', import.meta.url);

export const loadScripts = (): ChatScript[] =>
  readdirSync(SCRIPTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map(
      (file) =>
        JSON.parse(
          readFileSync(new URL(file, SCRIPTS_DIR), 'utf8'),
        ) as ChatScript,
    );
