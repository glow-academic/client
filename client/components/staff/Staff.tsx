/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * All data is fetched server-side and passed as props.
 * All actions use server actions - no client-side data fetching.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// UI Components
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTableFacetedFilter } from "@/components/common/table/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  Download,
  Edit,
  Eye,
  FileUp,
  Map,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";

// Import types from page (all types are already exported from the page)
import type {
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  BulkDeleteStaffIn,
  BulkDeleteStaffOut,
  CreateStaffDataOut,
  CSVColumnMapping,
  DeleteStaffIn,
  DeleteStaffOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProcessedCSVRow,
  ProfileListItem,
  SearchStaffIn,
  SearchStaffOut,
  StaffListOut,
} from "@/app/(main)/management/staff/page";

// Explicitly define server action types (matching the page exports)
export type DeleteStaffAction = (
  input: DeleteStaffIn,
) => Promise<DeleteStaffOut>;
export type BulkDeleteStaffAction = (
  input: BulkDeleteStaffIn,
) => Promise<BulkDeleteStaffOut>;
export type SearchStaffAction = (
  input: SearchStaffIn,
) => Promise<SearchStaffOut>;
export type ProcessCSVAction = (input: ProcessCSVIn) => Promise<ProcessCSVOut>;
export type BulkCreateOrUpdateStaffAction = (
  input: BulkCreateOrUpdateStaffIn,
) => Promise<BulkCreateOrUpdateStaffOut>;

export interface StaffProps {
  // Server-provided data (fetched server-side, no client fetching)
  listData: StaffListOut;
  initialCreateStaffData?: CreateStaffDataOut;
  // Server actions (pure server actions, no client-side mutations)
  deleteStaffAction?: DeleteStaffAction;
  bulkDeleteStaffAction?: BulkDeleteStaffAction;
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
}

// Helper functions
const getInitials = (firstName: string, lastName: string): string => {
  if (!firstName && !lastName) return "??";
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "??";
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case "superadmin":
    case "admin":
    case "instructional":
      return Shield;
    case "member":
    case "guest":
    default:
      return UserIcon;
  }
};

const getRoleDisplayName = (role: string): string => {
  switch (role) {
    case "superadmin":
      return "Super Administrator";
    case "admin":
      return "Administrator";
    case "instructional":
      return "Instructional Staff";
    case "member":
      return "Member";
    case "guest":
      return "Guest";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const formatLastActive = (timestamp: string | null): string => {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
};

// CSV Import constants and helpers
type CSVStage = "upload" | "mapping" | "review";

const TARGET_FIELDS = [
  {
    value: "first_name",  // snake_case
    label: "First Name",
    description: "The staff member's first name",
    required: true,
  },
  {
    value: "last_name",  // snake_case
    label: "Last Name",
    description: "The staff member's last name",
    required: true,
  },
  {
    value: "email",
    label: "Email",
    description: "Email address (full email with @domain)",
    required: true,
  },
  {
    value: "role",
    label: "Role",
    description: "Staff role (instructional, ta, guest, admin, etc.)",
    required: false,
  },
  {
    value: "department",
    label: "Department",
    description: "Department assignment (optional if scoped)",
    required: false,
  },
  {
    value: "cohort",
    label: "Cohort",
    description: "Cohort assignment (optional if scoped)",
    required: false,
  },
] as const;

const unparseCSV = (data: Record<string, string>[]): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] || "";
          if (
            value.includes(",") ||
            value.includes('"') ||
            value.includes("\n")
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(","),
    ),
  ];
  return csvContent.join("\n");
};

const autoMapColumn = (columnName: string): string | null => {
  const lower = columnName.toLowerCase().trim();
  if (
    ["first name", "firstname", "first_name", "fname", "first"].includes(lower)
  ) {
    return "first_name";  // snake_case
  }
  if (["last name", "lastname", "last_name", "lname", "last"].includes(lower)) {
    return "last_name";  // snake_case
  }
  if (
    ["email", "alias", "username", "user", "login", "email address"].includes(
      lower,
    )
  ) {
    return "email";
  }
  if (["role", "user role", "permission"].includes(lower)) {
    return "role";
  }
  if (["department", "dept", "department_id", "dept_id"].includes(lower)) {
    return "department";
  }
  if (["cohort", "cohort_id", "cohort_name", "cohort name"].includes(lower)) {
    return "cohort";
  }
  return null;
};

const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

// ColumnPicker Component for CSV mapping
interface ColumnPickerProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  availableFields: Array<(typeof TARGET_FIELDS)[number]>;
}

