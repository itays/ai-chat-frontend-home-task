import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { SendResult } from "@/chat/chatSync.ts";

type SendFailure = Extract<SendResult, { ok: false }>["reason"];

/** What the user is writing in one Chat. */
export type ComposerEntry = {
  draft: string;
  /** True from sending until the backend acknowledges; the draft is locked meanwhile. */
  sending: boolean;
  /** Why the last send failed; cleared as soon as the draft changes. */
  error: string | null;
};

const EMPTY: ComposerEntry = { draft: "", sending: false, error: null };

const describeFailure = (reason: SendFailure) =>
  reason === "UNEXPECTED_MESSAGE"
    ? "Sorry, that's not the message I expected." // A Rejected Message.
    : "Couldn't send your message. Try again.";

/**
 * Per-Chat drafts and sends, in memory only. Lives outside the Composer so a
 * send that is acknowledged after the user switched Chats still lands on the
 * Chat it was sent from.
 */
export const createComposerStore = (
  sendMessage: (chatId: string, text: string) => Promise<SendResult>
) => {
  const store = createStore<Record<string, ComposerEntry>>()(() => ({}));
  const entry = (chatId: string) => store.getState()[chatId] ?? EMPTY;
  const update = (chatId: string, change: Partial<ComposerEntry>) =>
    store.setState({ [chatId]: { ...entry(chatId), ...change } });

  return {
    store,
    edit: (chatId: string, draft: string) => {
      if (!entry(chatId).sending) {
        update(chatId, { draft, error: null });
      }
    },
    /** Sends the trimmed draft unless it is blank or a send is in flight. */
    send: async (chatId: string) => {
      const { draft, sending } = entry(chatId);
      const trimmed = draft.trim();
      if (trimmed === "" || sending) {
        return;
      }
      update(chatId, { sending: true, error: null });
      const result = await sendMessage(chatId, trimmed);
      update(
        chatId,
        result.ok
          ? { sending: false, draft: "" }
          : { sending: false, error: describeFailure(result.reason) }
      );
    },
  };
};

export type ComposerStore = ReturnType<typeof createComposerStore>;

export const useComposerEntry = (
  composer: ComposerStore,
  chatId: string
): ComposerEntry => useStore(composer.store, (state) => state[chatId] ?? EMPTY);
