import { ArrowUpIcon } from "lucide-react";
import { useId, useRef, type KeyboardEvent } from "react";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import type { ChatStoreState } from "@/chat/store.ts";
import { useComposerEntry, type ComposerStore } from "./composerStore.ts";
import { ghostText } from "./suggestion.ts";

/** The backend rejects longer Messages with INVALID_REQUEST. */
const MAX_MESSAGE_LENGTH = 2000;

const selectComposerChat =
  (chatId: string) =>
  ({ chats }: ChatStoreState) => {
    const chat = chats[chatId]?.chat;
    return { status: chat?.status, suggestion: chat?.suggestion ?? null };
  };

/** Shared by the textarea and its ghost-text mirror, so both wrap identically. */
const FIELD_TEXT =
  "col-start-1 row-start-1 px-3 py-2.5 text-base leading-6 break-words whitespace-pre-wrap md:text-sm";

/** Where the user writes the next Message of a Chat. */
export const Composer = ({
  chatId,
  composer,
}: {
  chatId: string;
  composer: ComposerStore;
}) => {
  const { status, suggestion } = useChatState(
    useShallow(selectComposerChat(chatId))
  );
  const { draft, sending, error } = useComposerEntry(composer, chatId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();
  const errorId = useId();
  const blockedReasonId = useId();

  const ghost = ghostText(draft, suggestion);
  const blockedReason =
    status === "responding" ? "Wait for the assistant to finish" : null;
  const canSend = draft.trim() !== "" && !sending && blockedReason === null;

  const send = () => {
    if (canSend) {
      void composer.send(chatId);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab" && !event.shiftKey && ghost !== null) {
      event.preventDefault();
      composer.edit(chatId, draft + ghost);
    } else if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
      <div className="rounded-xl border border-input shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <div className="grid max-h-48 overflow-y-auto">
          <div aria-hidden className={`${FIELD_TEXT} pointer-events-none`}>
            <span className="invisible">{draft}</span>
            {ghost !== null && (
              <span className="text-muted-foreground">{ghost}</span>
            )}
            {/* Keeps a trailing newline's empty line in the height. */}{" "}
          </div>
          <textarea
            ref={textareaRef}
            aria-label="Message"
            aria-describedby={error ? `${errorId} ${hintId}` : hintId}
            aria-invalid={error !== null}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            // Read-only rather than disabled, so focus stays put while sending.
            readOnly={sending}
            value={draft}
            onChange={(event) => composer.edit(chatId, event.target.value)}
            onKeyDown={onKeyDown}
            className={`${FIELD_TEXT} resize-none overflow-hidden bg-transparent outline-none`}
          />
        </div>
        {/* Always rendered, so screen readers announce the error when it appears. */}
        <p
          id={errorId}
          aria-live="polite"
          className="px-3 text-sm text-destructive not-empty:pb-1"
        >
          {error}
        </p>
        <div className="flex items-center gap-2 px-3 pb-2 text-xs text-muted-foreground">
          <p id={hintId} className="min-w-0 flex-1">
            {ghost !== null && (
              <>
                <span className="sr-only">
                  Suggested message: “{suggestion}”
                </span>{" "}
                <Kbd>Tab</Kbd> to accept
              </>
            )}
          </p>
          {blockedReason && <p id={blockedReasonId}>{blockedReason}</p>}
          <Button
            size="icon-sm"
            aria-label="Send message"
            aria-describedby={blockedReason ? blockedReasonId : undefined}
            disabled={!canSend}
            onClick={() => {
              // The button disables itself while sending; keep focus on the draft.
              textareaRef.current?.focus();
              send();
            }}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      </div>
    </div>
  );
};
