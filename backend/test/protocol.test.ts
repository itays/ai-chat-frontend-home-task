import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import { blockId, messageId, toFinalBlock } from '../src/blocks.ts';
import type { Ack, Chat, ChatSummary, Message, ServerFrame } from '../src/protocol.ts';
import { SCRIPTS as scripts, type ChatScript } from '../src/script.ts';

type ReceivedEvent = { name: string; chatId: string; seq: number; [key: string]: unknown };

type Client = {
  request: <T extends object>(name: string, payload?: unknown) => Promise<Ack<T>>;
  onEvent: (listener: (event: ReceivedEvent) => void) => () => void;
};

const WRANGLER_CONFIG = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup();
  }
});

const connect = async (url: URL): Promise<Client> => {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  cleanups.push(() => socket.close());

  const pending = new Map<number, (ack: Ack<object>) => void>();
  const listeners = new Set<(event: ReceivedEvent) => void>();
  let lastId = 0;
  socket.addEventListener('message', ({ data }) => {
    const frame = JSON.parse(String(data)) as ServerFrame;
    if (frame.type === 'ack') {
      pending.get(frame.id)?.(frame.ack);
      pending.delete(frame.id);
    } else {
      listeners.forEach((listener) => listener({ ...frame.event, name: frame.name }));
    }
  });

  return {
    request: <T extends object>(name: string, payload?: unknown) =>
      new Promise<Ack<T>>((resolve) => {
        const id = ++lastId;
        pending.set(id, resolve as (ack: Ack<object>) => void);
        socket.send(JSON.stringify({ id, name, payload }));
      }),
    onEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

// A worker per test, so each test starts from the scripted Chats.
const startClient = async (): Promise<Client> => {
  const worker = await unstable_startWorker({
    config: WRANGLER_CONFIG,
    bindings: { DELAY_SCALE: { type: 'plain_text', value: '0' } },
    dev: {
      server: { hostname: '127.0.0.1', port: 0 },
      inspector: false,
      watch: false,
      persist: false,
    },
  });
  cleanups.push(() => worker.dispose());
  const url = new URL('/ws', await worker.url);
  url.protocol = 'ws:';
  return connect(url);
};

const getChat = async (client: Client, chatId: string): Promise<Chat> => {
  const response = await client.request<{ chat: Chat }>('chat:get', { chatId });
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.chat;
};

const send = (client: Client, chatId: string, text: string) =>
  client.request<{ messageId: string }>('message:send', { chatId, text });

const recordEvents = (client: Client, chatId: string): ReceivedEvent[] => {
  const events: ReceivedEvent[] = [];
  client.onEvent((event) => {
    if (event.chatId === chatId) {
      events.push(event);
    }
  });
  return events;
};

const waitForTurnEnd = (client: Client, chatId: string): Promise<void> =>
  new Promise((resolve) => {
    const stop = client.onEvent((event) => {
      if (event.name === 'chat:status' && event.chatId === chatId && event.status !== 'responding') {
        stop();
        resolve();
      }
    });
  });

const playTurn = async (client: Client, chatId: string, text: string) => {
  const turnEnd = waitForTurnEnd(client, chatId);
  const response = await send(client, chatId, text);
  await turnEnd;
  return response;
};

const expectedMessages = (script: ChatScript): Omit<Message, 'createdAt'>[] => {
  const assistantMessage = (index: number, steps: ChatScript['history'][number]['steps']) => {
    const id = messageId(script.id, index);
    return {
      id,
      role: 'assistant' as const,
      status: 'completed' as const,
      blocks: steps.map((step, stepIndex) => toFinalBlock(blockId(id, stepIndex + 1), step)),
    };
  };

  const messages: Omit<Message, 'createdAt'>[] = script.history.map(({ steps }, index) =>
    assistantMessage(index + 1, steps),
  );
  for (const { expect: text, steps } of script.turns) {
    const userId = messageId(script.id, messages.length + 1);
    messages.push({
      id: userId,
      role: 'user',
      status: 'completed',
      blocks: [{ id: blockId(userId, 1), type: 'markdown', text }],
    });
    messages.push(
      assistantMessage(
        messages.length + 1,
        steps.flatMap((step) => (step.op === 'pause' ? [] : [step])),
      ),
    );
  }
  return messages;
};

describe('chat backend', () => {
  it('lists every scripted chat in order', async () => {
    const client = await startClient();

    const response = await client.request<{ chats: ChatSummary[] }>('chats:list');

    expect(response).toEqual({
      ok: true,
      chats: scripts.map(({ id, title }) => ({
        id,
        title,
        status: 'idle',
        updatedAt: expect.any(String),
      })),
    });
  });

  it.each(scripts)('plays "$id" to the end', async (script) => {
    const client = await startClient();
    const events = recordEvents(client, script.id);
    const initial = await getChat(client, script.id);

    expect(initial.suggestion).toBe(script.turns[0]?.expect);
    expect(initial.messages).toHaveLength(script.history.length);

    for (const turn of script.turns) {
      expect(await playTurn(client, script.id, turn.expect)).toEqual({
        ok: true,
        messageId: expect.any(String),
      });
    }

    const final = await getChat(client, script.id);
    expect(final).toMatchObject({ status: 'finished', suggestion: null });
    expect(final.messages).toEqual(
      expectedMessages(script).map((message) => ({ ...message, createdAt: expect.any(String) })),
    );
    expect(events.map(({ seq }) => seq)).toEqual(
      Array.from({ length: final.seq - initial.seq }, (_, index) => initial.seq + index + 1),
    );
    expect(await send(client, script.id, 'Anything else?')).toMatchObject({
      ok: false,
      error: { code: 'CHAT_FINISHED' },
    });
  });

  it('acknowledges an accepted message before emitting its events', async () => {
    const client = await startClient();
    const [script] = scripts;
    const order: string[] = [];
    client.onEvent((event) => {
      if (event.chatId === script!.id) {
        order.push('event');
      }
    });

    const turnEnd = waitForTurnEnd(client, script!.id);
    void send(client, script!.id, script!.turns[0]!.expect).then(() => order.push('ack'));
    await turnEnd;

    expect(order[0]).toBe('ack');
    expect(order.length).toBeGreaterThan(1);
  });

  it('accepts the expected message with surrounding whitespace', async () => {
    const client = await startClient();
    const [script] = scripts;

    expect(await playTurn(client, script!.id, `  ${script!.turns[0]!.expect}\n`)).toMatchObject({
      ok: true,
    });
  });

  it('rejects an unexpected message without changing the chat', async () => {
    const client = await startClient();
    const [script] = scripts;
    const before = await getChat(client, script!.id);

    expect(await send(client, script!.id, 'Something else')).toEqual({
      ok: false,
      error: { code: 'UNEXPECTED_MESSAGE', message: expect.any(String) },
    });
    expect(await getChat(client, script!.id)).toEqual(before);
  });

  it('rejects a message while the AI is responding', async () => {
    const client = await startClient();
    const [script] = scripts;
    const [firstTurn, secondTurn] = script!.turns;

    const turnEnd = waitForTurnEnd(client, script!.id);
    const [first, second] = await Promise.all([
      send(client, script!.id, firstTurn!.expect),
      send(client, script!.id, secondTurn!.expect),
    ]);

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: false, error: { code: 'CHAT_RESPONDING' } });
    await turnEnd;
  });

  it('rejects unknown chats and invalid payloads', async () => {
    const client = await startClient();

    expect(await client.request('chat:get', { chatId: 'missing' })).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_CHAT' },
    });
    expect(await client.request('chat:get')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(await client.request('message:send', { chatId: 1, text: 'Hi' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(await send(client, 'missing', 'Hi')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_CHAT' },
    });
    expect(await client.request('chats:delete')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
  });
});
