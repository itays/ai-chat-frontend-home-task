import { TriangleAlertIcon } from "lucide-react";
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PaneMessage } from "./PaneMessage.tsx";

type Props = { children: ReactNode };

type State = { failed: boolean };

/** The last line of defence: a render error anywhere outside a Block lands here instead of a blank page. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <main className="flex h-svh">
        <PaneMessage
          level={1}
          icon={<TriangleAlertIcon />}
          title="Something went wrong"
          description="The app hit an unexpected error. Reloading brings back your chats; unsent drafts will be lost."
          action={
            <Button onClick={() => window.location.reload()}>Reload</Button>
          }
        />
      </main>
    );
  }
}
