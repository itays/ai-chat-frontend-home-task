import { memo } from "react";
import { useShallow } from "zustand/shallow";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { parseBlock } from "@/chat/blocks.ts";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import type { Block, Message as ChatMessage } from "@/chat/protocol.ts";
import type { ChatStoreState } from "@/chat/store.ts";
import { BlockView } from "./BlockView.tsx";

const NO_IDS: string[] = [];

const selectMessageIds =
  (chatId: string) =>
  ({ chats }: ChatStoreState): string[] =>
    chats[chatId]?.chat?.messages.map(({ id }) => id) ?? NO_IDS;

const selectMessage =
  (chatId: string, messageId: string) =>
  ({ chats }: ChatStoreState): ChatMessage | undefined =>
    chats[chatId]?.chat?.messages.find(({ id }) => id === messageId);

/** The Messages of a loaded Chat, oldest first. */
export const MessageList = ({ chatId }: { chatId: string }) => {
  const messageIds = useChatState(useShallow(selectMessageIds(chatId)));
  return (
    // A log is polite by default, which would read out every streamed word.
    // TODO(slice 5): move onto message-scroller, next to its own live region.
    <div
      role="log"
      aria-label="Messages"
      aria-live="off"
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        {messageIds.map((id) => (
          <MessageItem key={id} chatId={chatId} messageId={id} />
        ))}
      </div>
    </div>
  );
};

const MessageItem = memo(
  ({ chatId, messageId }: { chatId: string; messageId: string }) => {
    const message = useChatState(selectMessage(chatId, messageId));
    if (!message) {
      return null;
    }
    return message.role === "user" ? (
      <UserMessage blocks={message.blocks} />
    ) : (
      <AssistantMessage blocks={message.blocks} />
    );
  }
);

const AssistantMessage = ({ blocks }: { blocks: Block[] }) => (
  <Message>
    <MessageContent>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </MessageContent>
  </Message>
);

/** What the user typed, shown verbatim rather than as markdown. */
const UserMessage = ({ blocks }: { blocks: Block[] }) => (
  <Message align="end">
    <MessageContent>
      {blocks.map((block) => {
        const parsed = parseBlock(block);
        return parsed.kind === "markdown" ? (
          <Bubble key={block.id} variant="secondary" align="end">
            <BubbleContent className="whitespace-pre-wrap">
              {parsed.text}
            </BubbleContent>
          </Bubble>
        ) : (
          <BlockView key={block.id} block={block} />
        );
      })}
    </MessageContent>
  </Message>
);
