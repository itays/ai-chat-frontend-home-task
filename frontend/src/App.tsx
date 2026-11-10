import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ChatPane } from "./layout/ChatPane.tsx";
import { ChatSidebar } from "./layout/ChatSidebar.tsx";
import { useSelectedChatId } from "./layout/selectedChat.ts";

export const App = () => {
  const selectedChatId = useSelectedChatId();
  return (
    <SidebarProvider>
      <ChatSidebar selectedChatId={selectedChatId} />
      {/* Fixed to the viewport so the message list scrolls, not the page. */}
      <SidebarInset className="h-svh">
        <ChatPane chatId={selectedChatId} />
      </SidebarInset>
    </SidebarProvider>
  );
};
