/**
 * Profiles.tsx
 * Used to display the profiles page with faceted filters and data table.
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
import { parseAsArrayOf, parseAsBoolean, parseAsString, useQueryState } from "nuqs";
import React, { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

// UI Components
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  PROFILE_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/profile-roles";
import { BulkDeleteDialog } from "@/components/common/forms/BulkDeleteDialog";
import { BulkEditDialog } from "@/components/common/forms/BulkEditDialog";
import { BulkEditFlagField } from "@/components/common/forms/BulkEditFlagField";
import { DataTableColumnHeader } from "@/components/common/table/DataTableColumnHeader";
import { DataTablePagination } from "@/components/common/table/DataTablePagination";
import { DataTableViewOptions } from "@/components/common/table/DataTableViewOptions";
import { ThreePickerFilters } from "@/components/common/table/ThreePickerFilters";
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
import { useArtifactGhosts } from "@/hooks/use-artifact-ghosts";
import { useProfileAi } from "@/hooks/use-profile-ai";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import { SvgIcon } from "@/components/common/SvgIcon";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  Edit,
  Eye,
  FileUp,
  Map,
  Pencil,
  Play,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";

// Import types from page (all types are already exported from the page)
import type {
  BulkDeleteProfileIn,
  BulkDeleteProfileOut,
  CSVColumnMapping,
  DeleteProfileIn,
  DeleteProfileOut,
  EmulateProfileActionIn,
  EmulateProfileActionOut,
  GetProfileOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProcessedCSVRow,
  ProfileListItem,
  ProfilesListBody,
  SearchProfileIn,
  SearchProfileOut,
  ProfilesListOut,
  UpdateProfileIn,
  UpdateProfileOut,
} from "@/app/(main)/management/profiles/page";

// Explicitly define server action types (matching the page exports)
export type DeleteProfileAction = (
  input: DeleteProfileIn
) => Promise<DeleteProfileOut>;
export type BulkDeleteProfileAction = (
  input: BulkDeleteProfileIn
) => Promise<BulkDeleteProfileOut>;
export type UpdateProfileAction = (
  input: UpdateProfileIn
) => Promise<UpdateProfileOut>;
export type SearchProfileAction = (
  input: SearchProfileIn
) => Promise<SearchProfileOut>;
export type ProcessCSVAction = (input: ProcessCSVIn) => Promise<ProcessCSVOut>;
export type EmulateProfileAction = (
  input: EmulateProfileActionIn
) => Promise<EmulateProfileActionOut>;
export interface ProfilesProps {
  // Server-provided data (fetched server-side, no client fetching)
  listData: ProfilesListOut;
  initialCreateProfileData?: GetProfileOut;
  // SSR column visibility from cookie
  initialColumnVisibility?: VisibilityState;
  // Server actions (pure server actions, no client-side mutations)
  deleteProfileAction?: DeleteProfileAction;
  bulkDeleteProfileAction?: BulkDeleteProfileAction;
  updateProfileAction?: UpdateProfileAction;
  processCSVAction?: ProcessCSVAction;
  emulateProfileAction?: EmulateProfileAction;
  unemulateProfileAction?: EmulateProfileAction;
  /** The body the page used for its SSR ``/profile/search`` call.
   *  Forwarded as the filter fields on bulk delete/update calls when
   *  the user is in ``selectAll=1`` mode — the server resolves matching
   *  rows directly, no client-side enumeration. */
  currentSearchBody?: ProfilesListBody;
}

const PROFILES_INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  name: true,
  search: false,
  department_ids: true,
  permission_ids: false,
};

