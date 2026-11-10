import { useState } from "react";
import type { ChatStatus } from "@/chat/protocol.ts";

const announcementFor = (
  previous: ChatStatus,
  status: ChatStatus
): string | null => {
  if (status === "responding") {
    return "Assistant is responding";
  }
  return previous === "responding" ? "Assistant finished responding" : null;
};

/**
 * Tells screen reader users when the assistant starts and stops responding in
 * the open Chat. Remount it per Chat, so opening one mid-response stays quiet.
 * Rejected Messages are announced by the Composer, not here.
 */
export const ResponseAnnouncer = ({ status }: { status: ChatStatus }) => {
  const [previous, setPrevious] = useState(status);
  const [announcement, setAnnouncement] = useState("");
  if (status !== previous) {
    // Adjusting state during render, as React recommends for derived updates.
    setPrevious(status);
    const next = announcementFor(previous, status);
    if (next !== null) {
      setAnnouncement(next);
    }
  }
  return (
    <div role="status" className="sr-only">
      {announcement}
    </div>
  );
};
