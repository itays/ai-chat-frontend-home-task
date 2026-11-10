import type { Block, Chat, Message } from "../../src/chat/protocol.ts";

// The fake server Playwright starts for visual tests (see ADR-0002).
export const FAKE_SERVER_PORT = 4200;
export const FAKE_SERVER_URL = `http://127.0.0.1:${FAKE_SERVER_PORT}`;

/** The browser clock is pinned here, so relative times never change. */
export const NOW = new Date("2026-03-02T10:00:00.000Z");

const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000).toISOString();

const markdown = (id: string, text: string): Block => ({
  id,
  type: "markdown",
  text,
});

const message = (
  id: string,
  role: Message["role"],
  blocks: Block[],
  status: Message["status"] = "completed"
): Message => ({ id, role, status, blocks, createdAt: minutesAgo(10) });

const greeting = (chatId: string) =>
  message(`${chatId}-m1`, "assistant", [
    markdown(`${chatId}-m1-b1`, "Hi! What can I help you with today?"),
  ]);

const BLOCK_GALLERY_MARKDOWN = `## Everything checks out

The device is **enrolled** and the account is *active*. Next steps:

1. Sign out of the VPN client
2. Sign back in with \`alice@example.com\`
   - Approve the push notification

\`\`\`ts
const status = await vpn.connect({ profile: "corp" });
\`\`\`

> Raw HTML stays text: <img src="x" onerror="alert(1)">

See the [VPN guide](https://example.com/vpn) for details.`;

export const CHAT_IDS = {
  blocks: "blocks",
  typing: "typing",
  streaming: "streaming",
  finished: "finished",
} as const;

/** Frozen Snapshots, in the order `chats:list` returns them. */
export const FIXTURE_CHATS: Chat[] = [
  {
    id: CHAT_IDS.blocks,
    title: "Every block type",
    status: "idle",
    updatedAt: minutesAgo(5),
    seq: 12,
    suggestion: "Thanks, that's all I needed.",
    messages: [
      greeting(CHAT_IDS.blocks),
      message("blocks-m2", "user", [
        markdown("blocks-m2-b1", "Show me everything\nyou can render."),
      ]),
      message("blocks-m3", "assistant", [
        markdown("blocks-m3-b1", BLOCK_GALLERY_MARKDOWN),
        {
          id: "blocks-m3-b2",
          type: "tool_call",
          title: "Checking device enrolment",
          status: "running",
          summary: null,
        },
        {
          id: "blocks-m3-b3",
          type: "tool_call",
          title: "Reset password",
          status: "succeeded",
          summary: "Temporary password sent to the user's phone.",
        },
        {
          id: "blocks-m3-b4",
          type: "tool_call",
          title: "Restart VPN gateway",
          status: "failed",
          summary: "Permission denied: requires the network-admin role.",
        },
        {
          id: "blocks-m3-b5",
          type: "table",
          columns: [
            { key: "device", label: "Device" },
            { key: "owner", label: "Owner" },
            { key: "status", label: "Status" },
          ],
          rows: [
            { device: "MBP-0142", owner: "Alice Chen", status: "Compliant" },
            // Missing cell → "—"; extra fields are ignored.
            { device: "MBP-0177", owner: "Bob Ortiz", serial: "C02X1" },
          ],
        },
        {
          id: "blocks-m3-b6",
          type: "chart",
          kind: "bar",
          series: [{ label: "Sign-ins", values: [12, 30, 7] }],
        },
        {
          id: "blocks-m3-b7",
          type: "approval_request",
          title: "Grant admin access",
          approver: "it-security",
        },
        // A known type with the wrong shape is an Unknown Block too.
        {
          id: "blocks-m3-b8",
          type: "tool_call",
          title: "Queued check",
          status: "queued",
        },
      ]),
    ],
  },
  {
    id: CHAT_IDS.typing,
    title: "Printer queue stuck",
    status: "responding",
    updatedAt: minutesAgo(0),
    seq: 4,
    suggestion: null,
    messages: [
      greeting(CHAT_IDS.typing),
      message("typing-m2", "user", [
        markdown("typing-m2-b1", "The print queue on floor 3 is stuck."),
      ]),
    ],
  },
  {
    id: CHAT_IDS.streaming,
    title: "Laptop battery drain",
    status: "responding",
    updatedAt: minutesAgo(2),
    seq: 9,
    suggestion: null,
    messages: [
      greeting(CHAT_IDS.streaming),
      message("streaming-m2", "user", [
        markdown("streaming-m2-b1", "My battery dies before lunch."),
      ]),
      message(
        "streaming-m3",
        "assistant",
        [
          {
            id: "streaming-m3-b1",
            type: "tool_call",
            title: "Reading the battery report",
            status: "succeeded",
            summary: "Collected 7 days of usage.",
          },
          markdown(
            "streaming-m3-b2",
            "Your battery report shows that **Chrome** is using"
          ),
        ],
        "streaming"
      ),
    ],
  },
  {
    id: CHAT_IDS.finished,
    title: "Password reset",
    status: "finished",
    updatedAt: minutesAgo(3 * 24 * 60),
    seq: 20,
    suggestion: null,
    messages: [
      greeting(CHAT_IDS.finished),
      message("finished-m2", "user", [
        markdown("finished-m2-b1", "I forgot my password."),
      ]),
      message("finished-m3", "assistant", [
        markdown(
          "finished-m3-b1",
          "Done. Your temporary password expires in 15 minutes."
        ),
      ]),
    ],
  },
];