// Helper functions
const getInitials = (name: string): string => {
  if (!name) return "??";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("");
  return initials.slice(0, 2).toUpperCase() || "??";
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

const getRoleDisplayName = (role: string, roleName?: string | null): string => {
  if (roleName) return roleName;
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

// CSV Import constants and helpers
type CSVStage = "upload" | "mapping" | "review";

const TARGET_FIELDS = [
  {
    value: "name", // snake_case
    label: "Name",
    description: "The profile's full name",
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
    description: "Profile role (instructional, ta, guest, admin, etc.)",
    required: false,
  },
  {
    value: "department",
    label: "Department",
    description: "Department assignment (optional if scoped)",
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
        .join(",")
    ),
  ];
  return csvContent.join("\n");
};

const autoMapColumn = (columnName: string): string | null => {
  const lower = columnName.toLowerCase().trim();
  if (["name", "full name", "fullname", "full_name"].includes(lower)) {
    return "name"; // snake_case
  }
  if (
    ["email", "alias", "username", "user", "login", "email address"].includes(
      lower
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
                        value === field.value ? "opacity-100" : "opacity-0"
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

export default function Profiles({
  listData: serverListData,
  initialCreateProfileData,
  initialColumnVisibility,
  deleteProfileAction,
  bulkDeleteProfileAction,
  updateProfileAction,
  processCSVAction,
  emulateProfileAction,
  unemulateProfileAction,
  currentSearchBody,
}: ProfilesProps) {
  const router = useRouter();
  const {
    profile,
    roleResources,
  } = useProfile();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useProfileAi({
    onComplete: () => router.refresh(),
  });

  // Selection state — URL-backed so it survives refresh and is
  // craftable as a shareable / LLM-generated link. Three params model
  // the full state machine:
  //
  //   - ``selectedIds=A,B``        → explicit selection of named rows
  //   - ``selectAll=1``            → every row matching the active
  //                                  filters/search is selected
  //   - ``selectAll=1&excludedIds=X``
  //                                → all-matching minus exclusions
  //   - (none of the above)        → empty selection
  //
  // The all-matching mode keeps the URL compact for huge datasets
  // (one boolean instead of N ids) and follows the active filter —
  // change the filter and "all matching" follows naturally. Shallow
  // updates avoid the RSC re-fetch burst.
  const [selectedProfileIds, setSelectedProfileIds] = useQueryState(
    "selectedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );
  const [selectAllMatching, setSelectAllMatching] = useQueryState(
    "selectAll",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  const [excludedProfileIds, setExcludedProfileIds] = useQueryState(
    "excludedIds",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({ shallow: true }),
  );

  // Bulk delete dialog
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk edit dialog
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkEditActiveStatus, setBulkEditActiveStatus] = useState<boolean | null>(null);

  // Single delete dialog
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] = useState(false);
  const [deleteProfileMember, setDeleteProfileMember] =
    useState<ProfileListItem | null>(null);

  // Emulation state
  const [emulatingProfileId, setEmulatingProfileId] = useState<string | null>(null);

  const handleEmulate = useCallback(
    async (profileId: string) => {
      if (!emulateProfileAction) return;
      setEmulatingProfileId(profileId);
      try {
        const result = await emulateProfileAction({ targetProfileId: profileId });
        if (!result.ok) {
          toast.error(result.reason || "Emulation not allowed");
          return;
        }
        toast.success("Emulating profile...");
        window.location.reload();
      } catch {
        toast.error("Failed to emulate profile");
      } finally {
        setEmulatingProfileId(null);
      }
    },
    [emulateProfileAction]
  );

  const handleUnemulate = useCallback(
    async (profileId: string) => {
      if (!unemulateProfileAction) return;
      setEmulatingProfileId(profileId);
      try {
        const result = await unemulateProfileAction({ targetProfileId: profileId });
        if (!result.ok) {
          toast.error(result.reason || "Failed to exit emulation");
          return;
        }
        toast.success("Exiting emulation...");
        window.location.reload();
      } catch {
        toast.error("Failed to exit emulation");
      } finally {
        setEmulatingProfileId(null);
      }
    },
    [unemulateProfileAction]
  );

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
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "profiles",
    initialColumnVisibility ?? PROFILES_INITIAL_COLUMN_VISIBILITY,
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  // SSR-seeded base list. The audit-driven ghost hook layers
  // create/update/delete/duplicate lifecycle on top — committed rows
  // get merged into ``mergedProfiles`` directly so the table stays
  // current without a ``router.refresh()`` (which would re-burst the
  // page's SSR fetches — see GenerationPanel handleSend rationale).
  const baseProfiles = useMemo(
    () => serverListData?.profiles || [],
    [serverListData?.profiles]
  );

  const { mergedRows: mergedProfiles } = useArtifactGhosts({
    artifactType: "profile",
    // All four CRUD ops the LLM might invoke or the user might trigger
    // from the toolbar. Each emits audit events that the hook overlays
    // onto ``baseRows``. Without ``duplicate`` here the LLM's duplicate
    // tool dispatch fires audit events that nothing is subscribed to.
    ops: ["create", "update", "delete", "duplicate"],
    baseRows: baseProfiles,
    rowKey: "profile_id",
    // ``profiles`` plural matches the field name the create / duplicate
    // / update impls now include on their responses (see
    // ``hydrate_profile_list_rows``). The hook reads ``output.profiles``
    // from the audit ``.completed`` payload to materialize new/changed
    // rows directly — no SSR refresh needed.
    artifactPlural: "profiles",
  });

  // Downstream code reads ``profiles`` — keep that name to minimize
  // diff. The active list is the merged view (base + create overlays
  // − delete overlays).
  const profiles = mergedProfiles;

  const departments = useMemo(
    () =>
      (serverListData?.department_filter?.options || []).map((opt) => ({
        department_id: opt.id,
        name: opt.name,
      })),
    [serverListData?.department_filter],
  );
  // Refresh data by revalidating server-side data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
      toast.success("Profile data refreshed");
    } catch {
      toast.error("Failed to refresh profile data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Use server-provided filter options directly (ListFilterSection pattern)
  const departmentOptions = useMemo(
    () =>
      (serverListData?.department_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [serverListData?.department_filter],
  );
  const roleOptions = useMemo(
    () =>
      (serverListData?.role_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [serverListData?.role_filter],
  );
  const permissionsOptions = useMemo(
    () =>
      (serverListData?.permissions_filter?.options || [])
        .map((opt) => ({
          value: opt.id as string,
          label: opt.name as string,
          count: opt.count ?? 0,
        }))
        .filter((opt) => opt.value && opt.label),
    [serverListData?.permissions_filter],
  );

  // Transform mappings for CSV import
  const departmentMappingForCSV = useMemo(() => {
    const createProfileData = initialCreateProfileData;
    const mapping: Record<string, { name: string; description: string }> = {};
    if (
      createProfileData &&
      "departments" in createProfileData &&
      Array.isArray(createProfileData.departments)
    ) {
      createProfileData.departments.forEach((dept) => {
        if (dept && dept.department_id) {
          mapping[dept.department_id] = {
            name: dept.name ?? "",
            description: dept.description ?? "",
          };
        }
      });
    }
    return mapping;
  }, [initialCreateProfileData]);

  const validDepartmentIdsForCSV = useMemo(
    () => Object.keys(departmentMappingForCSV),
    [departmentMappingForCSV]
  );
  const roleOptionsForCSV = useMemo(
    () => initialCreateProfileData?.role_options || [],
    [initialCreateProfileData]
  );
  const roleResourcesForCSV = useMemo(() => {
    const baseRoles =
      initialCreateProfileData?.roles && initialCreateProfileData.roles.length > 0
        ? initialCreateProfileData.roles
        : roleResources || [];
    return (
      baseRoles
        ?.filter((role) => role?.role)
        .map((role) => {
          return {
            id: role.role ?? "",
            name: role.name ?? role.role ?? "Role",
            description: role.description ?? "",
            iconSvg: role.icon ?? role.icon_value ?? null,
            icon: UserIcon,
            color: role.color_hex ?? "#64748b",
          };
        }) ?? []
    );
  }, [initialCreateProfileData, roleResources]);

  // CSV Import logic
  const validRoles = useMemo(() => {
    const roleOrder = ["member", "instructional", "admin", "superadmin", "custom"];
    return roleOrder.filter((role) => roleOptionsForCSV.includes(role));
  }, [roleOptionsForCSV]);

  const availableTargetFields = useMemo(() => {
    return [...TARGET_FIELDS];
  }, []);

  const csvRequirements = useMemo(() => {
    return {
      required: ["First Name", "Last Name", "Email"],
      optional: ["Role", "Department"],
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
    [processedRows]
  );

  React.useEffect(() => {
    if (hasErrors) {
      setShowErrorRows(true);
    }
  }, [hasErrors]);

  const parseCSV = useCallback(
    (
      csvText: string
    ): { headers: string[]; rows: Record<string, string>[] } => {
      // Strip BOM character that Excel adds to CSV exports
      const cleanText = csvText.replace(/^\ufeff/, "");
      const lines = cleanText.split("\n").filter((line) => line.trim());
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const stripQuotes = (val: string): string => {
        const trimmed = val.trim();
        if (
          trimmed.length >= 2 &&
          trimmed.startsWith('"') &&
          trimmed.endsWith('"')
        ) {
          return trimmed.slice(1, -1).replace(/""/g, '"');
        }
        return trimmed;
      };

      const headers = lines[0]!.split(",").map((h) => stripQuotes(h));
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line?.trim()) continue;

        const values = line.split(",").map((v) => stripQuotes(v));
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        rows.push(row);
      }

      return { headers, rows };
    },
    []
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

          const requiredFields = ["name", "email"]; // snake_case
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
            `Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
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
        name: "Sarah Johnson", // snake_case
        email: "redacted@purdue.edu",
        role: "instructional",
        department: "",
      },
      {
        name: "Jane Smith", // snake_case
        email: "redacted@purdue.edu",
        role: "instructional",
        department: "",
      },
      {
        name: "John Doe", // snake_case
        email: "redacted@purdue.edu",
        role: "member",
        department: "",
      },
    ];

    const csv = unparseCSV(template);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "profiles_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleProcessCSV = useCallback(async () => {
    const activeMappings = columnMappings.filter(
      (m) => m.csv_column && includedColumns[m.csv_column] !== false
    );

    const requiredFields = ["name", "email"];
    const mappedFields = activeMappings
      .map((m) => m.target_field)
      .filter((f): f is string => f !== null);

    const missingFields = requiredFields.filter(
      (field) => !mappedFields.includes(field)
    );
    if (missingFields.length > 0) {
      toast.error(
        `Please map the following required fields: ${missingFields.join(", ")}`
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

        if (field === "department_ids") {
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
    [processedRows]
  );

  const handleCSVSubmit = useCallback(async () => {
    const finalRows = processedRows.map((row, index) => {
      return editableRows[index] || row;
    });

    const validRows = finalRows.filter(
      (row) => (row.errors?.length ?? 0) === 0
    );

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
          `Allowed roles: ${validRoles.join(", ")}`
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
        `Duplicate emails found in CSV: ${duplicateEmails.join(", ")}`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const _profiles = validRows.map((row) => {
        const rowDeptIds = row.department_ids || [];
        const deptIds = rowDeptIds
          .map((deptIdOrName) => {
            if (validDepartmentIdsForCSV.includes(deptIdOrName)) {
              return deptIdOrName;
            }
            const found = Object.entries(departmentMappingForCSV).find(
              ([_, dept]) =>
                dept.name.toLowerCase() === deptIdOrName.toLowerCase()
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
          name: row.name ?? "", // snake_case
          emails: emails,
          primary_email_index:
            row.primary_email_index !== null &&
            row.primary_email_index !== undefined &&
            row.primary_email_index < emails.length
              ? row.primary_email_index
              : 0,
          role: row.role ?? "member",
          active: true, // Default to active for new profile
          department_ids: deptIds,
        };
      });

      toast.error("Bulk create or update is no longer available. Please use individual profile create/update instead.");
      return;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create or update profiles.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    processedRows,
    editableRows,
    departmentMappingForCSV,
    validDepartmentIdsForCSV,
    validRoles,
  ]);

  const validRowCount = processedRows.filter(
    (row) => (row.errors?.length ?? 0) === 0
  ).length;

  // Table columns definition
  const columns = useMemo<ColumnDef<ProfileListItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Profile" />
        ),
        cell: ({ row }) => {
          const profile = row.original;
          return (
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                style={{ outlineWidth: "1px", outlineStyle: "solid" }}
              >
                {getInitials(profile.name ?? "")}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {profile.name}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {profile.emails && profile.emails.length > 0
                    ? profile.emails.join(", ")
                    : profile.primary_email || "No email"}
                </p>
              </div>
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value): boolean => {
          const profile = row.original;
          if (!value) return true;
          const valueLower = String(value).toLowerCase();
          const emails = profile.emails || [];
          const emailMatch =
            emails.some((e) => e.toLowerCase().includes(valueLower)) ||
            (profile.primary_email !== null &&
              profile.primary_email.toLowerCase().includes(valueLower));
          return Boolean(
            (profile.name ?? "").toLowerCase().includes(valueLower) ||
              emailMatch
          );
        },
      },
      {
        id: "search",
        accessorFn: (row: ProfileListItem) => {
          const emails =
            row.emails && row.emails.length > 0
              ? row.emails.join(" ")
              : row.primary_email || "";
          return `${row.name} ${emails}`.toLowerCase();
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
          const profile = row.original;
          const role = profile.role ?? "member";
          const RoleIcon = getRoleIcon(role);
          return (
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {getRoleDisplayName(role, profile.role_name)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const profile = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(profile.role);
        },
      },
      {
        id: "permission_ids",
        accessorFn: (row: ProfileListItem) => row.permission_ids ?? [],
        filterFn: (row, id, filterValue: string[]) =>
          !filterValue?.length ||
          filterValue.some((v) => ((row.getValue(id) as string[]) ?? []).includes(v)),
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableSorting: false,
        enableColumnFilter: true,
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
          const profile = row.original;
          const departmentIds = profile.department_ids ?? [];

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
    ],
    [departments]
  );

  // Build columns with checkbox + actions
  const columnsWithActions = useMemo(() => {
    const checkboxColumn: ColumnDef<ProfileListItem> = {
      id: "select",
      header: ({ table }) => (
        <div className="pr-2">
          <Checkbox
            checked={
              selectAllMatching
                ? allPageSelected
                : table.getIsAllPageRowsSelected() ||
                  (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
              // Under all-matching mode the header click toggles
              // exclusion of every row on the current page rather
              // than mutating selectedIds (which is unused while
              // selectAll=1).
              if (selectAllMatching) {
                const pageIds = table
                  .getFilteredRowModel()
                  .rows.map((row) => row.original.profile_id)
                  .filter((id): id is string => !!id);
                if (value) {
                  setExcludedProfileIds((prev) =>
                    prev.filter((id) => !pageIds.includes(id)),
                  );
                } else {
                  setExcludedProfileIds((prev) => {
                    const next = new Set([...prev, ...pageIds]);
                    return Array.from(next);
                  });
                }
                return;
              }
              table.toggleAllPageRowsSelected(!!value);
              const visibleRowIds = table
                .getFilteredRowModel()
                .rows.map((row) => row.original.profile_id)
                .filter((id): id is string => id !== null && id !== undefined);
              if (value) {
                setSelectedProfileIds((prev) => {
                  const newSelection = [...prev];
                  visibleRowIds.forEach((id) => {
                    if (!newSelection.includes(id)) {
                      newSelection.push(id);
                    }
                  });
                  return newSelection;
                });
              } else {
                setSelectedProfileIds((prev) =>
                  prev.filter((id) => !visibleRowIds.includes(id))
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
            checked={isSelected(row.original.profile_id)}
            onCheckedChange={() => {
              if (!row.original.profile_id) return;
              toggleSelection(row.original.profile_id);
            }}
            aria-label="Select row"
            className="translate-y-[2px]"
            data-testid="checkbox-select-profile"
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
        const profile = row.original;
        const canDeleteProfile = profile.can_delete ?? false;
        const canEditProfile = profile.can_edit ?? false;
        const canEmulateProfile = profile.can_emulate ?? false;
        const isEmulated = profile.is_emulated ?? false;
        const isThisEmulating = emulatingProfileId === profile.profile_id;
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
                    if (!profile.profile_id) return;
                    window.open(
                      `/analytics/reports/${profile.profile_id}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  disabled={!profile.profile_id}
                  data-testid="btn-preview-profile"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Report</p>
              </TooltipContent>
            </Tooltip>
            {canEditProfile && profile.profile_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    data-testid="btn-edit-profile"
                  >
                    <Link
                      href={`/management/profiles/${profile.profile_id}`}
                      prefetch={false}
                    >
                      <Edit className="h-3 w-3" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Profile</p>
                </TooltipContent>
              </Tooltip>
            )}
            {canDeleteProfile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      setDeleteProfileMember(profile);
                      setShowSingleDeleteDialog(true);
                    }}
                    data-testid="btn-delete-profile"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete Profile</p>
                </TooltipContent>
              </Tooltip>
            )}
            {canEmulateProfile && profile.profile_id && (
              isEmulated ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleUnemulate(profile.profile_id!)}
                      disabled={isThisEmulating}
                      data-testid="btn-unemulate-profile"
                    >
                      <UserX className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Exit Emulation</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEmulate(profile.profile_id!)}
                      disabled={isThisEmulating}
                      data-testid="btn-emulate-profile"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Emulate</p>
                  </TooltipContent>
                </Tooltip>
              )
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    };

    const filtered = columns.filter(
      (c) => c.id !== "select" && c.id !== "actions"
    );
    return [checkboxColumn, ...filtered, actionsColumn];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // ``isSelected`` / ``toggleSelection`` are declared further down
    // but stable per render via useCallback; included so the columns
    // re-build when selection state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, selectedProfileIds, selectAllMatching, excludedProfileIds, router, emulatingProfileId, handleEmulate, handleUnemulate]);

  const table = useReactTable({
    data: profiles,
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
    // ``profiles`` (the full merged reference) — not ``profiles.length``
    // — keeps tableRows in sync when an update mutates row content
    // (length unchanged). ``mergedProfiles`` is stable upstream via its
    // own useMemo, so no spurious recomputes. Mirrors the persona
    // pattern fix.
  }, [sortingKey, columnFiltersKey, profiles, pageIndex, pageSize]);

  // Toolbar state
  const isFiltered = table.getState().columnFilters.length > 0;
  const nameColumn = table.getColumn("search");
  const roleColumn = table.getColumn("role");
  const departmentIdsColumn = table.getColumn("department_ids");
  const permissionIdsColumn = table.getColumn("permission_ids");
  // ---- Selection helpers ----------------------------------------
  // ``isSelected`` is the single read predicate every row uses; it
  // dispatches between explicit-id and all-matching modes so
  // downstream code never needs to branch. ``selectedCount`` mirrors
  // that — under all-matching it's ``totalCount - excludedIds.length``.
  const totalMatchingCount = serverListData?.total_count ?? 0;

  const isSelected = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      return selectAllMatching
        ? !excludedProfileIds.includes(id)
        : selectedProfileIds.includes(id);
    },
    [selectAllMatching, excludedProfileIds, selectedProfileIds],
  );

  const selectedCount = selectAllMatching
    ? Math.max(0, totalMatchingCount - excludedProfileIds.length)
    : selectedProfileIds.length;

  /** Selected rows that are loaded on the current page. */
  const selectedProfilesOnPage = useMemo(() => {
    return profiles.filter((p) => p.profile_id && isSelected(p.profile_id));
  }, [profiles, isSelected]);

  const deletableProfiles = useMemo(() => {
    return selectedProfilesOnPage.filter((p) => p.can_delete ?? false);
  }, [selectedProfilesOnPage]);

  const nonDeletableProfiles = useMemo(() => {
    return selectedProfilesOnPage.filter((p) => !(p.can_delete ?? false));
  }, [selectedProfilesOnPage]);

  const deletableCount = deletableProfiles.length;

  // Flag catalog (e.g. profile_active) — used to reconstruct flag_ids on bulk edit.
  const flagOptions = useMemo(() => {
    return (serverListData?.flag_filter?.options || [])
      .filter((opt): opt is typeof opt & { id: string; name: string } => !!opt.id && !!opt.name)
      .map((opt) => ({ id: opt.id!, name: opt.name!, type: opt.type ?? null }));
  }, [serverListData?.flag_filter]);

  const editableProfiles = useMemo(() => {
    return selectedProfilesOnPage.filter((p) => p.can_edit ?? true);
  }, [selectedProfilesOnPage]);
  const editableCount = editableProfiles.length;

  // Check if all profiles on the current page are selected.
  const allPageSelected = useMemo(() => {
    const pageIds = profiles.filter((p) => p.profile_id).map((p) => p.profile_id!);
    if (pageIds.length === 0) return false;
    return pageIds.every((id) => isSelected(id));
  }, [profiles, isSelected]);

  // Whether there ARE more matching rows than what's loaded on this
  // page — used to decide whether to surface the "Select all N
  // matching" affordance after the user selects the page.
  const hasMoreThanCurrentPage = totalMatchingCount > profiles.length;

  // Toggle selection for a single profile. Under all-matching mode
  // we toggle membership in excludedProfileIds; otherwise it's the
  // straight selectedProfileIds toggle.
  const toggleSelection = useCallback((profileIdToToggle: string) => {
    if (selectAllMatching) {
      void setExcludedProfileIds((prev) =>
        prev.includes(profileIdToToggle)
          ? prev.filter((id) => id !== profileIdToToggle)
          : [...prev, profileIdToToggle],
      );
    } else {
      void setSelectedProfileIds((prev) =>
        prev.includes(profileIdToToggle)
          ? prev.filter((id) => id !== profileIdToToggle)
          : [...prev, profileIdToToggle],
      );
    }
  }, [selectAllMatching, setExcludedProfileIds, setSelectedProfileIds]);

  const clearSelection = useCallback(() => {
    void setSelectedProfileIds([]);
    void setSelectAllMatching(false);
    void setExcludedProfileIds([]);
  }, [setSelectedProfileIds, setSelectAllMatching, setExcludedProfileIds]);

  const selectAllOnPage = useCallback(() => {
    const pageIds = profiles.filter((p) => p.profile_id).map((p) => p.profile_id!);
    void setSelectAllMatching(false);
    void setExcludedProfileIds([]);
    void setSelectedProfileIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  }, [profiles, setSelectAllMatching, setExcludedProfileIds, setSelectedProfileIds]);

  /** Promote the current page-only selection into "all matching
   *  filter" mode. Clears explicit ids and exclusions. */
  const selectAllMatchingNow = useCallback(() => {
    void setSelectedProfileIds([]);
    void setExcludedProfileIds([]);
    void setSelectAllMatching(true);
  }, [setSelectedProfileIds, setExcludedProfileIds, setSelectAllMatching]);

  // suppress unused-symbol lint when toggleSelection isn't wired into the
  // table row UI yet (the selection checkbox in this artifact still uses
  // the table's RowSelection model). Keeping it exported in the helper
  // closure so the bulk handlers + future row-checkbox refactor land
  // cleanly without needing another patch.
  void toggleSelection;
  void selectAllOnPage;

  const openBulkEditDialog = () => {
    setBulkEditActiveStatus(null);
    setShowBulkEditDialog(true);
  };

  const handleBulkEdit = async () => {
    if (!updateProfileAction) return;
    if (!selectAllMatching && editableProfiles.length === 0) return;

    const hasActiveChange = bulkEditActiveStatus !== null;
    if (!hasActiveChange) {
      toast.error("No changes selected");
      return;
    }

    // Resolve canonical profile_active flag id (so server doesn't have to look it up).
    const activeFlagId = flagOptions.find((f) => f.type === "profile_active")?.id;

    setIsBulkEditing(true);
    try {
      let body: UpdateProfileIn["body"];
      if (selectAllMatching) {
        // All-matching: server clones the patch per resolved row,
        // stamping each id. Per-row flag preservation isn't possible —
        // the active toggle becomes "set across all matching rows".
        const flag_ids: string[] = [];
        if (bulkEditActiveStatus && activeFlagId) flag_ids.push(activeFlagId);
        body = {
          all: true,
          excluded_ids: excludedProfileIds,
          ...(currentSearchBody ?? {}),
          patch: { flag_ids },
          accept: true,
        } as UpdateProfileIn["body"];
      } else {
        // Explicit: clone the patch per-row, preserving each row's
        // existing flag state for flags we aren't toggling.
        const items = editableProfiles.map((p) => {
          const flag_ids = bulkEditActiveStatus && activeFlagId ? [activeFlagId] : [];
          return {
            profile_id: p.profile_id!,
            flag_ids,
          };
        });
        body = { profiles: items, accept: true } as UpdateProfileIn["body"];
      }

      const result = await updateProfileAction({ body } as UpdateProfileIn);

      // Per-row results from server: success = actual update, failures
      // are soft-skipped rows under all-matching (no permission /
      // not found). Toast reflects both counts.
      const results = (result as UpdateProfileOut).results ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} profile(s) updated, ${skippedCount} skipped`,
        );
      } else {
        toast.success(`${successCount} profile(s) updated successfully`);
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update profiles";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to update profiles");
    } finally {
      setIsBulkEditing(false);
      setShowBulkEditDialog(false);
    }
  };

  const handleBulkDelete = async () => {
    // Either explicit-mode (deletable rows on current page) OR all-
    // matching mode (server resolves rows via filter). Both converge
    // on the same ``bulkDeleteProfileAction`` call shape; the body
    // just differs.
    if (!bulkDeleteProfileAction) return;
    if (!selectAllMatching && deletableProfiles.length === 0) {
      setShowBulkDeleteDialog(false);
      return;
    }

    setIsBulkDeleting(true);
    try {
      const body = selectAllMatching
        ? {
            // Server resolves matching ids from the same filter the
            // page used (currentSearchBody is the SSR body), subtracts
            // ``excluded_ids``, then runs the existing per-row delete.
            // Per-row permission failures soft-skip — surfaced in
            // response.results[].
            all: true as const,
            excluded_ids: excludedProfileIds,
            ...(currentSearchBody ?? {}),
            accept: true,
          }
        : {
            profile_ids: deletableProfiles.map((p) => p.profile_id!),
            accept: true,
          };

      const result = await bulkDeleteProfileAction({ body } as BulkDeleteProfileIn);

      // ``BulkDeleteProfileOut`` is currently typed ``unknown`` (the
      // ``/profile/bulk/delete`` path lags in the regenerated OpenAPI
      // tree — same reason `BulkDeleteProfileIn` needs the cast above).
      // Narrow through a structural shape so the soft-skip toast count
      // type-checks once the OpenAPI types catch up.
      type BulkDeleteRow = { success: boolean; profile_id?: string | null; message?: string };
      const results = ((result as { results?: BulkDeleteRow[] }).results) ?? [];
      const successCount = results.filter((r) => r.success).length;
      const skippedCount = results.length - successCount;
      if (skippedCount > 0) {
        toast.success(
          `${successCount} profile(s) deleted, ${skippedCount} skipped`,
        );
      } else {
        toast.success(
          successCount > 0
            ? `${successCount} profile(s) deleted successfully`
            : "Selected profiles deleted",
        );
      }
      clearSelection();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete profiles";
      toast.error(msg.replace(/^\d{3}\s*/, "") || "Failed to delete selected profiles");
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6" data-page="profiles-index">
        {/* Profiles Data Table */}
        <div className="space-y-2">
          {/* Toolbar */}
          <div
            className="flex items-center justify-between"
            data-testid="profiles-toolbar"
          >
            <div className="flex flex-1 items-center space-x-2 flex-wrap">
              <div className="mb-2 w-full md:w-auto">
                <Input
                  placeholder="Search profiles by name or email..."
                  value={(nameColumn?.getFilterValue() as string) ?? ""}
                  onChange={(event) =>
                    nameColumn?.setFilterValue(event.target.value)
                  }
                  className="h-8 w-full md:w-[150px] lg:w-[250px]"
                  data-testid="profiles-search"
                />
              </div>

              <div className="flex items-center space-x-2 flex-wrap mb-2">
                <ThreePickerFilters
                  slots={[
                    {
                      column: roleColumn,
                      title: "Role",
                      options: roleOptions,
                    },
                    {
                      column: permissionIdsColumn,
                      title: "Permissions",
                      options: permissionsOptions,
                    },
                    {
                      column: departmentIdsColumn,
                      title: "Department",
                      options: departmentOptions,
                    },
                  ]}
                />

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
                  disabled={!initialCreateProfileData}
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
                  data-testid="btn-bulk-delete-profiles"
                  disabled={!selectAllMatching && deletableCount === 0}
                >
                  {selectAllMatching
                    ? `Delete ${selectedCount} matching`
                    : `Delete ${deletableCount} of ${selectedCount}`}
                </Button>
              )}

              {/* Bulk edit if any selected */}
              {selectedCount > 0 && updateProfileAction && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openBulkEditDialog}
                  className="h-8"
                  data-testid="btn-bulk-edit-profiles"
                  disabled={!selectAllMatching && editableCount === 0}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {selectAllMatching
                    ? `Edit ${selectedCount} matching`
                    : `Edit ${editableCount} of ${selectedCount}`}
                </Button>
              )}

              {/* Clear selection — escape hatch in both modes */}
              {selectedCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="h-8"
                >
                  Unselect All
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
                hiddenColumns={[]}
              />
            </div>
          </div>

          {/* Cross-page selection banners. Two states:
              (a) page-all selected, more matching elsewhere → offer
                  "Select all N matching" to flip into all-matching mode.
              (b) all-matching active → show count + Clear so the
                  user always has an obvious escape hatch.
              Mutually exclusive — both never render at once. */}
          {!selectAllMatching && allPageSelected && hasMoreThanCurrentPage && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm"
              data-testid="select-all-matching-banner"
            >
              <span className="text-muted-foreground">
                All {profiles.length} on this page selected.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={selectAllMatchingNow}
              >
                Select all {totalMatchingCount} matching
              </Button>
            </div>
          )}
          {selectAllMatching && (
            <div
              className="flex items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2 text-sm"
              data-testid="all-matching-active-banner"
            >
              <span className="text-muted-foreground">
                All {selectedCount} matching profiles selected
                {excludedProfileIds.length > 0 && ` (${excludedProfileIds.length} excluded)`}.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={clearSelection}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <div
            className="rounded-md border overflow-x-auto"
            data-testid="profiles-table"
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
                                header.getContext()
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
                      data-testid="profiles-row"
                      data-profile-id={row.original.profile_id}
                    >
                      {row
                        .getVisibleCells()
                        .map(
                          (
                            cell: ReturnType<typeof row.getVisibleCells>[number]
                          ) => (
                            <TableCell
                              key={cell.id}
                              className="border-r px-3 py-2 text-center"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          )
                        )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columnsWithActions.length}
                      className="h-24 text-center px-6"
                    >
                      No profiles found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} largePage={true} />
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
                <DialogTitle>Import Profiles from CSV</DialogTitle>
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
                          : "border-muted-foreground/25 hover:border-primary/50"
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
                              (m) => m.csv_column === header
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
                                            : m
                                        )
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
                            <TableHead>Name</TableHead>
                            <TableHead>Alias</TableHead>
                            <TableHead>Role</TableHead>
                            {validDepartmentIdsForCSV.length > 1 && (
                              <TableHead>Department</TableHead>
                            )}
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
                              const hasNameError = errors.some(
                                (e) => e.field === "name" // snake_case
                              );
                              const hasAliasError = errors.some(
                                (e) => e.field === "email"
                              );
                              const hasDuplicateAlias =
                                duplicateAliasMap.has(index);
                              const hasRoleError = errors.some(
                                (e) => e.field === "role"
                              );
                              const hasDepartmentError =
                                validDepartmentIdsForCSV.length > 1 &&
                                errors.some(
                                  (e) =>
                                    e.field === "department_ids" ||
                                    e.field === "department_id"
                                );
                              return (
                                <TableRow
                                  key={index}
                                  data-testid={`csv-review-row-${index}`}
                                >
                                  <TableCell>{row.row_index}</TableCell>
                                  <TableCell
                                    className={
                                      hasNameError
                                        ? "bg-destructive/10"
                                        : ""
                                    }
                                  >
                                    <Input
                                      value={editableRow.name || ""} // snake_case
                                      onChange={(e) =>
                                        updateEditableRow(
                                          index,
                                          "name", // snake_case
                                          e.target.value || null
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
                                          e.target.value || ""
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
                                      items={(roleResourcesForCSV.length > 0
                                        ? roleResourcesForCSV
                                        : PROFILE_ROLES
                                      ).filter((r) =>
                                        validRoles.includes(r.id)
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
                                          ids[0] || null
                                        )
                                      }
                                      getId={(role) => role.id}
                                      getLabel={(role) => role.name}
                                      getSearchText={(role) =>
                                        `${role.name} ${role.description || ""}`
                                      }
                                      renderItem={(role, isSelected) => {
                                        const FallbackIcon =
                                          role.icon || UserIcon;
                                        const hexColor =
                                          role.color || "#64748b";
                                        return (
                                          <div className="flex items-center gap-3 w-full">
                                            <div
                                              className="p-2 rounded-lg shadow-lg flex-shrink-0"
                                              style={{
                                                background:
                                                  generateGradientFromHex(
                                                    hexColor
                                                  ),
                                              }}
                                            >
                                              {"iconSvg" in role && role.iconSvg ? (
                                                <SvgIcon svg={role.iconSvg} className="h-4 w-4 text-white" />
                                              ) : (
                                                <FallbackIcon className="h-4 w-4 text-white" />
                                              )}
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
                                                  : "opacity-0"
                                              )}
                                            />
                                          </div>
                                        );
                                      }}
                                      renderButton={(selectedItems) => {
                                        if (selectedItems.length === 0)
                                          return "Select role...";
                                        const role = selectedItems[0];
                                        const FallbackIcon =
                                          role?.icon || UserIcon;
                                        const hexColor =
                                          role?.color || "#64748b";
                                        return (
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div
                                              className="p-1 rounded-md shadow-sm flex-shrink-0"
                                              style={{
                                                background:
                                                  generateGradientFromHex(
                                                    hexColor
                                                  ),
                                              }}
                                            >
                                              {role && "iconSvg" in role && role.iconSvg ? (
                                                <SvgIcon svg={role.iconSvg} className="h-3.5 w-3.5 text-white" />
                                              ) : (
                                                <FallbackIcon className="h-3.5 w-3.5 text-white" />
                                              )}
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
                                      groupHeading="Profile Roles"
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
                                            ids
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
                          : `Import Profiles`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Bulk Delete Confirmation */}
        <BulkDeleteDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
          count={selectAllMatching ? selectedCount : deletableProfiles.length}
          entityLabel="profile"
          entityLabelPlural="profiles"
          isDeleting={isBulkDeleting}
          onConfirm={handleBulkDelete}
          description={
            <>
              <p>
                This will permanently delete the selected accounts. Default
                profiles and your own account will not be deleted.
              </p>
              {selectAllMatching ? (
                // All-matching mode: server resolves rows from filter +
                // exclusions; per-row permission failures soft-skip.
                // We can't enumerate names without round-tripping through
                // the search endpoint, so show count + filter state.
                <div className="text-sm text-muted-foreground">
                  <p>
                    All <span className="font-medium text-foreground">{selectedCount}</span> matching
                    {" "}profiles will be deleted server-side using the current filter.
                  </p>
                  {excludedProfileIds.length > 0 && (
                    <p className="mt-1">
                      {excludedProfileIds.length} explicitly excluded.
                    </p>
                  )}
                  <p className="mt-1">
                    Profiles you don't have permission to delete will be skipped automatically.
                  </p>
                </div>
              ) : (
                <>
                  {deletableProfiles.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-destructive mb-1">
                        The following accounts will be removed:
                      </p>
                      <ul className="text-sm space-y-0.5 max-h-32 overflow-y-auto">
                        {deletableProfiles.map((s) => (
                          <li key={s.profile_id} className="flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" />
                            {s.name} (
                            {s.primary_email ||
                              (s.emails && s.emails.length > 0 ? s.emails[0] : "")}
                            )
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {nonDeletableProfiles.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-1">
                        Cannot be deleted (skipped):
                      </p>
                      <ul className="text-sm space-y-0.5 max-h-24 overflow-y-auto">
                        {nonDeletableProfiles.map((s) => (
                          <li
                            key={s.profile_id}
                            className="flex items-center gap-1.5 text-muted-foreground"
                          >
                            {s.name} (
                            {s.primary_email ||
                              (s.emails && s.emails.length > 0 ? s.emails[0] : "")}
                            )
                            {s.profile_id === profile?.id
                              ? " – your account"
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </>
          }
        />

        {/* Bulk Edit Modal */}
        <BulkEditDialog
          open={showBulkEditDialog}
          onOpenChange={setShowBulkEditDialog}
          count={selectAllMatching ? selectedCount : editableCount}
          entityLabelPlural="profiles"
          isSaving={isBulkEditing}
          onSave={handleBulkEdit}
        >
          <BulkEditFlagField
            label="Active status"
            value={bulkEditActiveStatus}
            onChange={setBulkEditActiveStatus}
          />
        </BulkEditDialog>

        {/* Single Delete Confirmation */}
        <AlertDialog
          open={showSingleDeleteDialog}
          onOpenChange={setShowSingleDeleteDialog}
        >
          <AlertDialogContent data-testid="dialog-delete-profile">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {deleteProfileMember?.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the account. Default profiles and
                your own account cannot be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteProfileMember &&
              (() => {
                const profileMember = deleteProfileMember;
                const canDelete = profileMember.can_delete;

                if (!canDelete) {
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium text-yellow-700 dark:text-yellow-400">
                          This account cannot be deleted:
                        </p>
                        <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            • {profileMember.name} (
                            {profileMember.primary_email ||
                              (profileMember.emails &&
                              profileMember.emails.length > 0
                                ? profileMember.emails[0]
                                : "")}
                            )
                            {profileMember.profile_id === profile?.id
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
                        The following account will be removed:
                      </p>
                      <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <ul className="text-sm space-y-2">
                          <li className="text-red-600 dark:text-red-300">
                            • {profileMember.name} (
                            {profileMember.primary_email ||
                              (profileMember.emails &&
                              profileMember.emails.length > 0
                                ? profileMember.emails[0]
                                : "")}
                            )
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
                  if (!deleteProfileMember) return;

                  if (!deleteProfileMember.can_delete) {
                    toast.error("This user cannot be deleted");
                    setShowSingleDeleteDialog(false);
                    setDeleteProfileMember(null);
                    return;
                  }

                  if (!deleteProfileMember.profile_id) {
                    toast.error("Invalid user profile ID");
                    setShowSingleDeleteDialog(false);
                    setDeleteProfileMember(null);
                    return;
                  }

                  try {
                    if (!deleteProfileAction) return;
                    if (!profile?.id) {
                      toast.error("Profile ID is required");
                      return;
                    }
                    await deleteProfileAction({
                      body: {
                        profile_ids: [deleteProfileMember.profile_id],
                        all: false,
                        accept: true,
                      },
                    });
                    router.refresh();
                    toast.success("User deleted successfully");
                    setShowSingleDeleteDialog(false);
                    setDeleteProfileMember(null);
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
