import type { Failure, ProtocolErrorCode } from './protocol.ts';

const ERROR_MESSAGES: Record<ProtocolErrorCode, string> = {
  INVALID_REQUEST: 'The request payload is invalid.',
  UNKNOWN_CHAT: 'No chat has this ID.',
  UNEXPECTED_MESSAGE: "Sorry, that's not the message I expected.",
  CHAT_RESPONDING: 'The AI is still responding in this chat.',
  CHAT_FINISHED: 'This chat has finished.',
};

export const failure = (code: ProtocolErrorCode): Failure => ({
  ok: false,
  error: { code, message: ERROR_MESSAGES[code] },
});
