import { TriangleAlertIcon } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** The last line of defence: a render error anywhere outside a Block lands here instead of a blank page. */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <main className="flex h-svh">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle role="heading" aria-level={1}>
              Something went wrong
            </EmptyTitle>
            <EmptyDescription>
              The app hit an unexpected error. Reloading brings back your chats;
              unsent drafts will be lost.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }
}
