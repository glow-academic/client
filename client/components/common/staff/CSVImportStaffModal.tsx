"use client";

import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  FileUp,
  Map,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { CohortPicker } from "@/components/common/forms/CohortPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
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
import { useProfile } from "@/contexts/profile-context";
import {
  useBulkCreateOrUpdateStaff,
  useProcessCSV,
} from "@/lib/api/v2/hooks/profile";
import { cn } from "@/lib/utils";

type CSVColumnMapping = {
  csv_column: string;
  target_field: string | null;
};

type ProcessedCSVRow = {
  row_index: number;
  firstName: string | null;
  lastName: string | null;
  alias: string | null;
  role: string | null;
  department_ids: string[];
  cohort_ids: string[];
  errors: Array<{
    row_index: number;
    field: string;
    message: string;
  }>;
};

export interface CSVImportStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentIds?: string[];
  cohortIds?: string[];
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  cohortMapping: Record<string, { name: string; description: string }>;
  validCohortIds: string[];
  roleOptions: string[];
  onDone?: () => void;
  onStagedProfiles?: (
    profiles: Array<{
      profileId: string;
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
    }>
  ) => void;
}

type Stage = "upload" | "mapping" | "review";

const TARGET_FIELDS = [
  {
    value: "firstName",
    label: "First Name",
    description: "The staff member's first name",
    required: true,
  },
  {
    value: "lastName",
    label: "Last Name",
    description: "The staff member's last name",
    required: true,
  },
  {
    value: "alias",
    label: "Alias/Email",
    description: "Username or email address (alias only, without @domain)",
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

// Simple CSV generation function
const unparseCSV = (data: Record<string, string>[]): string => {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header] || "";
          // Escape commas and quotes in values
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

// Auto-mapping logic
const autoMapColumn = (columnName: string): string | null => {
  const lower = columnName.toLowerCase().trim();

  // First name patterns
  if (
    ["first name", "firstname", "first_name", "fname", "first"].includes(lower)
  ) {
    return "firstName";
  }

  // Last name patterns
  if (["last name", "lastname", "last_name", "lname", "last"].includes(lower)) {
    return "lastName";
  }

  // Alias/email patterns
  if (
    ["alias", "email", "username", "user", "login", "email address"].includes(
      lower
    )
  ) {
    return "alias";
  }

  // Role patterns
  if (["role", "user role", "permission"].includes(lower)) {
    return "role";
  }

  // Department patterns
  if (["department", "dept", "department_id", "dept_id"].includes(lower)) {
    return "department";
  }

  // Cohort patterns
  if (["cohort", "cohort_id", "cohort_name", "cohort name"].includes(lower)) {
    return "cohort";
  }

  return null;
};

// Extract alias from email
const extractAliasFromEmail = (email: string): string => {
  if (!email || !email.includes("@")) return email;
  const parts = email.split("@");
  return parts[0]?.trim() || email;
};

// ColumnPicker Component for destination column mapping
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
  const [open, setOpen] = React.useState(false);

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

export default function CSVImportStaffModal({
  open,
  onOpenChange,
  departmentIds,
  cohortIds,
  departmentMapping,
  validDepartmentIds,
  cohortMapping,
  validCohortIds,
  roleOptions,
  onDone,
  onStagedProfiles,
}: CSVImportStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const processCSVMutation = useProcessCSV();
  const bulkCreateOrUpdateMutation = useBulkCreateOrUpdateStaff();

  const [stage, setStage] = useState<Stage>("upload");
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

  // Determine scoping context
  const isScoped = !!(departmentIds?.length || cohortIds?.length);
  const isCohortScoped = !!cohortIds?.length;
  const isDepartmentScoped = !cohortIds?.length && !!departmentIds?.length;

  // Valid role values based on scope (mirror ManualAddStaffModal logic)
  const validRoles = React.useMemo(() => {
    const roleOrder = ["ta", "instructional", "admin", "superadmin"];

    // Apply scope restrictions
    let allowedRoles: string[];
    if (isCohortScoped) {
      // Cohort scope: only ta and instructional
      allowedRoles = ["ta", "instructional"];
    } else if (isDepartmentScoped) {
      // Department scope: ta, instructional, and admin
      allowedRoles = ["ta", "instructional", "admin"];
    } else {
      // Staff scope: all roles allowed
      allowedRoles = ["ta", "instructional", "admin", "superadmin"];
    }

    // Filter roleOptions to only include roles that are both in options and allowed by scope
    return roleOrder.filter(
      (role) => allowedRoles.includes(role) && roleOptions.includes(role)
    );
  }, [roleOptions, isCohortScoped, isDepartmentScoped]);

  // Get available target fields based on scoping
  const availableTargetFields = React.useMemo(() => {
    return TARGET_FIELDS.filter((field) => {
      // Hide department if scoped
      if (
        field.value === "department" &&
        departmentIds &&
        departmentIds.length > 0
      ) {
        return false;
      }
      // Hide cohort if scoped
      if (field.value === "cohort" && cohortIds && cohortIds.length > 0) {
        return false;
      }
      return true;
    });
  }, [departmentIds, cohortIds]);

  // Download template function
  const downloadTemplate = useCallback(() => {
    // Determine columns based on scoping
    const columns: string[] = ["firstName", "lastName", "alias", "role"];
    if (!departmentIds || departmentIds.length === 0) {
      columns.push("department");
    }
    if (!cohortIds || cohortIds.length === 0) {
      columns.push("cohort");
    }

    // Generate template data
    const template = [
      {
        firstName: "Sarah",
        lastName: "Johnson",
        alias: "sjohnson",
        role: "instructional",
        ...(columns.includes("department") ? { department: "" } : {}),
        ...(columns.includes("cohort") ? { cohort: "" } : {}),
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        alias: "jsmith",
        role: "instructional",
        ...(columns.includes("department") ? { department: "" } : {}),
        ...(columns.includes("cohort") ? { cohort: "" } : {}),
      },
      {
        firstName: "John",
        lastName: "Doe",
        alias: "jdoe",
        role: "ta",
        ...(columns.includes("department") ? { department: "" } : {}),
        ...(columns.includes("cohort") ? { cohort: "" } : {}),
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
  }, [departmentIds, cohortIds]);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setStage("upload");
      setCsvContent("");
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMappings([]);
      setProcessedRows([]);
      setEditableRows({});
      setIncludedColumns({});
      setShowErrorRows(true);
    }
  }, [open]);

  // Calculate hasErrors from processedRows
  const hasErrors = React.useMemo(
    () => processedRows.some((row) => row.errors.length > 0),
    [processedRows]
  );

  // Update showErrorRows default when errors appear
  React.useEffect(() => {
    if (hasErrors) {
      setShowErrorRows(true);
    }
  }, [hasErrors]);

  // Parse CSV file
  const parseCSV = useCallback(
    (
      csvText: string
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
    []
  );

  // Handle file upload
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

          // Auto-map columns
          const mappings: CSVColumnMapping[] = headers.map((header) => ({
            csv_column: header,
            target_field: autoMapColumn(header),
          }));
          setColumnMappings(mappings);

          // Initialize include state - default to true for required fields
          const requiredFields = ["firstName", "lastName", "alias"];
          const initialIncludes: Record<string, boolean> = {};
          headers.forEach((header) => {
            const mappedField = autoMapColumn(header);
            initialIncludes[header] = mappedField
              ? requiredFields.includes(mappedField)
              : true;
          });
          setIncludedColumns(initialIncludes);

          setStage("mapping");
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

  // React-dropzone hook
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

  // Build requirements text based on scoping
  const csvRequirements = React.useMemo(() => {
    const required: string[] = ["First Name", "Last Name", "Alias"];
    const optional: string[] = ["Role"];

    if (!departmentIds || departmentIds.length === 0) {
      optional.push("Department");
    }

    if (!cohortIds || cohortIds.length === 0) {
      optional.push("Cohort");
    }

    return { required, optional };
  }, [departmentIds, cohortIds]);

  // Process CSV (mapping stage -> review stage)
  const handleProcessCSV = useCallback(async () => {
    // Filter mappings to only include checked columns
    const activeMappings = columnMappings.filter(
      (m) => includedColumns[m.csv_column] !== false
    );

    // Validate that required fields are mapped
    const requiredFields = ["firstName", "lastName", "alias"];
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

    setIsProcessing(true);
    try {
      // Use filtered mappings (only included columns)
      const response = await processCSVMutation.mutateAsync({
        csv_content: csvContent,
        column_mappings: activeMappings,
      });

      setProcessedRows(response.rows);
      setEditableRows({});
      setStage("review");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process CSV file.";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, columnMappings, includedColumns, processCSVMutation]);

  // Check for duplicate aliases in review stage
  const duplicateAliasMap = React.useMemo(() => {
    const aliasMap: Record<string, number[]> = {};
    processedRows.forEach((row, idx) => {
      const editableRow = editableRows[idx] || row;
      const alias = extractAliasFromEmail(
        editableRow.alias || ""
      ).toLowerCase();
      if (alias) {
        if (!aliasMap[alias]) {
          aliasMap[alias] = [];
        }
        aliasMap[alias]!.push(idx);
      }
    });
    // Return set of row indices that have duplicate aliases
    const duplicates = new Set<number>();
    Object.values(aliasMap).forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((idx) => duplicates.add(idx));
      }
    });
    return duplicates;
  }, [processedRows, editableRows]);

  // Update editable row
  const updateEditableRow = useCallback(
    (rowIndex: number, field: string, value: string | null | string[]) => {
      setEditableRows((prev) => {
        const current = prev[rowIndex] || processedRows[rowIndex];
        if (!current) return prev;

        const updated = { ...current } as ProcessedCSVRow &
          Record<string, string | null | string[]>;

        // Handle arrays for department_ids and cohort_ids
        if (field === "department_ids" || field === "cohort_ids") {
          updated[field] = Array.isArray(value) ? value : [];
        } else {
          updated[field] = value;
        }

        // Revalidate errors
        const errors = [...updated.errors];
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

  // Submit review (create/update staff)
  const handleSubmit = useCallback(async () => {
    // Combine processed rows with editable rows
    const finalRows = processedRows.map((row, index) => {
      return editableRows[index] || row;
    });

    // Filter out rows with errors
    const validRows = finalRows.filter((row) => row.errors.length === 0);

    if (validRows.length === 0) {
      toast.error("No valid rows to process. Please fix errors.");
      return;
    }

    // Validate roles against scope restrictions
    const invalidRoles = validRows
      .map((row, idx) => {
        const role = row.role || "ta";
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

    // Validate alias uniqueness within the batch
    const aliasCounts: Record<string, number[]> = {};
    validRows.forEach((row, idx) => {
      const alias = extractAliasFromEmail(row.alias || "").toLowerCase();
      if (alias) {
        if (!aliasCounts[alias]) {
          aliasCounts[alias] = [];
        }
        aliasCounts[alias]!.push(idx);
      }
    });

    const duplicateAliases = Object.entries(aliasCounts)
      .filter(([, indices]) => indices.length > 1)
      .map(([alias]) => alias);

    if (duplicateAliases.length > 0) {
      toast.error(
        `Duplicate aliases found in CSV: ${duplicateAliases.join(", ")}`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert rows to profiles
      const profiles = validRows.map((row) => {
        let deptIds: string[] = [];
        let cohortIds: string[] = [];

        // Staging logic based on context:
        // - Cohort page (cohortIds): Don't attach departments or cohorts (staging mode)
        // - Department page (departmentIds, no cohortIds): Allow cohorts, don't attach departments (staging for departments)
        // - Staff page (no scoping): Use both department_ids and cohort_ids directly (no staging)

        if (isCohortScoped) {
          // Cohort page: staging mode - don't attach anything
          deptIds = [];
          cohortIds = [];
        } else if (isDepartmentScoped) {
          // Department page: allow cohorts from CSV, but don't attach departments (staging)
          deptIds = [];
          // Allow cohort assignment from CSV - resolve IDs from names if needed
          const rowCohortIds = row.cohort_ids || [];
          cohortIds = rowCohortIds
            .map((cohortIdOrName) => {
              if (validCohortIds.includes(cohortIdOrName)) {
                return cohortIdOrName;
              }
              // Try to find by name
              const found = Object.entries(cohortMapping).find(
                ([_, cohort]) =>
                  cohort.name.toLowerCase() === cohortIdOrName.toLowerCase()
              );
              return found ? found[0] : null;
            })
            .filter((id): id is string => id !== null);
        } else {
          // Staff page: no staging - use both directly
          // Resolve department/cohort IDs from names if needed
          const rowDeptIds = row.department_ids || [];
          deptIds = rowDeptIds
            .map((deptIdOrName) => {
              if (validDepartmentIds.includes(deptIdOrName)) {
                return deptIdOrName;
              }
              // Try to find by name
              const found = Object.entries(departmentMapping).find(
                ([_, dept]) =>
                  dept.name.toLowerCase() === deptIdOrName.toLowerCase()
              );
              return found ? found[0] : null;
            })
            .filter((id): id is string => id !== null);

          const rowCohortIds = row.cohort_ids || [];
          cohortIds = rowCohortIds
            .map((cohortIdOrName) => {
              if (validCohortIds.includes(cohortIdOrName)) {
                return cohortIdOrName;
              }
              // Try to find by name
              const found = Object.entries(cohortMapping).find(
                ([_, cohort]) =>
                  cohort.name.toLowerCase() === cohortIdOrName.toLowerCase()
              );
              return found ? found[0] : null;
            })
            .filter((id): id is string => id !== null);
        }

        return {
          firstName: row.firstName!,
          lastName: row.lastName!,
          alias: extractAliasFromEmail(row.alias || ""),
          role: row.role || "ta",
          department_ids: deptIds,
          cohort_ids: cohortIds,
        };
      });

      const response = await bulkCreateOrUpdateMutation.mutateAsync({
        profiles,
        currentProfileId: effectiveProfile?.id || "",
      });

      // When scoped, stage the profiles
      if (isScoped && onStagedProfiles && response.profileIds) {
        // Map profile IDs to profile data from valid rows
        // The profileIds array corresponds to the profiles array order
        const stagedProfiles = response.profileIds.map((profileId, index) => {
          const row = validRows[index];
          return {
            profileId,
            firstName: row?.firstName ?? "",
            lastName: row?.lastName ?? "",
            alias: row?.alias ?? "",
            role: row?.role ?? "ta",
          };
        });
        onStagedProfiles(stagedProfiles);
        toast.success(
          `${response.created_count + response.updated_count} profile(s) staged. They will be added to the cohort when you click Update.`
        );
      } else {
        toast.success(
          `Successfully processed ${response.created_count} created, ${response.updated_count} updated staff member(s)!`
        );
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
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
    departmentMapping,
    validDepartmentIds,
    cohortMapping,
    validCohortIds,
    isCohortScoped,
    isDepartmentScoped,
    isScoped,
    validRoles,
    effectiveProfile?.id,
    bulkCreateOrUpdateMutation,
    onOpenChange,
    onDone,
    onStagedProfiles,
  ]);

  const validRowCount = processedRows.filter(
    (row) => row.errors.length === 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Staff from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stage indicator */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  stage === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stage === "upload" ? <FileUp className="h-4 w-4" /> : "1"}
              </div>
              <span className={stage === "upload" ? "font-medium" : ""}>
                Upload
              </span>
            </div>
            <div className="h-1 w-16 bg-muted" />
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  stage === "mapping"
                    ? "bg-primary text-primary-foreground"
                    : stage === "review"
                      ? "bg-muted text-muted-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {stage === "mapping" ? <Map className="h-4 w-4" /> : "2"}
              </div>
              <span className={stage === "mapping" ? "font-medium" : ""}>
                Mapping
              </span>
            </div>
            <div className="h-1 w-16 bg-muted" />
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  stage === "review"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stage === "review" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  "3"
                )}
              </div>
              <span className={stage === "review" ? "font-medium" : ""}>
                Review
              </span>
            </div>
          </div>

          {/* Stage 1: Upload */}
          {stage === "upload" && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-16 text-center transition-colors cursor-pointer",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <input {...getInputProps()} />
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
                  {/* Download Template Button - grouped with instructions */}
                  <div className="pt-2 flex justify-center">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadTemplate();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV Template
                    </Button>
                  </div>
                </div>
              </div>

              {/* Footer with Cancel and Next buttons */}
              <div
                className={`flex items-center pt-4 border-t ${
                  csvHeaders.length > 0 ? "justify-between" : "justify-end"
                }`}
              >
                {csvHeaders.length > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        setStage("mapping");
                      }}
                    >
                      Next
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Stage 2: Mapping */}
          {stage === "mapping" && (
            <div className="space-y-4">
              {/* Mapping Table */}
              <div className="rounded-md border">
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
                      const isIncluded = includedColumns[header] !== false;

                      return (
                        <TableRow key={header}>
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
                <Button variant="outline" onClick={() => setStage("upload")}>
                  Back
                </Button>
                <Button onClick={handleProcessCSV} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : "Continue to Review"}
                </Button>
              </div>
            </div>
          )}

          {/* Stage 3: Review */}
          {stage === "review" && (
            <div className="space-y-4">
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

              <div className="rounded-md border max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Alias</TableHead>
                      <TableHead>Role</TableHead>
                      {(!departmentIds || departmentIds.length === 0) && (
                        <TableHead>Department</TableHead>
                      )}
                      {(!cohortIds || cohortIds.length === 0) && (
                        <TableHead>Cohort</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRows
                      .filter((row, index) => {
                        const editableRow = editableRows[index] || row;
                        const hasRowErrors = editableRow.errors.length > 0;
                        // Filter based on switch: if showErrorRows is false, hide error rows
                        if (!showErrorRows && hasRowErrors) {
                          return false;
                        }
                        return true;
                      })
                      .map((row, index) => {
                        const editableRow = editableRows[index] || row;
                        const hasFirstNameError = editableRow.errors.some(
                          (e) => e.field === "firstName"
                        );
                        const hasLastNameError = editableRow.errors.some(
                          (e) => e.field === "lastName"
                        );
                        const hasAliasError = editableRow.errors.some(
                          (e) => e.field === "alias"
                        );
                        const hasDuplicateAlias = duplicateAliasMap.has(index);
                        const hasRoleError = editableRow.errors.some(
                          (e) => e.field === "role"
                        );
                        const hasDepartmentError =
                          (!departmentIds || departmentIds.length === 0) &&
                          editableRow.errors.some(
                            (e) =>
                              e.field === "department_ids" ||
                              e.field === "department_id"
                          );
                        const hasCohortError =
                          (!cohortIds || cohortIds.length === 0) &&
                          editableRow.errors.some(
                            (e) =>
                              e.field === "cohort_ids" ||
                              e.field === "cohort_id"
                          );

                        return (
                          <TableRow key={index}>
                            <TableCell>{row.row_index}</TableCell>
                            <TableCell
                              className={
                                hasFirstNameError ? "bg-destructive/10" : ""
                              }
                            >
                              <Input
                                value={editableRow.firstName || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "firstName",
                                    e.target.value || null
                                  )
                                }
                                className="h-8 w-full min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell
                              className={
                                hasLastNameError ? "bg-destructive/10" : ""
                              }
                            >
                              <Input
                                value={editableRow.lastName || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "lastName",
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
                                value={editableRow.alias || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "alias",
                                    e.target.value || null
                                  )
                                }
                                className="h-8 w-full min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell
                              className={
                                hasRoleError ? "bg-destructive/10" : ""
                              }
                            >
                              <StaffRolePicker
                                selectedRole={editableRow.role || ""}
                                onSelect={(value) =>
                                  updateEditableRow(
                                    index,
                                    "role",
                                    value || null
                                  )
                                }
                                roleOptions={validRoles}
                                placeholder="Select role"
                                buttonClassName="h-8"
                              />
                            </TableCell>
                            {(!departmentIds || departmentIds.length === 0) && (
                              <TableCell
                                className={
                                  hasDepartmentError ? "bg-destructive/10" : ""
                                }
                              >
                                <DepartmentPicker
                                  mapping={departmentMapping}
                                  validIds={validDepartmentIds}
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
                                  placeholder="Select departments"
                                  multiSelect={true}
                                  compact={true}
                                />
                              </TableCell>
                            )}
                            {(!cohortIds || cohortIds.length === 0) && (
                              <TableCell
                                className={
                                  hasCohortError ? "bg-destructive/10" : ""
                                }
                              >
                                <CohortPicker
                                  mapping={cohortMapping}
                                  validIds={validCohortIds}
                                  selectedIds={
                                    (editableRow.cohort_ids ||
                                      row.cohort_ids ||
                                      []) as string[]
                                  }
                                  onSelect={(ids) =>
                                    updateEditableRow(index, "cohort_ids", ids)
                                  }
                                  placeholder="Select cohorts"
                                  multiSelect={true}
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
                <Button variant="outline" onClick={() => setStage("mapping")}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || validRowCount === 0}
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
  );
}
