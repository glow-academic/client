import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";

export interface CrowdsourcedMessageData {
  createdAt: string | null;
  profileId: string | null;
  messageContent: string;
  response: boolean;
  authorName: string;
  authorAlias: string;
  formattedDate: string;
}

export function useCrowdsourcedMessageColumns() {
  const columns: ColumnDef<CrowdsourcedMessageData>[] = [
    {
      accessorKey: "messageContent",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: ({ row }) => (
        <div className="max-w-lg text-left mx-auto text-sm">
          {row.getValue("messageContent")}
        </div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        const message = (row.getValue("messageContent") as string) ?? "";
        return message.toLowerCase().includes((value as string).toLowerCase());
      },
    },
    {
      accessorKey: "response",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Response" />
      ),
      cell: ({ row }) => {
        const isResponse = row.getValue("response") as boolean;
        return (
          <div className="flex justify-center">
            <Badge variant={isResponse ? "default" : "secondary"}>
              {isResponse ? "✅ Response" : "❌ Not Response"}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(String(row.getValue("response")));
      },
    },
    {
      accessorKey: "authorName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Author" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {row.getValue("authorName")}
          </span>
          {row.original.authorAlias && (
            <span className="text-xs text-muted-foreground">
              {row.original.authorAlias}
            </span>
          )}
        </div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(row.getValue("authorName"));
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created At" />
      ),
      cell: ({ row }) => (
        <div className="text-sm text-center">{row.original.formattedDate}</div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(row.original.formattedDate);
      },
    },
  ];

  const responseOptions = [
    { value: "true", label: "✅ Response" },
    { value: "false", label: "❌ Not Response" },
  ];

  return {
    columns,
    responseOptions,
  };
}
