import { TriangleAlertIcon } from "lucide-react";
import { Component, type ReactNode } from "react";

type Props = {
  /** Changing this clears a caught error, so a later update to the Block gets another try. */
  resetKey: unknown;
  children: ReactNode;
};

type State = { failed: boolean; resetKey: unknown };

/** Keeps one Block's render failure from taking down its Message or the Chat. */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.resetKey === state.resetKey
      ? null
      : { failed: false, resetKey: props.resetKey };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }
    return (
      <div className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
        This content couldn't be displayed.
      </div>
    );
  }
}
