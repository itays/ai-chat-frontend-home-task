import { DurableObject } from 'cloudflare:workers';
import { ChatStore } from './chatStore.ts';
import { Conversations } from './conversations.ts';
import { createDelay } from './player.ts';
import type { ServerFrame } from './protocol.ts';
import { handleRequest, type RequestContext } from './requests.ts';
import { SCRIPTS } from './script.ts';

type Env = {
  CHAT_ROOM: DurableObjectNamespace<ChatRoom>;
  DELAY_SCALE: string;
};

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname !== '/ws') {
      return new Response('Not found', { status: 404 });
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    // One instance holds every Chat, like the single in-memory server it replaces.
    return env.CHAT_ROOM.getByName('main').fetch(request);
  },
} satisfies ExportedHandler<Env>;

const readRequestFrame = (data: string | ArrayBuffer) => {
  if (typeof data !== 'string') {
    return undefined;
  }
  let frame: unknown;
  try {
    frame = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof frame !== 'object' || frame === null) {
    return undefined;
  }
  const { id, name, payload } = frame as Record<string, unknown>;
  return typeof id === 'number' && Number.isInteger(id)
    ? { id, name, payload }
    : undefined;
};

export class ChatRoom extends DurableObject<Env> {
  #sockets = new Set<WebSocket>();
  #context: RequestContext;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const delayScale = Number(env.DELAY_SCALE);
    if (!Number.isFinite(delayScale) || delayScale < 0) {
      throw new Error(
        `DELAY_SCALE must be a non-negative number, got "${env.DELAY_SCALE}"`,
      );
    }
    const store = new ChatStore((name, event) =>
      this.#broadcast({ type: 'event', name, event } as ServerFrame),
    );
    const conversations = new Conversations(
      SCRIPTS,
      store,
      createDelay(delayScale),
    );
    this.#context = { store, conversations };
  }

  // The standard accept() rather than the Hibernation API: hibernating would
  // drop the Chats and the timers of a playing Turn while clients are connected.
  override fetch(): Response {
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.#sockets.add(server);
    server.addEventListener('message', ({ data }) => {
      const frame = readRequestFrame(data);
      if (frame) {
        const { id, name, payload } = frame;
        const ack = handleRequest(this.#context, name, payload);
        server.send(JSON.stringify({ type: 'ack', id, ack } satisfies ServerFrame));
      }
    });
    const forget = () => this.#sockets.delete(server);
    server.addEventListener('close', forget);
    server.addEventListener('error', forget);
    return new Response(null, { status: 101, webSocket: client });
  }

  #broadcast(frame: ServerFrame): void {
    const data = JSON.stringify(frame);
    for (const socket of this.#sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    }
  }
}
