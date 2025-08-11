import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { ColumnDef } from "@tanstack/react-table";

export interface CrowdsourcedRubricFeedbackData {
  id: string;
  createdAt: string | null;
  profileId: string;
  simulationChatFeedbackId: string;
  total: number;
  feedback: string | null;
  authorName: string;
  authorAlias: string;
  formattedDate: string;
}

function truncateText(text: string | null, maxLength = 120) {
  if (!text) return "N/A";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function useCrowdsourcedRubricFeedbackColumns() {
  const columns: ColumnDef<CrowdsourcedRubricFeedbackData>[] = [
    {
      accessorKey: "id",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="ID" />
      ),
      cell: ({ row }) => (
        <div className="font-medium text-center text-xs break-all">
          {row.getValue("id")}
        </div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(row.getValue("id"));
      },
    },
    {
      accessorKey: "total",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("total")}</div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(String(row.getValue("total")));
      },
    },
    {
      accessorKey: "feedback",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Feedback" />
      ),
      cell: ({ row }) => (
        <div className="max-w-lg text-left mx-auto">
          {truncateText(row.getValue("feedback"))}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        const feedback = (row.getValue("feedback") as string | null) ?? "";
        return feedback.toLowerCase().includes((value as string).toLowerCase());
      },
    },
    {
      accessorKey: "authorName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Author" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{row.getValue("authorName")}</span>
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

  return { columns };
}



