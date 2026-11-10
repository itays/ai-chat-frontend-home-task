import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useChatState } from "./chat/ChatClientContext.tsx";
import { ChatPane } from "./layout/ChatPane.tsx";
import { ChatSidebar } from "./layout/ChatSidebar.tsx";
import { ConnectionBanner } from "./layout/ConnectionBanner.tsx";
import { ServerUnavailable } from "./layout/ServerUnavailable.tsx";
import { useSelectedChatId } from "./layout/selectedChat.ts";

export const App = () => {
  const selectedChatId = useSelectedChatId();
  const connection = useChatState((state) => state.connection);
  if (connection === "unavailable") {
    return <ServerUnavailable />;
  }
  return (
    <SidebarProvider>
      <ChatSidebar selectedChatId={selectedChatId} />
      {/* Fixed to the viewport so the message list scrolls, not the page. */}
      <SidebarInset className="h-svh">
        <ConnectionBanner />
        <ChatPane chatId={selectedChatId} />
      </SidebarInset>
    </SidebarProvider>
  );
};
