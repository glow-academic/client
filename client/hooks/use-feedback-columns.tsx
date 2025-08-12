import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { Badge } from "@/components/ui/badge";
import { ColumnDef } from "@tanstack/react-table";

export interface FeedbackData {
  id: number;
  createdAt: string | null;
  profileId: string | null;
  type: "feature" | "bug" | "question" | "other";
  message: string | null;
  authorName: string;
  authorAlias: string;
  formattedDate: string;
}

export function useFeedbackColumns(
  onViewDetails?: (feedback: FeedbackData) => void
) {
  const getFeedbackTypeVariant = (type: string) => {
    switch (type) {
      case "bug":
        return "destructive";
      case "feature":
        return "default";
      case "question":
        return "secondary";
      case "other":
        return "outline";
      default:
        return "default";
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return "🐛";
      case "feature":
        return "✨";
      case "question":
        return "❓";
      case "other":
        return "📝";
      default:
        return "📝";
    }
  };

  const truncateText = (text: string | null, maxLength: number = 100) => {
    if (!text) return "N/A";
    return text.length > maxLength
      ? `${text.substring(0, maxLength)}...`
      : text;
  };

  const columns: ColumnDef<FeedbackData>[] = [
    // ID column removed per requirements
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        return (
          <div className="flex justify-center">
            <Badge variant={getFeedbackTypeVariant(type)}>
              {getFeedbackTypeIcon(type)} {type.toUpperCase()}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        return value.includes(row.getValue("type"));
      },
    },
    {
      accessorKey: "message",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Message" />
      ),
      cell: ({ row }) => (
        <div className="max-w-md">
          <span className="truncate">
            {truncateText(row.getValue("message"))}
          </span>
        </div>
      ),
      enableSorting: true,
      enableHiding: false,
      enableColumnFilter: true,
      filterFn: (row, _, value) => {
        if (!value || value.length === 0) return true;
        const message = row.getValue("message") as string;
        return message.toLowerCase().includes(value.toLowerCase());
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
    // Actions column removed per requirements
  ];

  // Generate filter options
  const typeOptions = [
    { value: "bug", label: "🐛 Bug" },
    { value: "feature", label: "✨ Feature" },
    { value: "question", label: "❓ Question" },
    { value: "other", label: "📝 Other" },
  ];

  return {
    columns,
    typeOptions,
  };
}
