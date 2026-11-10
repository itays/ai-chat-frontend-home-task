import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ChatClientProvider,
  createSocketChatClient,
} from "./chat/ChatClientContext.tsx";
import { BACKEND_URL } from "./config.ts";
import { AppErrorBoundary } from "./layout/AppErrorBoundary.tsx";
import "./index.css";

// Created outside React so StrictMode's double mount cannot open two sockets.
const chatClient = createSocketChatClient(BACKEND_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChatClientProvider client={chatClient}>
      <TooltipProvider>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </TooltipProvider>
    </ChatClientProvider>
  </StrictMode>
);
