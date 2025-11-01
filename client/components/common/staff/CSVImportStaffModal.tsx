"use client";

import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  FileUp,
  Map,
  Upload,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
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
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useBulkCreateOrUpdateStaff,
  useProcessCSV,
} from "@/lib/api/v2/hooks/profile";
import {
  CSVColumnMapping,
  ProcessedCSVRow,
} from "@/lib/api/v2/schemas/profile";
import { cn } from "@/lib/utils";

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
  const log = useLogger();
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast.error("Please upload a CSV file.");
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
      log.error("csv.process.failed", {
        message: "Error processing CSV",
        error,
        context: {
          component: "CSVImportStaffModal",
          function: "handleProcessCSV",
        },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [csvContent, columnMappings, includedColumns, processCSVMutation, log]);

  // Update editable row
  const updateEditableRow = useCallback(
    (rowIndex: number, field: string, value: string | null) => {
      setEditableRows((prev) => {
        const current = prev[rowIndex] || processedRows[rowIndex];
        if (!current) return prev;

        const updated = { ...current } as ProcessedCSVRow &
          Record<string, string | null>;
        updated[field] = value;

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

    setIsSubmitting(true);
    try {
      // Determine if scoped (staging mode)
      const isScoped = !!(departmentIds?.length || cohortIds?.length);

      // Convert rows to profiles
      const profiles = validRows.map((row) => {
        // Resolve department/cohort IDs from names if needed
        let deptId: string | null = row.department_id || null;
        if (deptId && !validDepartmentIds.includes(deptId)) {
          // Try to find by name
          const found = Object.entries(departmentMapping).find(
            ([_, dept]) => dept.name.toLowerCase() === deptId!.toLowerCase()
          );
          deptId = found ? found[0] : null;
        }
        if (!deptId && departmentIds && departmentIds.length > 0) {
          deptId = departmentIds[0] || null;
        }

        // When scoped, don't add to cohort yet (staging mode)
        let cohortIdValue: string | null = null;
        if (!isScoped) {
          // Not scoped: allow cohort assignment
          cohortIdValue = row.cohort_id || null;
          if (cohortIdValue && !validCohortIds.includes(cohortIdValue)) {
            // Try to find by name
            const found = Object.entries(cohortMapping).find(
              ([_, cohort]) =>
                cohort.name.toLowerCase() === cohortIdValue!.toLowerCase()
            );
            cohortIdValue = found ? found[0] : null;
          }
        }
        // When scoped, cohort_id stays null (staging)

        return {
          firstName: row.firstName!,
          lastName: row.lastName!,
          alias: extractAliasFromEmail(row.alias || ""),
          role: row.role || "ta",
          department_id: deptId,
          cohort_id: cohortIdValue,
        };
      });

      const response = await bulkCreateOrUpdateMutation.mutateAsync({
        profiles,
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
      log.error("csv.bulk_create_or_update.failed", {
        message: "Error creating or updating staff from CSV",
        error,
        context: { component: "CSVImportStaffModal", function: "handleSubmit" },
      });
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
    departmentIds,
    cohortIds,
    bulkCreateOrUpdateMutation,
    onOpenChange,
    onDone,
    onStagedProfiles,
    log,
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
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a CSV file with staff information. Required columns:
                  First Name, Last Name, Alias/Email.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose CSV File
                  </Button>
                </div>
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
                      <TableHead>Department</TableHead>
                      <TableHead>Cohort</TableHead>
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
                        const hasRoleError = editableRow.errors.some(
                          (e) => e.field === "role"
                        );
                        const hasDepartmentError = editableRow.errors.some(
                          (e) => e.field === "department_id"
                        );
                        const hasCohortError = editableRow.errors.some(
                          (e) => e.field === "cohort_id"
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
                                hasAliasError ? "bg-destructive/10" : ""
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
                                roleOptions={roleOptions}
                                placeholder="Select role"
                                buttonClassName="h-8"
                              />
                            </TableCell>
                            <TableCell
                              className={
                                hasDepartmentError ? "bg-destructive/10" : ""
                              }
                            >
                              {!departmentIds || departmentIds.length === 0 ? (
                                <DepartmentPicker
                                  mapping={departmentMapping}
                                  validIds={validDepartmentIds}
                                  selectedIds={
                                    editableRow.department_id
                                      ? [editableRow.department_id]
                                      : []
                                  }
                                  onSelect={(ids) =>
                                    updateEditableRow(
                                      index,
                                      "department_id",
                                      ids[0] || null
                                    )
                                  }
                                  placeholder="Select department"
                                  multiSelect={false}
                                  compact={true}
                                />
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {departmentMapping[departmentIds[0]!]?.name ||
                                    departmentIds[0]}
                                </div>
                              )}
                            </TableCell>
                            <TableCell
                              className={
                                hasCohortError ? "bg-destructive/10" : ""
                              }
                            >
                              {!cohortIds || cohortIds.length === 0 ? (
                                <CohortPicker
                                  mapping={cohortMapping}
                                  validIds={validCohortIds}
                                  selectedIds={
                                    editableRow.cohort_id
                                      ? [editableRow.cohort_id]
                                      : []
                                  }
                                  onSelect={(ids) =>
                                    updateEditableRow(
                                      index,
                                      "cohort_id",
                                      ids[0] || null
                                    )
                                  }
                                  placeholder="Select cohort"
                                  multiSelect={false}
                                />
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  {cohortMapping[cohortIds[0]!]?.name ||
                                    cohortIds[0]}
                                </div>
                              )}
                            </TableCell>
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
