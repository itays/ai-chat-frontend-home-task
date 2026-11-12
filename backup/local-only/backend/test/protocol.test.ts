import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { blockId, messageId, toFinalBlock } from '../src/blocks.ts';
import type { Ack, Chat, ChatSummary, Message } from '../src/protocol.ts';
import { loadScripts, type ChatScript } from '../src/script.ts';
import { createChatServer } from '../src/server.ts';

type EventPayload = { chatId: string; seq: number; [key: string]: unknown };
type ReceivedEvent = EventPayload & { name: string };

const scripts = loadScripts();
const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

const startClient = async (): Promise<Socket> => {
  const { httpServer, io } = createChatServer({ scripts, delayScale: 0 });
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  const client = connect(`http://localhost:${port}`, { transports: ['websocket'] });
  cleanups.push(() => {
    client.close();
    io.close();
  });
  return client;
};

const getChat = async (client: Socket, chatId: string): Promise<Chat> => {
  const response: Ack<{ chat: Chat }> = await client.emitWithAck('chat:get', { chatId });
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.chat;
};

const send = (client: Socket, chatId: string, text: string) =>
  client.emitWithAck('message:send', { chatId, text });

const recordEvents = (client: Socket, chatId: string): ReceivedEvent[] => {
  const events: ReceivedEvent[] = [];
  client.onAny((name: string, event: EventPayload) => {
    if (event.chatId === chatId) {
      events.push({ name, ...event });
    }
  });
  return events;
};

const waitForTurnEnd = (client: Socket, chatId: string): Promise<void> =>
  new Promise((resolve) => {
    const listener = (name: string, event: EventPayload) => {
      if (name === 'chat:status' && event.chatId === chatId && event.status !== 'responding') {
        client.offAny(listener);
        resolve();
      }
    };
    client.onAny(listener);
  });

const playTurn = async (client: Socket, chatId: string, text: string) => {
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

    const response: Ack<{ chats: ChatSummary[] }> = await client.emitWithAck('chats:list');

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
    client.onAny((_name: string, event: EventPayload) => {
      if (event.chatId === script!.id) {
        order.push('event');
      }
    });

    const turnEnd = waitForTurnEnd(client, script!.id);
    client.emit('message:send', { chatId: script!.id, text: script!.turns[0]!.expect }, () =>
      order.push('ack'),
    );
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

    expect(await client.emitWithAck('chat:get', { chatId: 'missing' })).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_CHAT' },
    });
    expect(await client.emitWithAck('chat:get')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(await client.emitWithAck('message:send', { chatId: 1, text: 'Hi' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_REQUEST' },
    });
    expect(await send(client, 'missing', 'Hi')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_CHAT' },
    });
  });
});
