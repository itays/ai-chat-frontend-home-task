import vpnAccess from '../scripts/01-vpn-access.json' with { type: 'json' };
import newHireSetup from '../scripts/02-new-hire-setup.json' with { type: 'json' };
import incidentTriage from '../scripts/03-incident-triage.json' with { type: 'json' };
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

// In filename order, which is the order the Chats are listed in.
export const SCRIPTS = [vpnAccess, newHireSetup, incidentTriage] as ChatScript[];
