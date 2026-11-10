import { describe, expect, it } from "vitest";
import { parseBlock } from "./blocks.ts";

describe("parseBlock", () => {
  it("recognises a markdown block", () => {
    expect(parseBlock({ id: "b1", type: "markdown", text: "**hi**" })).toEqual({
      kind: "markdown",
      id: "b1",
      text: "**hi**",
    });
  });

  it("treats a type it does not recognise as an Unknown Block, keeping the raw block", () => {
    const chart = { id: "b1", type: "chart", points: [{ value: 1 }] };

    expect(parseBlock(chart)).toEqual({
      kind: "unknown",
      id: "b1",
      type: "chart",
      raw: chart,
    });
  });

  it.each([
    { id: "b1", type: "markdown" },
    { id: "b1", type: "markdown", text: 42 },
  ])("treats a markdown Block without string text as Unknown (%o)", (block) => {
    expect(parseBlock(block)).toMatchObject({
      kind: "unknown",
      type: "markdown",
    });
  });

  it("recognises a Tool Call, with or without a summary", () => {
    const toolCall = { id: "b1", type: "tool_call", title: "Check sign-ins" };

    expect(
      parseBlock({
        ...toolCall,
        status: "succeeded",
        summary: "3 failed attempts",
      })
    ).toEqual({
      kind: "tool_call",
      id: "b1",
      title: "Check sign-ins",
      status: "succeeded",
      summary: "3 failed attempts",
    });
    expect(
      parseBlock({ ...toolCall, status: "running", summary: null })
    ).toEqual({
      kind: "tool_call",
      id: "b1",
      title: "Check sign-ins",
      status: "running",
      summary: null,
    });
    expect(parseBlock({ ...toolCall, status: "failed" })).toMatchObject({
      kind: "tool_call",
      status: "failed",
      summary: null,
    });
  });

  it.each([
    { title: "Check", status: "pending", summary: null },
    { title: 7, status: "running", summary: null },
    { status: "running", summary: null },
    { title: "Check", status: "running", summary: { text: "x" } },
  ])("treats a malformed Tool Call as Unknown (%o)", (fields) => {
    expect(
      parseBlock({ id: "b1", type: "tool_call", ...fields })
    ).toMatchObject({
      kind: "unknown",
      type: "tool_call",
    });
  });

  it("recognises a table, ordering cells by its columns and ignoring extra fields", () => {
    expect(
      parseBlock({
        id: "b1",
        type: "table",
        columns: [
          { key: "id", label: "Ticket" },
          { key: "state", label: "State" },
        ],
        rows: [
          { state: "New", id: "INC1", extra: "ignored" },
          { id: "INC2" },
          { id: "INC3", state: 4 },
        ],
      })
    ).toEqual({
      kind: "table",
      id: "b1",
      columns: [
        { key: "id", label: "Ticket" },
        { key: "state", label: "State" },
      ],
      rows: [
        ["INC1", "New"],
        ["INC2", null],
        ["INC3", null],
      ],
    });
  });

  it.each([
    { columns: "id", rows: [] },
    { columns: [{ key: "id" }], rows: [] },
    { columns: [{ key: "id", label: "Id" }], rows: {} },
    { columns: [{ key: "id", label: "Id" }], rows: [null] },
    { columns: [{ key: "id", label: "Id" }], rows: [["INC1"]] },
  ])("treats a malformed table as Unknown (%o)", (fields) => {
    expect(parseBlock({ id: "b1", type: "table", ...fields })).toMatchObject({
      kind: "unknown",
      type: "table",
    });
  });
});
