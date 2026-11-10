import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TableBlock } from "@/chat/blocks.ts";

/** Scrolls sideways inside its own border instead of widening the Message. */
export const TableView = ({ columns, rows }: TableBlock) => (
  <div className="max-w-full rounded-lg border">
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map(({ label }, index) => (
            <TableHead key={index}>{label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, rowIndex) => (
          <TableRow key={rowIndex}>
            {cells.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>
                {cell ?? <span className="text-muted-foreground">—</span>}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
