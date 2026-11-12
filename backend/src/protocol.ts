export type ChatStatus = 'idle' | 'responding' | 'finished';

export type MarkdownBlock = {
  id: string;
  type: 'markdown';
  text: string;
};

export type ToolCallStatus = 'running' | 'succeeded' | 'failed';

export type ToolCallBlock = {
  id: string;
  type: 'tool_call';
  title: string;
  status: ToolCallStatus;
  summary: string | null;
};

export type TableColumn = {
  key: string;
  label: string;
};

export type TableBlock = {
  id: string;
  type: 'table';
  columns: TableColumn[];
  rows: Record<string, string>[];
};

export type UnlistedBlock = {
  id: string;
  type: string;
  [field: string]: unknown;
};

export type Block = MarkdownBlock | ToolCallBlock | TableBlock | UnlistedBlock;

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  status: 'streaming' | 'completed';
  blocks: Block[];
  createdAt: string;
};

export type ChatSummary = {
  id: string;
  title: string;
  status: ChatStatus;
  updatedAt: string;
};

export type Chat = ChatSummary & {
  messages: Message[];
  suggestion: string | null;
  seq: number;
};

export type ProtocolErrorCode =
  | 'INVALID_REQUEST'
  | 'UNKNOWN_CHAT'
  | 'UNEXPECTED_MESSAGE'
  | 'CHAT_RESPONDING'
  | 'CHAT_FINISHED';

export type ProtocolError = {
  code: ProtocolErrorCode;
  message: string;
};

export type Failure = { ok: false; error: ProtocolError };

export type Ack<T> = ({ ok: true } & T) | Failure;

export type ServerEventPayloads = {
  'chat:status': { status: ChatStatus; updatedAt: string };
  'chat:suggestion': { suggestion: string | null };
  'message:created': { message: Message };
  'block:created': { messageId: string; block: Block };
  'block:delta': { messageId: string; blockId: string; text: string };
  'block:updated': { messageId: string; block: Block };
  'message:completed': { messageId: string };
};

export type ServerEventName = keyof ServerEventPayloads;

export type ServerEvent<N extends ServerEventName> = {
  chatId: string;
  seq: number;
} & ServerEventPayloads[N];

export type RequestName = 'chats:list' | 'chat:get' | 'message:send';

export type RequestFrame = { id: number; name: RequestName; payload?: unknown };

export type ServerFrame =
  | { type: 'ack'; id: number; ack: Ack<object> }
  | {
      [N in ServerEventName]: { type: 'event'; name: N; event: ServerEvent<N> };
    }[ServerEventName];
