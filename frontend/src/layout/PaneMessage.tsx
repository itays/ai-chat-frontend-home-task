import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/** A centred placeholder explaining why there is nothing else to show, with an optional way out. */
export const PaneMessage = ({
  icon,
  title,
  description,
  action,
  level = 2,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** 1 when the message is the whole page, 2 inside the Chat pane under its title. */
  level?: 1 | 2;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">{icon}</EmptyMedia>
      <EmptyTitle role="heading" aria-level={level}>
        {title}
      </EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action && <EmptyContent>{action}</EmptyContent>}
  </Empty>
);
