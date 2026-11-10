import type { Block } from "./protocol.ts";

export type MarkdownBlock = { kind: "markdown"; id: string; text: string };

export type ToolCallStatus = "running" | "succeeded" | "failed";

export type ToolCallBlock = {
  kind: "tool_call";
  id: string;
  title: string;
  status: ToolCallStatus;
  summary: string | null;
};

export type TableColumn = { key: string; label: string };

export type TableBlock = {
  kind: "table";
  id: string;
  columns: TableColumn[];
  /** One entry per column, in column order; null where the row has no text for it. */
  rows: (string | null)[][];
};

/** A Block of a type we do not recognise, or whose shape does not match its type. */
export type UnknownBlock = {
  kind: "unknown";
  id: string;
  type: string;
  raw: Block;
};

export type ParsedBlock =
  MarkdownBlock | ToolCallBlock | TableBlock | UnknownBlock;

const TOOL_CALL_STATUSES: readonly unknown[] = [
  "running",
  "succeeded",
  "failed",
] satisfies ToolCallStatus[];

const isToolCallStatus = (value: unknown): value is ToolCallStatus =>
  TOOL_CALL_STATUSES.includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isColumn = (value: unknown): value is TableColumn =>
  isRecord(value) &&
  typeof value.key === "string" &&
  typeof value.label === "string";

const cellText = (row: Record<string, unknown>, key: string): string | null => {
  // Row fields are untrusted, so inherited keys like "constructor" must not match.
  const cell = Object.hasOwn(row, key) ? row[key] : undefined;
  return typeof cell === "string" ? cell : null;
};

/** Validates an untrusted Block against the shape its `type` declares. */
export const parseBlock = (block: Block): ParsedBlock => {
  const { id, type } = block;
  switch (type) {
    case "markdown":
      if (typeof block.text === "string") {
        return { kind: "markdown", id, text: block.text };
      }
      break;
    case "tool_call": {
      const { title, status, summary = null } = block;
      if (
        typeof title === "string" &&
        isToolCallStatus(status) &&
        (summary === null || typeof summary === "string")
      ) {
        return { kind: "tool_call", id, title, status, summary };
      }
      break;
    }
    case "table": {
      const { columns, rows } = block;
      if (
        Array.isArray(columns) &&
        columns.every(isColumn) &&
        Array.isArray(rows) &&
        rows.every(isRecord)
      ) {
        return {
          kind: "table",
          id,
          columns: columns.map(({ key, label }) => ({ key, label })),
          rows: rows.map((row) => columns.map(({ key }) => cellText(row, key))),
        };
      }
      break;
    }
  }
  return { kind: "unknown", id, type, raw: block };
};