function ColumnPicker({
  value,
  onValueChange,
  availableFields,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (fieldValue: string) => {
    if (fieldValue === "__ignore__") {
      onValueChange(null);
    } else {
      onValueChange(fieldValue);
    }
    setOpen(false);
  };

  const selectedField = availableFields.find((f) => f.value === value);
  const displayValue = value
    ? selectedField?.label || value
    : "Select field...";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => handleSelect("__ignore__")}>
                <div className="flex items-center justify-between w-full">
                  <span className="text-muted-foreground">(Ignore)</span>
                  {!value && <Check className="ml-auto h-4 w-4 opacity-100" />}
                </div>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Fields">
              {availableFields.map((field) => (
                <CommandItem
                  key={field.value}
                  onSelect={() => handleSelect(field.value)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{field.label}</span>
                        {field.required && (
                          <span className="text-destructive">*</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {field.description}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 shrink-0",
                        value === field.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// KPI Components
import ActiveUsersKPI from "./kpis/ActiveUsersKPI";
import AdminUsersKPI from "./kpis/AdminUsersKPI";
import InstructionalUsersKPI from "./kpis/InstructionalUsersKPI";
import TAUsersKPI from "./kpis/TAUsersKPI";
import TotalRequestsKPI from "./kpis/TotalRequestsKPI";

export default function Staff({
  listData: serverListData,
  initialCreateStaffData,
  deleteStaffAction,
  bulkDeleteStaffAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
}: StaffProps) {
  const router = useRouter();
  const { effectiveProfile, departmentIds: profileDepartmentIds } =
    useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selection state
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  // Bulk delete dialog
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Single delete dialog
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [deleteStaffMember, setDeleteStaffMember] =
    useState<ProfileListItem | null>(null);

  // CSV Import state
  const [showCSVImportModal, setShowCSVImportModal] = useState(false);
  const [csvStage, setCsvStage] = useState<CSVStage>("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [columnMappings, setColumnMappings] = useState<CSVColumnMapping[]>([]);
  const [processedRows, setProcessedRows] = useState<ProcessedCSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editableRows, setEditableRows] = useState<
    Record<number, ProcessedCSVRow>
  >({});
  const [includedColumns, setIncludedColumns] = useState<
    Record<string, boolean>
  >({});
  const [showErrorRows, setShowErrorRows] = useState(true);

  // Table state
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    name: false,
    active: false,
    lastActive: false,
    department_ids: true,
    cohort_ids: false,
    total_requests: true,
  });
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "last_active", desc: true },
  ]);

  // Extract data from server-provided data
  const staff = useMemo(
    () => serverListData?.staff || [],
    [serverListData?.staff],
  );
  const cohorts = useMemo(
    () => serverListData?.cohorts || [],
    [serverListData?.cohorts],
  );
  const departments = useMemo(
    () => serverListData?.departments || [],
    [serverListData?.departments],
  );
  const trendData = useMemo(
    () => ({
      active: (serverListData?.trend_data_active || [])
        .filter((item) => item.date !== null && item.value !== null && item.count !== null)
        .map((item) => ({ date: item.date!, value: item.value!, count: item.count! })),
      admin: (serverListData?.trend_data_admin || [])
        .filter((item) => item.date !== null && item.value !== null && item.count !== null)
        .map((item) => ({ date: item.date!, value: item.value!, count: item.count! })),
      instructional: (serverListData?.trend_data_instructional || [])
        .filter((item) => item.date !== null && item.value !== null && item.count !== null)
        .map((item) => ({ date: item.date!, value: item.value!, count: item.count! })),
      member: (serverListData?.trend_data_member || [])
        .filter((item) => item.date !== null && item.value !== null && item.count !== null)
        .map((item) => ({ date: item.date!, value: item.value!, count: item.count! })),
      total_requests: (serverListData?.trend_data_total_requests || [])
        .filter((item) => item.date !== null && item.value !== null && item.count !== null)
        .map((item) => ({ date: item.date!, value: item.value!, count: item.count! })),
    }),
    [
      serverListData?.trend_data_active,
      serverListData?.trend_data_admin,
      serverListData?.trend_data_instructional,
      serverListData?.trend_data_member,
      serverListData?.trend_data_total_requests,
    ],
  );

  // Calculate counts for KPI cards
  const counts = useMemo(() => {
    const activeStaff = staff.filter((s) => s.active);
    const inactiveStaff = staff.filter((s) => !s.active);

    return {
      total: staff.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      instructional: staff.filter((s) => s.role === "instructional").length,
      member: staff.filter((s) => s.role === "member").length,
      admin: staff.filter((s) => s.role === "admin").length,
      superadmin: staff.filter((s) => s.role === "superadmin").length,
      guest: staff.filter((s) => s.role === "guest").length,
      totalRequests: staff.reduce((sum, s) => sum + (s.total_requests || 0), 0),
    };
  }, [staff]);

  // Refresh data by revalidating server-side data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Staff data refreshed");
    } catch {
      toast.error("Failed to refresh staff data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Use server-provided filter options directly
  const roleOptions = useMemo(() => {
    const options = serverListData?.role_options;
    if (!options || !Array.isArray(options)) return [];
    return options
      .map((opt: unknown) => {
        if (opt && typeof opt === "object" && "value" in opt && "label" in opt) {
          return {
            value: String(opt.value),
            label: String(opt.label),
          };
        }
        return null;
      })
      .filter((opt): opt is { value: string; label: string } => opt !== null && !!opt.value && !!opt.label);
  }, [serverListData?.role_options]);

  const lastActiveOptions = useMemo(() => {
    const options = serverListData?.last_active_options;
    if (!options || !Array.isArray(options)) return [];
    return options
      .map((opt: unknown) => {
        if (opt && typeof opt === "object" && "value" in opt && "label" in opt) {
          return {
            value: String(opt.value),
            label: String(opt.label),
          };
        }
        return null;
      })
      .filter((opt): opt is { value: string; label: string } => opt !== null && !!opt.value && !!opt.label);
  }, [serverListData?.last_active_options]);

  // Transform mappings for CSV import
  const departmentMappingForCSV = useMemo(() => {
    const createStaffData = initialCreateStaffData;
    const mapping: Record<string, { name: string; description: string }> = {};
    if (createStaffData && "departments" in createStaffData && Array.isArray(createStaffData.departments)) {
      createStaffData.departments.forEach((dept) => {
        if (dept && dept.department_id) {
          mapping[dept.department_id] = {
            name: dept.name ?? "",
            description: dept.description ?? "",
          };
        }
      });
    }
    return mapping;
  }, [initialCreateStaffData]);

  const cohortMappingForCSV = useMemo(() => {
    const createStaffData = initialCreateStaffData;
    const mapping: Record<string, { name: string; description: string }> = {};
    if (createStaffData && "cohorts" in createStaffData && Array.isArray(createStaffData.cohorts)) {
      createStaffData.cohorts.forEach((cohort) => {
        if (cohort && cohort.cohort_id) {
          mapping[cohort.cohort_id] = {
            name: cohort.name ?? "",
            description: cohort.description ?? "",
          };
        }
      });
    }
    return mapping;
  }, [initialCreateStaffData]);

  const validDepartmentIdsForCSV = useMemo(
    () => Object.keys(departmentMappingForCSV),
    [departmentMappingForCSV],
  );
  const validCohortIdsForCSV = useMemo(
    () => Object.keys(cohortMappingForCSV),
    [cohortMappingForCSV],
  );
  const roleOptionsForCSV = useMemo(
    () => initialCreateStaffData?.role_options || [],
    [initialCreateStaffData],
  );

  // CSV Import logic
  const validRoles = useMemo(() => {
    const roleOrder = ["member", "instructional", "admin", "superadmin"];
    return roleOrder.filter((role) => roleOptionsForCSV.includes(role));
  }, [roleOptionsForCSV]);

  const availableTargetFields = useMemo(() => {
    return [...TARGET_FIELDS];
  }, []);

  const csvRequirements = useMemo(() => {
    return {
      required: ["First Name", "Last Name", "Email"],
      optional: ["Role", "Department", "Cohort"],
    };
  }, []);

  // Reset CSV state when modal closes
  React.useEffect(() => {
    if (!showCSVImportModal) {
      setCsvStage("upload");
      setCsvContent("");
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMappings([]);
      setProcessedRows([]);
      setEditableRows({});
      setIncludedColumns({});
      setShowErrorRows(true);
    }
  }, [showCSVImportModal]);

  const hasErrors = useMemo(
    () => processedRows.some((row) => (row.errors?.length ?? 0) > 0),
    [processedRows],
  );

  React.useEffect(() => {
    if (hasErrors) {
      setShowErrorRows(true);
    }
  }, [hasErrors]);

  const parseCSV = useCallback(
    (
      csvText: string,
    ): { headers: string[]; rows: Record<string, string>[] } => {
      const lines = csvText.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0]!.split(",").map((h) => h.trim());
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line?.trim()) continue;

        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        rows.push(row);
      }

      return { headers, rows };
    },
    [],
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        toast.error("Please upload a CSV file (.csv format).");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csvText = (event.target?.result as string) || "";
          const { headers, rows } = parseCSV(csvText);

          setCsvContent(csvText);
          setCsvHeaders(headers);
          setCsvRows(rows);

          const mappings: CSVColumnMapping[] = headers.map((header) => ({
            csv_column: header,
            target_field: autoMapColumn(header),
          }));
          setColumnMappings(mappings);

          const requiredFields = ["first_name", "last_name", "email"];  // snake_case
          const initialIncludes: Record<string, boolean> = {};
          headers.forEach((header) => {
            const mappedField = autoMapColumn(header);
            initialIncludes[header] = mappedField
              ? requiredFields.includes(mappedField)
              : true;
          });
          setIncludedColumns(initialIncludes);

          setCsvStage("mapping");
          toast.success(`CSV file loaded with ${rows.length} row(s).`);
        } catch (error) {
          toast.error(
            `Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      };
      reader.readAsText(file);
    },
    [parseCSV],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFileDialog,
  } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    noKeyboard: true,
  });

  const downloadTemplate = useCallback(() => {
    const template = [
      {
        first_name: "Sarah",  // snake_case
        last_name: "Johnson",  // snake_case
        email: "redacted@purdue.edu",
        role: "instructional",
        department: "",
        cohort: "",
      },
      {
        first_name: "Jane",  // snake_case
        last_name: "Smith",  // snake_case
        email: "redacted@purdue.edu",
        role: "instructional",
        department: "",
        cohort: "",
      },
      {
        first_name: "John",  // snake_case
        last_name: "Doe",  // snake_case
        email: "redacted@purdue.edu",
        role: "member",
        department: "",
        cohort: "",
      },
    ];

    const csv = unparseCSV(template);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "staff_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleProcessCSV = useCallback(async () => {
    const activeMappings = columnMappings.filter(
      (m) => m.csv_column && includedColumns[m.csv_column] !== false,
    );

    const requiredFields = ["firstName", "lastName", "email"];
    const mappedFields = activeMappings
      .map((m) => m.target_field)
      .filter((f): f is string => f !== null);

    const missingFields = requiredFields.filter(
      (field) => !mappedFields.includes(field),
    );
    if (missingFields.length > 0) {
      toast.error(
        `Please map the following required fields: ${missingFields.join(", ")}`,
      );
      return;
    }

    if (!processCSVAction) {
      toast.error("Process CSV action not available");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await processCSVAction({
        body: {
          csv_content: csvContent,
          column_mappings: activeMappings,
        },
      });

      setProcessedRows(response.rows ?? []);
      setEditableRows({});
      setCsvStage("review");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process CSV file.";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, columnMappings, includedColumns, processCSVAction]);

  const duplicateAliasMap = useMemo(() => {
    const aliasMap: Record<string, number[]> = {};
    processedRows.forEach((row, idx) => {
      const editableRow = editableRows[idx] || row;
      const emails = editableRow.emails || [];
      emails.forEach((email) => {
        const normalized = normalizeEmail(email);
        if (normalized) {
          if (!aliasMap[normalized]) {
            aliasMap[normalized] = [];
          }
          aliasMap[normalized]!.push(idx);
        }
      });
    });
    const duplicates = new Set<number>();
    Object.values(aliasMap).forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((idx) => duplicates.add(idx));
      }
    });
    return duplicates;
  }, [processedRows, editableRows]);

  const updateEditableRow = useCallback(
    (rowIndex: number, field: string, value: string | null | string[]) => {
      setEditableRows((prev) => {
        const current = prev[rowIndex] || processedRows[rowIndex];
        if (!current) return prev;

        const updated = { ...current } as ProcessedCSVRow &
          Record<string, string | null | string[]>;

        if (field === "department_ids" || field === "cohort_ids") {
          updated[field] = Array.isArray(value) ? value : [];
        } else if (field === "emails") {
          if (Array.isArray(value)) {
            updated[field] = value;
          } else if (typeof value === "string") {
            updated[field] = value
              .split(",")
              .map((e) => e.trim())
              .filter((e) => e.length > 0);
          } else {
            updated[field] = [];
          }
        } else {
          updated[field] = value;
        }

        const errors = [...(updated.errors ?? [])];
        const errorIndex = errors.findIndex((e) => e.field === field);
        if (errorIndex >= 0) {
          errors.splice(errorIndex, 1);
        }
        updated.errors = errors;

        return { ...prev, [rowIndex]: updated };
      });
    },
    [processedRows],
  );

  const handleCSVSubmit = useCallback(async () => {
    const finalRows = processedRows.map((row, index) => {
      return editableRows[index] || row;
    });

    const validRows = finalRows.filter((row) => (row.errors?.length ?? 0) === 0);

    if (validRows.length === 0) {
      toast.error("No valid rows to process. Please fix errors.");
      return;
    }

    const invalidRoles = validRows
      .map((row, idx) => {
        const role = row.role || "member";
        if (!validRoles.includes(role)) {
          return { index: idx, role };
        }
        return null;
      })
      .filter((r): r is { index: number; role: string } => r !== null);

    if (invalidRoles.length > 0) {
      toast.error(
        `Invalid roles found: ${invalidRoles.map((r) => r.role).join(", ")}. ` +
          `Allowed roles: ${validRoles.join(", ")}`,
      );
      return;
    }

    const emailCounts: Record<string, number[]> = {};
    validRows.forEach((row, idx) => {
      const emails = row.emails || [];
      emails.forEach((email) => {
        const normalized = normalizeEmail(email);
        if (normalized) {
          if (!emailCounts[normalized]) {
            emailCounts[normalized] = [];
          }
          emailCounts[normalized]!.push(idx);
        }
      });
    });

    const duplicateEmails = Object.entries(emailCounts)
      .filter(([, indices]) => indices.length > 1)
      .map(([email]) => email);

    if (duplicateEmails.length > 0) {
      toast.error(
        `Duplicate emails found in CSV: ${duplicateEmails.join(", ")}`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const profiles = validRows.map((row) => {
        const rowDeptIds = row.department_ids || [];
        const deptIds = rowDeptIds
          .map((deptIdOrName) => {
            if (validDepartmentIdsForCSV.includes(deptIdOrName)) {
              return deptIdOrName;
            }
            const found = Object.entries(departmentMappingForCSV).find(
              ([_, dept]) =>
                dept.name.toLowerCase() === deptIdOrName.toLowerCase(),
            );
            return found ? found[0] : null;
          })
          .filter((id): id is string => id !== null);

        const rowCohortIds = row.cohort_ids || [];
        const cohortIds = rowCohortIds
          .map((cohortIdOrName) => {
            if (validCohortIdsForCSV.includes(cohortIdOrName)) {
              return cohortIdOrName;
            }
            const found = Object.entries(cohortMappingForCSV).find(
              ([_, cohort]) =>
                cohort.name.toLowerCase() === cohortIdOrName.toLowerCase(),
            );
            return found ? found[0] : null;
          })
          .filter((id): id is string => id !== null);

        const emails = (row.emails || [])
          .map((e) => normalizeEmail(e))
          .filter((e) => e.length > 0);
        if (emails.length === 0) {
          emails.push("");
        }
        return {
          first_name: row.first_name ?? "",  // snake_case
          last_name: row.last_name ?? "",  // snake_case
          emails: emails,
          primary_email_index:
            row.primary_email_index !== null &&
            row.primary_email_index !== undefined &&
            row.primary_email_index < emails.length
              ? row.primary_email_index
              : 0,
          role: row.role ?? "member",
          active: true,  // Default to active for new staff
          department_ids: deptIds,
          cohort_ids: cohortIds,
        };
      });

      if (!bulkCreateOrUpdateStaffAction) {
        toast.error("Bulk create or update action not available");
        return;
      }

      if (!effectiveProfile?.id) {
        toast.error("Profile ID is required");
        return;
      }

      const response = await bulkCreateOrUpdateStaffAction({
        body: {
          profiles,
          current_profile_id: effectiveProfile.id,
        },
      });

      router.refresh();
      toast.success(
        `Successfully processed ${response.created_count} created, ${response.updated_count} updated staff member(s)!`,
      );

      setShowCSVImportModal(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create or update staff members.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    processedRows,
    editableRows,
    departmentMappingForCSV,
    validDepartmentIdsForCSV,
    cohortMappingForCSV,
    validCohortIdsForCSV,
    validRoles,
    bulkCreateOrUpdateStaffAction,
    router,
    effectiveProfile?.id,
  ]);

  const validRowCount = processedRows.filter(
    (row) => (row.errors?.length ?? 0) === 0,
  ).length;

  // Table columns definition
  const columns = useMemo<ColumnDef<ProfileListItem>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Staff Member" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                  style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                >
                  {getInitials(staff.first_name ?? "", staff.last_name ?? "")}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {staff.first_name} {staff.last_name}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {staff.emails && staff.emails.length > 0
                      ? staff.emails.join(", ")
                      : staff.primary_email || "No email"}
                  </p>
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  staff.active ? "bg-green-500" : "bg-gray-400"
                }`}
                title={staff.active ? "Active" : "Inactive"}
              />
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value): boolean => {
          const staff = row.original;
          if (!value) return true;
          const valueLower = String(value).toLowerCase();
          const emails = staff.emails || [];
          const emailMatch =
            emails.some((e) => e.toLowerCase().includes(valueLower)) ||
            (staff.primary_email !== null &&
              staff.primary_email.toLowerCase().includes(valueLower));
          return Boolean(
            (staff.first_name ?? "").toLowerCase().includes(valueLower) ||
              (staff.last_name ?? "").toLowerCase().includes(valueLower) ||
              emailMatch,
          );
        },
      },
      {
        id: "name",
        accessorFn: (row: ProfileListItem) => {
          const emails =
            row.emails && row.emails.length > 0
              ? row.emails.join(" ")
              : row.primary_email || "";
          return `${row.first_name} ${row.last_name} ${emails}`.toLowerCase();
        },
        header: "Search",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const role = staff.role ?? "member";
          const RoleIcon = getRoleIcon(role);
          return (
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {getRoleDisplayName(role)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(staff.role);
        },
      },
      {
        id: "active",
        accessorFn: (row: ProfileListItem) => (row.active ? "true" : "false"),
        header: "Active",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        id: "cohort_ids",
        accessorFn: (row: ProfileListItem) => row.cohort_ids ?? [],
        filterFn: (row, _, value: string[]) => {
          const rowIds = (row.getValue("cohort_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohorts" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const cohortIds = staff.cohort_ids ?? [];

          if (!cohortIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }

          return (
            <div className="flex gap-1 overflow-x-auto max-w-[150px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {cohortIds.map((id) => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="text-xs whitespace-nowrap flex-shrink-0"
                >
                  {cohorts.find((c) => c.cohort_id === id)?.name || id}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "department_ids",
        accessorFn: (row: ProfileListItem) => row.department_ids ?? [],
        filterFn: (row, _, value: string[]) => {
          const rowIds = (row.getValue("department_ids") as string[]) ?? [];
          return value.some((v) => rowIds.includes(v));
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Departments" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const departmentIds = staff.department_ids ?? [];

          if (!departmentIds.length) {
            return <span className="text-xs text-muted-foreground">None</span>;
          }

          return (
            <div className="flex gap-1 overflow-x-auto max-w-[150px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {departmentIds.map((id) => (
                <Badge
                  key={id}
                  variant="secondary"
                  className="text-xs whitespace-nowrap flex-shrink-0"
                >
                  {departments.find((d) => d.department_id === id)?.name || id}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "lastActive",
        accessorFn: (row: ProfileListItem) => {
          const lastActive = row.last_active;
          if (!lastActive) return "never";

          const date = new Date(lastActive);
          const now = new Date();
          const diffInDays = Math.floor(
            (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (diffInDays < 7) return "recent";
          if (diffInDays <= 30) return "moderate";
          return "old";
        },
        header: "Last Active Category",
        cell: () => null,
        enableHiding: false,
        enableSorting: false,
      },
      {
        accessorKey: "last_active",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Active" />
        ),
        cell: ({ row }) => {
          const lastActive = row.getValue("last_active") as string | null;
          const formatted = formatLastActive(lastActive);
          return (
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span
                className={`text-sm ${!lastActive ? "text-muted-foreground" : ""}`}
              >
                {formatted}
              </span>
            </div>
          );
        },
        enableSorting: true,
        sortingFn: "datetime",
      },
      {
        id: "requests",
        accessorFn: (row) => row.requests_in_last_day ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Requests / Day" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const used = staff.requests_in_last_day ?? 0;
          const limit = staff.requests_per_day;
          const limitText =
            limit === null || limit === undefined ? "∞" : String(limit);
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium">
                {used}/{limitText}
              </span>
              <span className="text-xs text-muted-foreground">used</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        id: "total_requests",
        accessorFn: (row) => row.total_requests ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total Requests" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const total = staff.total_requests ?? 0;
          return (
            <div className="flex items-center justify-center">
              <span className="text-sm font-medium">{total}</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value: string[]) => {
          const total = row.getValue("total_requests") as number;
          if (value.length === 0) return true;
          return value.some((category) => {
            if (category === "0") return total === 0;
            if (category === "1-10") return total >= 1 && total <= 10;
            if (category === "11-50") return total >= 11 && total <= 50;
            if (category === "51-100") return total >= 51 && total <= 100;
            if (category === "100+") return total > 100;
            return false;
          });
        },
      },
    ],
    [cohorts, departments],
  );

  // Build columns with checkbox + actions
  const columnsWithActions = useMemo(() => {
    const checkboxColumn: ColumnDef<ProfileListItem> = {
      id: "select",
      header: ({ table }) => (
        <div className="pr-2">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value);
              const visibleRowIds = table
                .getFilteredRowModel()
                .rows.map((row) => row.original.profile_id)
                .filter((id): id is string => id !== null && id !== undefined);
              if (value) {
                setSelectedStaffIds((prev) => {
                  const newSelection = [...prev];
                  visibleRowIds.forEach((id) => {
                    if (!newSelection.includes(id)) {
                      newSelection.push(id);
                    }
                  });
                  return newSelection;
                });
              } else {
                setSelectedStaffIds((prev) =>
                  prev.filter((id) => !visibleRowIds.includes(id)),
                );
              }
            }}
            aria-label="Select all"
            className="translate-y-[2px]"
            data-testid="checkbox-select-all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="pr-2">
          <Checkbox
            checked={row.original.profile_id ? selectedStaffIds.includes(row.original.profile_id) : false}
            onCheckedChange={(value) => {
              if (!row.original.profile_id) return;
              setSelectedStaffIds((prev) =>
                value
                  ? [...prev, row.original.profile_id!]
                  : prev.filter((x) => x !== row.original.profile_id),
              );
            }}
            aria-label="Select row"
            className="translate-y-[2px]"
            data-testid="checkbox-select-staff"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    };

    const actionsColumn: ColumnDef<ProfileListItem> = {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const staff = row.original;
        const canDeleteStaff = staff.can_delete ?? false;
        const canEditStaff = staff.can_edit ?? false;
        return (
          <div className="flex items-center justify-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    if (!staff.profile_id) return;
                    window.open(
                      `/analytics/reports/p/${staff.profile_id}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                  disabled={!staff.profile_id}
                  data-testid="btn-preview-staff"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Report</p>
              </TooltipContent>
            </Tooltip>
            {canEditStaff && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      router.push(`/management/staff/p/${staff.profile_id}`);
                    }}
                    data-testid="btn-edit-staff"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Staff</p>
                </TooltipContent>
              </Tooltip>
            )}
            {canDeleteStaff && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeleteStaffMember(staff);
                      setShowSingleDeleteDialog(true);
                    }}
                    data-testid="btn-delete-staff"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Staff</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    const filtered = columns.filter(
      (c) => c.id !== "select" && c.id !== "actions",
    );
    return [checkboxColumn, ...filtered, actionsColumn];
  }, [columns, selectedStaffIds, router]);

  const table = useReactTable({
    data: staff,
    columns: columnsWithActions,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const sortingKey = JSON.stringify(sorting);
  const columnFiltersKey = JSON.stringify(columnFilters);
  const tableRows = useMemo(() => {
    return table.getRowModel().rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortingKey, columnFiltersKey, staff.length, pageIndex, pageSize]);

  // Toolbar state
  const isFiltered = table.getState().columnFilters.length > 0;
  const nameColumn = table.getColumn("name");
  const roleColumn = table.getColumn("role");
  const lastActiveColumn = table.getColumn("lastActive");
  const departmentIdsColumn = table.getColumn("department_ids");
  const selectedCount = selectedStaffIds.length;

  const filteredLastActiveOptions = useMemo(() => {
    if (!lastActiveColumn) return [];
    const facets = lastActiveColumn.getFacetedUniqueValues();
    if (!facets) return [];

    return lastActiveOptions.filter((option) => {
      const count = facets.get(option.value) || 0;
      return count > 0;
    });
  }, [lastActiveColumn, lastActiveOptions]);

  const deletableCount = useMemo(() => {
    return selectedStaffIds.filter((id) => {
      const row = staff.find((s) => s.profile_id === id);
      return row?.can_delete ?? false;
    }).length;
  }, [selectedStaffIds, staff]);

  return (
    <TooltipProvider>
      <div className="space-y-6" data-page="staff-index">
        {/* Header with summary stats - 5 KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <ActiveUsersKPI
            currentValue={counts.active}
            trendData={trendData["active"] || []}
          />
          <AdminUsersKPI
            currentValue={
              effectiveProfile?.role === "superadmin"
                ? (counts.superadmin || 0) + (counts.admin || 0)
                : counts.admin
            }
            trendData={trendData["admin"] || []}
          />
          <InstructionalUsersKPI
            currentValue={counts.instructional}
            trendData={trendData["instructional"] || []}
          />
          <TAUsersKPI
            currentValue={counts.member}
            trendData={trendData["member"] || []}
          />
          <TotalRequestsKPI
            currentValue={counts.totalRequests}
            trendData={trendData["total_requests"] || []}
          />
        </div>

        {/* Staff Data Table */}
        <div className="space-y-2">
          {/* Toolbar */}
          <div
            className="flex items-center justify-between"
            data-testid="staff-toolbar"
          >
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2 w-full md:w-auto">
                <Input
                  placeholder="Search staff by name or email..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  data-testid="staff-search"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                {/* Role Filter */}
                {roleColumn && roleOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={roleColumn}
                    title="Role"
                    options={roleOptions}
                  />
                )}

                {/* Last Active Filter */}
                {lastActiveColumn && filteredLastActiveOptions.length > 0 && (
                  <DataTableFacetedFilter
                    column={lastActiveColumn}
                    title="Last Active"
                    options={filteredLastActiveOptions}
                  />
                )}

                {/* Departments Filter */}
                {departmentIdsColumn && profileDepartmentIds.length > 1 && (
                  <DataTableFacetedFilter
                    column={departmentIdsColumn}
                    title="Department"
                    options={departments
                      .filter((dept) => dept.department_id && dept.name)
                      .map((dept) => ({
                        value: dept.department_id!,
                        label: dept.name!,
                      }))}
                  />
                )}

                {isFiltered && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => table.resetColumnFilters()}
                    className="h-8 px-2 lg:px-3 hidden md:flex"
                  >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 mb-2">
              {/* CSV Import Button */}
              {selectedCount === 0 && processCSVAction && (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={!initialCreateStaffData}
                  onClick={() => setShowCSVImportModal(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  CSV Import
                </Button>
              )}

              {/* Bulk delete if any selected */}
              {selectedCount > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  className="h-8"
                  data-testid="btn-bulk-delete-staff"
                  disabled={deletableCount === 0}
                >
                  Delete {deletableCount} of {selectedCount}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>

              <DataTableViewOptions
                table={table}
                hiddenColumns={["cohort_ids"]}
              />
            </div>
          </div>

          {/* Table */}
          <div
            className="rounded-md border overflow-x-auto"
            data-testid="staff-table"
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      if (!header.column.getIsVisible()) return null;

                      return (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={`border-r py-2 text-xs text-center ${
                            header.id === "select" ? "w-12" : ""
                          } ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none pl-4"
                              : ""
                          }`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tableRows?.length ? (
                  tableRows.map((row: (typeof tableRows)[number]) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid="staff-row"
                      data-profile-id={row.original.profile_id}
                    >
                      {row
                        .getVisibleCells()
                        .map(
                          (
                            cell: ReturnType<
                              typeof row.getVisibleCells
                            >[number],
                          ) => (
                            <TableCell
                              key={cell.id}
                              className="border-r px-3 py-2 text-center"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ),
                        )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columnsWithActions.length}
                      className="h-24 text-center px-6"
                    >
                      No staff members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} staff={true} />
        </div>

        {/* CSV Import Modal */}
        {showCSVImportModal && (
          <Dialog
            open={showCSVImportModal}
            onOpenChange={setShowCSVImportModal}
          >
            <DialogContent
              className="max-w-5xl max-h-[90vh] overflow-y-auto"
              data-testid="csv-upload-modal"
            >
              <DialogHeader>
                <DialogTitle>Import Staff from CSV</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Stage indicator */}
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        csvStage === "upload"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {csvStage === "upload" ? (
                        <FileUp className="h-4 w-4" />
                      ) : (
                        "1"
                      )}
                    </div>
                    <span
                      className={csvStage === "upload" ? "font-medium" : ""}
                    >
                      Upload
                    </span>
                  </div>
                  <div className="h-1 w-16 bg-muted" />
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        csvStage === "mapping"
                          ? "bg-primary text-primary-foreground"
                          : csvStage === "review"
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {csvStage === "mapping" ? (
                        <Map className="h-4 w-4" />
                      ) : (
                        "2"
                      )}
                    </div>
                    <span
                      className={csvStage === "mapping" ? "font-medium" : ""}
                    >
                      Mapping
                    </span>
                  </div>
                  <div className="h-1 w-16 bg-muted" />
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        csvStage === "review"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {csvStage === "review" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        "3"
                      )}
                    </div>
                    <span
                      className={csvStage === "review" ? "font-medium" : ""}
                    >
                      Review
                    </span>
                  </div>
                </div>

                {/* Stage 1: Upload */}
                {csvStage === "upload" && (
                  <div
                    className="space-y-6"
                    data-testid="csv-upload-stage-upload"
                  >
                    <div
                      {...getRootProps()}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-16 text-center transition-colors cursor-pointer relative",
                        isDragActive
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50",
                      )}
                    >
                      <input
                        {...getInputProps()}
                        data-testid="csv-file-input"
                      />
                      <div className="absolute top-4 right-4">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadTemplate();
                          }}
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download Template
                        </Button>
                      </div>
                      <div className="space-y-3">
                        <p className="text-muted-foreground">
                          Upload your .csv file or{" "}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFileDialog();
                            }}
                            className="text-primary hover:underline font-medium"
                          >
                            browse
                          </button>
                        </p>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            <span className="font-medium">Required:</span>{" "}
                            {csvRequirements.required.join(", ")}
                          </p>
                          {csvRequirements.optional.length > 0 && (
                            <p>
                              <span className="font-medium">Optional:</span>{" "}
                              {csvRequirements.optional.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`flex items-center pt-4 border-t ${
                        csvHeaders.length > 0
                          ? "justify-between"
                          : "justify-end"
                      }`}
                    >
                      {csvHeaders.length > 0 ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setShowCSVImportModal(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              setCsvStage("mapping");
                            }}
                          >
                            Next
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setShowCSVImportModal(false)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Stage 2: Mapping */}
                {csvStage === "mapping" && (
                  <div
                    className="space-y-4"
                    data-testid="csv-upload-stage-mapping"
                  >
                    <div
                      className="rounded-md border"
                      data-testid="csv-column-mapping-table"
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">
                              Your File Column
                            </TableHead>
                            <TableHead className="w-[200px]">
                              Your Sample Data
                            </TableHead>
                            <TableHead>Destination Column</TableHead>
                            <TableHead className="w-[100px] text-center">
                              Include
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvHeaders.map((header) => {
                            const mapping = columnMappings.find(
                              (m) => m.csv_column === header,
                            );
                            const targetField = mapping?.target_field || null;
                            const sampleData = csvRows[0]?.[header] || "";
                            const truncatedSample =
                              sampleData.length > 30
                                ? `${sampleData.substring(0, 30)}...`
                                : sampleData;
                            const isIncluded =
                              includedColumns[header] !== false;

                            return (
                              <TableRow
                                key={header}
                                data-testid={`csv-column-mapping-${header}`}
                              >
                                <TableCell className="font-medium">
                                  {header}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                  {truncatedSample || "-"}
                                </TableCell>
                                <TableCell>
                                  <ColumnPicker
                                    value={targetField}
                                    onValueChange={(newValue) => {
                                      setColumnMappings((prev) =>
                                        prev.map((m) =>
                                          m.csv_column === header
                                            ? { ...m, target_field: newValue }
                                            : m,
                                        ),
                                      );
                                    }}
                                    availableFields={availableTargetFields}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={isIncluded}
                                    onCheckedChange={(checked) => {
                                      setIncludedColumns((prev) => ({
                                        ...prev,
                                        [header]: checked === true,
                                      }));
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCsvStage("upload")}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleProcessCSV}
                        disabled={isProcessing}
                      >
                        {isProcessing ? "Processing..." : "Continue to Review"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stage 3: Review */}
                {csvStage === "review" && (
                  <div
                    className="space-y-4"
                    data-testid="csv-upload-stage-review"
                  >
                    <div className="flex items-center justify-between">
                      {hasErrors && (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={showErrorRows}
                              onCheckedChange={setShowErrorRows}
                              id="show-errors"
                            />
                            <Label
                              htmlFor="show-errors"
                              className="text-sm font-normal cursor-pointer"
                            >
                              Show rows with errors
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className="rounded-md border max-h-96 overflow-auto"
                      data-testid="csv-review-table"
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>First Name</TableHead>
                            <TableHead>Last Name</TableHead>
                            <TableHead>Alias</TableHead>
                            <TableHead>Role</TableHead>
                            {validDepartmentIdsForCSV.length > 1 && (
                              <TableHead>Department</TableHead>
                            )}
                            <TableHead>Cohort</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {processedRows
                            .filter((row, index) => {
                              const editableRow = editableRows[index] || row;
                              const hasRowErrors =
                                (editableRow.errors?.length ?? 0) > 0;
                              if (!showErrorRows && hasRowErrors) {
                                return false;
                              }
                              return true;
                            })
                            .map((row, index) => {
                              const editableRow = editableRows[index] || row;
                              const errors = editableRow.errors ?? [];
                              const hasFirstNameError = errors.some(
                                (e) => e.field === "first_name",  // snake_case
                              );
                              const hasLastNameError = errors.some(
                                (e) => e.field === "last_name",  // snake_case
                              );
                              const hasAliasError = errors.some(
                                (e) => e.field === "email",
                              );
                              const hasDuplicateAlias =
                                duplicateAliasMap.has(index);
                              const hasRoleError = errors.some(
                                (e) => e.field === "role",
                              );
                              const hasDepartmentError =
                                validDepartmentIdsForCSV.length > 1 &&
                                errors.some(
                                  (e) =>
                                    e.field === "department_ids" ||
                                    e.field === "department_id",
                                );
                              const hasCohortError = errors.some(
                                (e) =>
                                  e.field === "cohort_ids" ||
                                  e.field === "cohort_id",
                              );

                              return (
                                <TableRow
                                  key={index}
                                  data-testid={`csv-review-row-${index}`}
                                >
                                  <TableCell>{row.row_index}</TableCell>
                                  <TableCell
                                    className={
                                      hasFirstNameError
                                        ? "bg-destructive/10"
                                        : ""
                                    }
                                  >
                                    <Input
                                      value={editableRow.first_name || ""}  // snake_case
                                      onChange={(e) =>
                                        updateEditableRow(
                                          index,
                                          "first_name",  // snake_case
                                          e.target.value || null,
                                        )
                                      }
                                      className="h-8 w-full min-w-[120px]"
                                    />
                                  </TableCell>
                                  <TableCell
                                    className={
                                      hasLastNameError
                                        ? "bg-destructive/10"
                                        : ""
                                    }
                                  >
                                    <Input
                                      value={editableRow.last_name || ""}  // snake_case
                                      onChange={(e) =>
                                        updateEditableRow(
                                          index,
                                          "last_name",  // snake_case
                                          e.target.value || null,
                                        )
                                      }
                                      className="h-8 w-full min-w-[120px]"
                                    />
                                  </TableCell>
                                  <TableCell
                                    className={
                                      hasAliasError || hasDuplicateAlias
                                        ? "bg-destructive/10"
                                        : ""
                                    }
                                  >
                                    <Input
                                      value={
                                        (editableRow.emails || []).join(", ") ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        updateEditableRow(
                                          index,
                                          "emails",
                                          e.target.value || "",
                                        )
                                      }
                                      placeholder="redacted@purdue.edu, redacted@purdue.edu"
                                      className="h-8 w-full min-w-[120px]"
                                    />
                                  </TableCell>
                                  <TableCell
                                    className={
                                      hasRoleError ? "bg-destructive/10" : ""
                                    }
                                  >
                                    <GenericPicker
                                      items={STAFF_ROLES.filter((r) =>
                                        validRoles.includes(r.id),
                                      )}
                                      selectedIds={
                                        editableRow.role
                                          ? [editableRow.role]
                                          : []
                                      }
                                      onSelect={(ids) =>
                                        updateEditableRow(
                                          index,
                                          "role",
                                          ids[0] || null,
                                        )
                                      }
                                      getId={(role) => role.id}
                                      getLabel={(role) => role.name}
                                      getSearchText={(role) =>
                                        `${role.name} ${role.description || ""}`
                                      }
                                      renderItem={(role, isSelected) => {
                                        const IconComponent =
                                          role.icon || UserIcon;
                                        const hexColor =
                                          role.color || "#64748b";
                                        const generateGradient = (
                                          hex: string,
                                        ) => {
                                          const cleanHex = hex.replace("#", "");
                                          const r = parseInt(
                                            cleanHex.substr(0, 2),
                                            16,
                                          );
                                          const g = parseInt(
                                            cleanHex.substr(2, 2),
                                            16,
                                          );
                                          const b = parseInt(
                                            cleanHex.substr(4, 2),
                                            16,
                                          );
                                          const lighterR = Math.min(
                                            255,
                                            r + 60,
                                          );
                                          const lighterG = Math.min(
                                            255,
                                            g + 60,
                                          );
                                          const lighterB = Math.min(
                                            255,
                                            b + 60,
                                          );
                                          const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                                          return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                                        };
                                        return (
                                          <div className="flex items-center gap-3 w-full">
                                            <div
                                              className="p-2 rounded-lg shadow-lg flex-shrink-0"
                                              style={{
                                                background:
                                                  generateGradient(hexColor),
                                              }}
                                            >
                                              <IconComponent className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium truncate">
                                                {role.name}
                                              </div>
                                              {role.description && (
                                                <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                                  {role.description}
                                                </div>
                                              )}
                                            </div>
                                            <Check
                                              className={cn(
                                                "ml-auto",
                                                isSelected
                                                  ? "opacity-100"
                                                  : "opacity-0",
                                              )}
                                            />
                                          </div>
                                        );
                                      }}
                                      renderButton={(selectedItems) => {
                                        if (selectedItems.length === 0)
                                          return "Select role...";
                                        const role = selectedItems[0];
                                        const IconComponent =
                                          role?.icon || UserIcon;
                                        const hexColor =
                                          role?.color || "#64748b";
                                        const generateGradient = (
                                          hex: string,
                                        ) => {
                                          const cleanHex = hex.replace("#", "");
                                          const r = parseInt(
                                            cleanHex.substr(0, 2),
                                            16,
                                          );
                                          const g = parseInt(
                                            cleanHex.substr(2, 2),
                                            16,
                                          );
                                          const b = parseInt(
                                            cleanHex.substr(4, 2),
                                            16,
                                          );
                                          const lighterR = Math.min(
                                            255,
                                            r + 60,
                                          );
                                          const lighterG = Math.min(
                                            255,
                                            g + 60,
                                          );
                                          const lighterB = Math.min(
                                            255,
                                            b + 60,
                                          );
                                          const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                                          return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                                        };
                                        return (
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div
                                              className="p-1 rounded-md shadow-sm flex-shrink-0"
                                              style={{
                                                background:
                                                  generateGradient(hexColor),
                                              }}
                                            >
                                              <IconComponent className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <span className="truncate">
                                              {role?.name || "Select role"}
                                            </span>
                                          </div>
                                        );
                                      }}
                                      placeholder="Select role"
                                      multiSelect={false}
                                      hideSelectedChips={true}
                                      buttonClassName="h-8"
                                      groupHeading="Staff Roles"
                                    />
                                  </TableCell>
                                  {validDepartmentIdsForCSV.length > 1 && (
                                    <TableCell
                                      className={
                                        hasDepartmentError
                                          ? "bg-destructive/10"
                                          : ""
                                      }
                                    >
                                      <GenericPicker
                                        items={departmentMappingForCSV}
                                        itemIds={validDepartmentIdsForCSV}
                                        selectedIds={
                                          (editableRow.department_ids ||
                                            row.department_ids ||
                                            []) as string[]
                                        }
                                        onSelect={(ids) =>
                                          updateEditableRow(
                                            index,
                                            "department_ids",
                                            ids,
                                          )
                                        }
                                        getId={(dept) =>
                                          (dept as unknown as { id: string }).id
                                        }
                                        getLabel={(dept) => dept.name || ""}
                                        getSearchText={(dept) =>
                                          `${dept.name} ${dept.description || ""}`
                                        }
                                        placeholder="Select departments"
                                        multiSelect={true}
                                        compact={true}
                                        hideSelectedChips={true}
                                      />
                                    </TableCell>
                                  )}
                                  <TableCell
                                    className={
                                      hasCohortError ? "bg-destructive/10" : ""
                                    }
                                  >
                                    <GenericPicker
                                      items={cohortMappingForCSV}
                                      itemIds={validCohortIdsForCSV}
                                      selectedIds={
                                        (editableRow.cohort_ids ||
                                          row.cohort_ids ||
                                          []) as string[]
                                      }
                                      onSelect={(ids) =>
                                        updateEditableRow(
                                          index,
                                          "cohort_ids",
                                          ids,
                                        )
                                      }
                                      getId={(cohort) =>
                                        (cohort as unknown as { id: string }).id
                                      }
                                      getLabel={(cohort) => cohort.name || ""}
                                      getSearchText={(cohort) =>
                                        `${cohort.name} ${cohort.description || ""}`
                                      }
                                      placeholder="Select cohorts"
                                      multiSelect={true}
                                      hideSelectedChips={true}
                                      compact={true}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setCsvStage("mapping")}
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleCSVSubmit}
                        disabled={isSubmitting || validRowCount === 0}
                        data-testid="csv-submit-button"
                      >
                        {isSubmitting
                          ? "Processing..."
                          : `Import ${validRowCount} Staff Member(s)`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Bulk Delete Confirmation */}
        <AlertDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
        >
          <AlertDialogContent data-testid="dialog-bulk-delete-staff">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedStaffIds.length} staff member
                {selectedStaffIds.length !== 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the selected accounts. Default
                profiles and your own account will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {(() => {
              const selected = staff.filter((s) =>
                s.profile_id && selectedStaffIds.includes(s.profile_id),
              );
              const nonDeletable = selected.filter((s) => !s.can_delete);
              const deletable = selected.filter((s) => s.can_delete);
              const impactedCohorts = deletable.map((s) => ({
                staff: s,
                cohortCount: (s.cohort_ids?.length ?? 0),
              }));
              return (
                <div className="space-y-3">
                  {deletable.length > 0 && (
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        The following accounts and their cohort memberships will
                        be removed:
                      </p>
                      <div className="mt-1 ml-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <ul className="text-sm space-y-2">
                          {impactedCohorts.map(({ staff, cohortCount }) => (
                            <li
                              key={staff.profile_id ?? `staff-${cohortCount}`}
                              className="text-red-600 dark:text-red-300"
                            >
                              • {staff.first_name} {staff.last_name} (
                              {staff.primary_email ||
                                (staff.emails && staff.emails.length > 0
                                  ? staff.emails[0]
                                  : "")}
                              ){" "}
                              {cohortCount > 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  – affects {cohortCount} cohort
                                  {cohortCount > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  – no cohort memberships
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {nonDeletable.length > 0 && (
                    <div>
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">
                        The following accounts cannot be deleted and will be
                        skipped:
                      </p>
                      <div className="mt-1 ml-4 max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <ul className="text-sm space-y-1">
                          {nonDeletable.map((s) => (
                            <li
                              key={s.profile_id}
                              className="text-yellow-700 dark:text-yellow-300"
                            >
                              • {s.first_name} {s.last_name} (
                              {s.primary_email ||
                                (s.emails && s.emails.length > 0
                                  ? s.emails[0]
                                  : "")}
                              )
                              {s.profile_id === effectiveProfile?.id
                                ? " – your account"
                                : " – cannot delete"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                data-testid="btn-confirm-delete"
                onClick={async () => {
                  try {
                    const deletableIds = staff
                      .filter(
                        (s) =>
                          s.profile_id &&
                          selectedStaffIds.includes(s.profile_id) &&
                          s.can_delete,
                      )
                      .map((s) => s.profile_id!)
                      .filter((id): id is string => id !== null);
                    if (deletableIds.length === 0) {
                      setShowBulkDeleteDialog(false);
                      return;
                    }
                    if (!bulkDeleteStaffAction) return;
                    await bulkDeleteStaffAction({
                      body: { profile_ids: deletableIds },
                    });
                    router.refresh();
                    toast.success("Selected staff deleted");
                    setSelectedStaffIds([]);
                    setShowBulkDeleteDialog(false);
                  } catch {
                    toast.error("Failed to delete selected staff");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Single Delete Confirmation */}
        <AlertDialog
          open={showSingleDeleteDialog}
          onOpenChange={setShowSingleDeleteDialog}
        >
          <AlertDialogContent data-testid="dialog-delete-staff">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {deleteStaffMember?.first_name}{" "}
                {deleteStaffMember?.last_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the account. Default profiles and
                your own account cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteStaffMember &&
              (() => {
                const staffMember = deleteStaffMember;
                const canDelete = staffMember.can_delete;
                const cohortCount = (staffMember.cohort_ids?.length ?? 0);

                if (!canDelete) {
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-yellow-700 dark:text-yellow-400">
                          This account cannot be deleted:
                        </p>
                        <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            • {staffMember.first_name} {staffMember.last_name} (
                            {staffMember.primary_email ||
                              (staffMember.emails &&
                              staffMember.emails.length > 0
                                ? staffMember.emails[0]
                                : "")}
                            )
                            {staffMember.profile_id === effectiveProfile?.id
                              ? " – your account"
                              : " – cannot delete"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        The following account and its cohort memberships will be
                        removed:
                      </p>
                      <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <ul className="text-sm space-y-2">
                          <li className="text-red-600 dark:text-red-300">
                            • {staffMember.first_name} {staffMember.last_name} (
                            {staffMember.primary_email ||
                              (staffMember.emails &&
                              staffMember.emails.length > 0
                                ? staffMember.emails[0]
                                : "")}
                            ){" "}
                            {cohortCount > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                – affects {cohortCount} cohort
                                {cohortCount > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                – no cohort memberships
                              </span>
                            )}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                data-testid="btn-confirm-delete"
                onClick={async () => {
                  if (!deleteStaffMember) return;

                  if (!deleteStaffMember.can_delete) {
                    toast.error("This user cannot be deleted");
                    setShowSingleDeleteDialog(false);
                    setDeleteStaffMember(null);
                    return;
                  }

                  if (!deleteStaffMember.profile_id) {
                    toast.error("Invalid user profile ID");
                    setShowSingleDeleteDialog(false);
                    setDeleteStaffMember(null);
                    return;
                  }

                  try {
                    if (!deleteStaffAction) return;
                    if (!effectiveProfile?.id) {
                      toast.error("Profile ID is required");
                      return;
                    }
                    await deleteStaffAction({
                      body: { 
                        target_profile_id: deleteStaffMember.profile_id,
                        current_profile_id: effectiveProfile.id,
                      },
                    });
                    router.refresh();
                    toast.success("User deleted successfully");
                    setShowSingleDeleteDialog(false);
                    setDeleteStaffMember(null);
                  } catch {
                    toast.error("Failed to delete user");
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
