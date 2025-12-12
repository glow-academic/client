"use client";

import {
  CheckCircle2,
  ChevronsUpDown,
  Download,
  FileUp,
  Map,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import type {
  CSVColumnMapping,
  ProcessedCSVRow,
} from "@/app/(main)/management/staff/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import { User } from "lucide-react";
import type {
  BulkCreateOrUpdateStaffAction,
  ProcessCSVAction,
} from "@/components/staff/Staff";
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
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
      email?: string;
      role?: string;
    }>,
  ) => void;
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
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
        .join(","),
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
    ["email", "alias", "username", "user", "login", "email address"].includes(
      lower,
    )
  ) {
    return "email";
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

// Normalize email (keep full email)
const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
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
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
}: CSVImportStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const router = useRouter();

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
      (role) => allowedRoles.includes(role) && roleOptions.includes(role),
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
    const columns: string[] = ["firstName", "lastName", "email", "role"];
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
        email: "redacted@purdue.edu",
        role: "instructional",
        ...(columns.includes("department") ? { department: "" } : {}),
        ...(columns.includes("cohort") ? { cohort: "" } : {}),
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        email: "redacted@purdue.edu",
        role: "instructional",
        ...(columns.includes("department") ? { department: "" } : {}),
        ...(columns.includes("cohort") ? { cohort: "" } : {}),
      },
      {
        firstName: "John",
        lastName: "Doe",
        email: "redacted@purdue.edu",
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
    [processedRows],
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
          const requiredFields = ["firstName", "lastName", "email"];
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
            `Error parsing CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      };
      reader.readAsText(file);
    },
    [parseCSV],
  );

  // React-dropzone hook
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
      (m) => includedColumns[m.csv_column] !== false,
    );

    // Validate that required fields are mapped
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
      // Use filtered mappings (only included columns)
      const response = await processCSVAction({
        body: {
          csv_content: csvContent,
          column_mappings: activeMappings,
        },
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
  }, [csvContent, columnMappings, includedColumns, processCSVAction]);

  // Check for duplicate aliases in review stage (check all emails)
  const duplicateAliasMap = React.useMemo(() => {
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

        // Handle arrays for department_ids, cohort_ids, and emails
        if (field === "department_ids" || field === "cohort_ids") {
          updated[field] = Array.isArray(value) ? value : [];
        } else if (field === "emails") {
          // Handle emails as array or comma-separated string
          if (Array.isArray(value)) {
            updated[field] = value;
          } else if (typeof value === "string") {
            // Parse comma-separated emails
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
    [processedRows],
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
          `Allowed roles: ${validRoles.join(", ")}`,
      );
      return;
    }

    // Validate email uniqueness within the batch (check all emails)
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
                  cohort.name.toLowerCase() === cohortIdOrName.toLowerCase(),
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
                  dept.name.toLowerCase() === deptIdOrName.toLowerCase(),
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
                  cohort.name.toLowerCase() === cohortIdOrName.toLowerCase(),
              );
              return found ? found[0] : null;
            })
            .filter((id): id is string => id !== null);
        }

        const emails = (row.emails || [])
          .map((e) => normalizeEmail(e))
          .filter((e) => e.length > 0);
        if (emails.length === 0) {
          // Fallback to empty array if no emails (shouldn't happen due to validation)
          emails.push("");
        }
        return {
          firstName: row.firstName!,
          lastName: row.lastName!,
          emails: emails,
          primary_email_index:
            row.primary_email_index !== undefined &&
            row.primary_email_index < emails.length
              ? row.primary_email_index
              : 0,
          role: row.role || "ta",
          department_ids: deptIds,
          cohort_ids: cohortIds,
        };
      });

      if (!bulkCreateOrUpdateStaffAction) {
        toast.error("Bulk create or update action not available");
        return;
      }

      const response = await bulkCreateOrUpdateStaffAction({
        body: {
          profiles,
          currentProfileId: effectiveProfile?.id || "",
        },
      });

      // Refresh data after successful update
      router.refresh();

      // When scoped, stage the profiles
      if (isScoped && onStagedProfiles && response.profileIds) {
        // Map profile IDs to profile data from valid rows
        // The profileIds array corresponds to the profiles array order
        const stagedProfiles = response.profileIds.map((profileId, index) => {
          const row = validRows[index];
          const emails = row?.emails || [];
          return {
            profileId,
            firstName: row?.firstName ?? "",
            lastName: row?.lastName ?? "",
            email: emails[0] || "",
            role: row?.role ?? "ta",
          };
        });
        onStagedProfiles(stagedProfiles);
        toast.success(
          `${response.created_count + response.updated_count} profile(s) staged. They will be added to the cohort when you click Update.`,
        );
      } else {
        toast.success(
          `Successfully processed ${response.created_count} created, ${response.updated_count} updated staff member(s)!`,
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
    bulkCreateOrUpdateStaffAction,
    router,
    onOpenChange,
    onDone,
    onStagedProfiles,
  ]);

  const validRowCount = processedRows.filter(
    (row) => row.errors.length === 0,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <div className="space-y-6" data-testid="csv-upload-stage-upload">
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-16 text-center transition-colors cursor-pointer relative",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50",
                )}
              >
                <input {...getInputProps()} data-testid="csv-file-input" />
                {/* Download Template Button - top right corner */}
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
            <div className="space-y-4" data-testid="csv-upload-stage-mapping">
              {/* Mapping Table */}
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
                      const isIncluded = includedColumns[header] !== false;

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
            <div className="space-y-4" data-testid="csv-upload-stage-review">
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
                      {(!departmentIds || departmentIds.length === 0) &&
                        validDepartmentIds.length > 1 && (
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
                          (e) => e.field === "firstName",
                        );
                        const hasLastNameError = editableRow.errors.some(
                          (e) => e.field === "lastName",
                        );
                        const hasAliasError = editableRow.errors.some(
                          (e) => e.field === "email",
                        );
                        const hasDuplicateAlias = duplicateAliasMap.has(index);
                        const hasRoleError = editableRow.errors.some(
                          (e) => e.field === "role",
                        );
                        const hasDepartmentError =
                          (!departmentIds || departmentIds.length === 0) &&
                          editableRow.errors.some(
                            (e) =>
                              e.field === "department_ids" ||
                              e.field === "department_id",
                          );
                        const hasCohortError =
                          (!cohortIds || cohortIds.length === 0) &&
                          editableRow.errors.some(
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
                                hasFirstNameError ? "bg-destructive/10" : ""
                              }
                            >
                              <Input
                                value={editableRow.firstName || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "firstName",
                                    e.target.value || null,
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
                                  (editableRow.emails || []).join(", ") || ""
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
                                  validRoles.includes(r.id)
                                )}
                                selectedIds={editableRow.role ? [editableRow.role] : []}
                                onSelect={(ids) =>
                                  updateEditableRow(
                                    index,
                                    "role",
                                    ids[0] || null,
                                  )
                                }
                                getId={(role) => role.id}
                                getLabel={(role) => role.name}
                                getSearchText={(role) => `${role.name} ${role.description || ""}`}
                                renderItem={(role, isSelected) => {
                                  const IconComponent = role.icon || User;
                                  const hexColor = role.color || "#64748b";
                                  const generateGradient = (hex: string) => {
                                    const cleanHex = hex.replace("#", "");
                                    const r = parseInt(cleanHex.substr(0, 2), 16);
                                    const g = parseInt(cleanHex.substr(2, 2), 16);
                                    const b = parseInt(cleanHex.substr(4, 2), 16);
                                    const lighterR = Math.min(255, r + 60);
                                    const lighterG = Math.min(255, g + 60);
                                    const lighterB = Math.min(255, b + 60);
                                    const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                                    return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                                  };
                                  return (
                                    <div className="flex items-center gap-3 w-full">
                                      <div
                                        className="p-2 rounded-lg shadow-lg flex-shrink-0"
                                        style={{
                                          background: generateGradient(hexColor),
                                        }}
                                      >
                                        <IconComponent className="h-4 w-4 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{role.name}</div>
                                        {role.description && (
                                          <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                            {role.description}
                                          </div>
                                        )}
                                      </div>
                                      <Check
                                        className={cn(
                                          "ml-auto",
                                          isSelected ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                    </div>
                                  );
                                }}
                                renderButton={(selectedItems, placeholder) => {
                                  if (selectedItems.length === 0) return placeholder;
                                  const role = selectedItems[0];
                                  const IconComponent = role?.icon || User;
                                  const hexColor = role?.color || "#64748b";
                                  const generateGradient = (hex: string) => {
                                    const cleanHex = hex.replace("#", "");
                                    const r = parseInt(cleanHex.substr(0, 2), 16);
                                    const g = parseInt(cleanHex.substr(2, 2), 16);
                                    const b = parseInt(cleanHex.substr(4, 2), 16);
                                    const lighterR = Math.min(255, r + 60);
                                    const lighterG = Math.min(255, g + 60);
                                    const lighterB = Math.min(255, b + 60);
                                    const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                                    return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                                  };
                                  return (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div
                                        className="p-1 rounded-md shadow-sm flex-shrink-0"
                                        style={{
                                          background: generateGradient(hexColor),
                                        }}
                                      >
                                        <IconComponent className="h-3.5 w-3.5 text-white" />
                                      </div>
                                      <span className="truncate">{role?.name || placeholder}</span>
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
                            {(!departmentIds || departmentIds.length === 0) &&
                              validDepartmentIds.length > 1 && (
                                <TableCell
                                  className={
                                    hasDepartmentError
                                      ? "bg-destructive/10"
                                      : ""
                                  }
                                >
                                  <GenericPicker
                                    items={departmentMapping}
                                    itemIds={validDepartmentIds}
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
                                    getId={(dept) => (dept as unknown as { id: string }).id}
                                    getLabel={(dept) => dept.name || ""}
                                    getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
                                    placeholder="Select departments"
                                    multiSelect={true}
                                    compact={true}
                                    hideSelectedChips={true}
                                  />
                                </TableCell>
                              )}
                            {(!cohortIds || cohortIds.length === 0) && (
                              <TableCell
                                className={
                                  hasCohortError ? "bg-destructive/10" : ""
                                }
                              >
                                <GenericPicker
                                  items={cohortMapping}
                                  itemIds={validCohortIds}
                                  selectedIds={
                                    (editableRow.cohort_ids ||
                                      row.cohort_ids ||
                                      []) as string[]
                                  }
                                  onSelect={(ids) =>
                                    updateEditableRow(index, "cohort_ids", ids)
                                  }
                                  getId={(cohort) => (cohort as unknown as { id: string }).id}
                                  getLabel={(cohort) => cohort.name || ""}
                                  getSearchText={(cohort) => `${cohort.name} ${cohort.description || ""}`}
                                  placeholder="Select cohorts"
                                  multiSelect={true}
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
                <Button variant="outline" onClick={() => setStage("mapping")}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
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
  );
}
