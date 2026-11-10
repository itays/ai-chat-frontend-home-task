import { memo } from "react";
import { useShallow } from "zustand/shallow";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { parseBlock } from "@/chat/blocks.ts";
import { useChatState } from "@/chat/ChatClientContext.tsx";
import type { Block, Message as ChatMessage } from "@/chat/protocol.ts";
import type { ChatStoreState } from "@/chat/store.ts";
import { BlockView } from "./BlockView.tsx";

const NO_IDS: string[] = [];

/** A response that has started but has no Blocks to show yet. */
const isAwaitingBlocks = ({ role, status, blocks }: ChatMessage) =>
  role === "assistant" && status === "streaming" && blocks.length === 0;

/** Responses awaiting Blocks are left out: the typing indicator stands in for them. */
const selectMessageIds =
  (chatId: string) =>
  ({ chats }: ChatStoreState): string[] =>
    chats[chatId]?.chat?.messages.flatMap((message) =>
      isAwaitingBlocks(message) ? [] : [message.id]
    ) ?? NO_IDS;

/**
 * Responding, and the response has no Blocks yet. Checks only the last Message:
 * between a response completing and the Chat going idle it is a completed
 * assistant Message, which must not bring the indicator back.
 */
const selectIsTyping =
  (chatId: string) =>
  ({ chats }: ChatStoreState): boolean => {
    const chat = chats[chatId]?.chat;
    if (chat?.status !== "responding") {
      return false;
    }
    const last = chat.messages.at(-1);
    return last === undefined || last.role === "user" || isAwaitingBlocks(last);
  };

const selectMessage =
  (chatId: string, messageId: string) =>
  ({ chats }: ChatStoreState): ChatMessage | undefined =>
    chats[chatId]?.chat?.messages.find(({ id }) => id === messageId);

/**
 * The Messages of a loaded Chat, oldest first. Opens at the latest Message and
 * follows new content until the user scrolls up.
 */
export const MessageList = ({ chatId }: { chatId: string }) => {
  const messageIds = useChatState(useShallow(selectMessageIds(chatId)));
  const isTyping = useChatState(selectIsTyping(chatId));
  return (
    <MessageScrollerProvider autoScroll>
      <MessageScroller className="flex-1">
        <MessageScrollerViewport>
          {/* A log is polite by default, which would read out every streamed word. */}
          <MessageScrollerContent
            aria-label="Messages"
            aria-live="off"
            className="mx-auto w-full max-w-3xl gap-6 p-4"
          >
            {messageIds.map((id) => (
              <MessageScrollerItem key={id} messageId={id}>
                <MessageItem chatId={chatId} messageId={id} />
              </MessageScrollerItem>
            ))}
            {isTyping && (
              <MessageScrollerItem>
                <TypingIndicator />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
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
      <AssistantMessage
        blocks={message.blocks}
        streaming={message.status === "streaming"}
      />
    );
  }
);

const AssistantMessage = ({
  blocks,
  streaming,
}: {
  blocks: Block[];
  streaming: boolean;
}) => (
  <Message aria-busy={streaming || undefined}>
    <MessageContent>
      {blocks.map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
      {streaming && (
        <span
          aria-hidden
          className="block h-4 w-1.5 rounded-full bg-foreground/60 motion-safe:animate-pulse"
        />
      )}
    </MessageContent>
  </Message>
);

const TypingIndicator = () => (
  <Message>
    <MessageContent>
      <div className="flex h-6 items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            aria-hidden
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
        <span className="sr-only">Assistant is typing</span>
      </div>
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
