"use client";

import { AlertCircle, CheckCircle2, FileUp, Map, Upload } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export interface CSVImportStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId?: string;
  cohortId?: string;
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  cohortMapping: Record<string, { name: string; description: string }>;
  validCohortIds: string[];
  roleOptions: string[];
  onDone?: () => void;
}

type Stage = "upload" | "mapping" | "review";

const TARGET_FIELDS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "alias", label: "Alias/Email" },
  { value: "role", label: "Role" },
  { value: "department", label: "Department" },
  { value: "cohort", label: "Cohort" },
] as const;

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

export default function CSVImportStaffModal({
  open,
  onOpenChange,
  departmentId,
  cohortId,
  departmentMapping,
  validDepartmentIds,
  cohortMapping,
  validCohortIds,
  roleOptions,
  onDone,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    }
  }, [open]);

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
    // Validate that required fields are mapped
    const requiredFields = ["firstName", "lastName", "alias"];
    const mappedFields = columnMappings
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
      const response = await processCSVMutation.mutateAsync({
        csv_content: csvContent,
        column_mappings: columnMappings,
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
  }, [csvContent, columnMappings, processCSVMutation, log]);

  // Update editable row
  const updateEditableRow = useCallback(
    (rowIndex: number, field: string, value: string | null) => {
      setEditableRows((prev) => {
        const current = prev[rowIndex] || processedRows[rowIndex];
        if (!current) return prev;

        const updated = { ...current };
        (updated as any)[field] = value;

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
      // Convert rows to profiles
      const profiles = validRows.map((row) => {
        // Resolve department/cohort IDs from names if needed
        let deptId = row.department_id;
        if (deptId && !validDepartmentIds.includes(deptId)) {
          // Try to find by name
          const found = Object.entries(departmentMapping).find(
            ([_, dept]) => dept.name.toLowerCase() === deptId.toLowerCase()
          );
          deptId = found ? found[0] : null;
        }
        if (!deptId && departmentId) {
          deptId = departmentId;
        }

        let cohortIdValue = row.cohort_id;
        if (cohortIdValue && !validCohortIds.includes(cohortIdValue)) {
          // Try to find by name
          const found = Object.entries(cohortMapping).find(
            ([_, cohort]) =>
              cohort.name.toLowerCase() === cohortIdValue!.toLowerCase()
          );
          cohortIdValue = found ? found[0] : null;
        }
        if (!cohortIdValue && cohortId) {
          cohortIdValue = cohortId;
        }

        return {
          firstName: row.firstName!,
          lastName: row.lastName!,
          alias: extractAliasFromEmail(row.alias || ""),
          role: row.role || "ta",
          department_id: deptId || null,
          cohort_id: cohortIdValue || null,
        };
      });

      const response = await bulkCreateOrUpdateMutation.mutateAsync({
        profiles,
      });

      toast.success(
        `Successfully processed ${response.created_count} created, ${response.updated_count} updated staff member(s)!`
      );

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
    departmentId,
    cohortId,
    bulkCreateOrUpdateMutation,
    onOpenChange,
    onDone,
    log,
  ]);

  const hasErrors = processedRows.some((row) => row.errors.length > 0);
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
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose CSV File
                </Button>
              </div>
            </div>
          )}

          {/* Stage 2: Mapping */}
          {stage === "mapping" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Map CSV Columns to Fields</Label>
                <p className="text-sm text-muted-foreground">
                  Select which CSV column maps to each required field. Required
                  fields: First Name, Last Name, Alias.
                </p>
              </div>

              <div className="space-y-3">
                {csvHeaders.map((header) => {
                  const mapping = columnMappings.find(
                    (m) => m.csv_column === header
                  );
                  const targetField = mapping?.target_field || null;

                  return (
                    <div key={header} className="flex items-center gap-4">
                      <div className="w-48 text-sm font-medium">{header}</div>
                      <div className="flex-1">
                        <Select
                          value={targetField || ""}
                          onValueChange={(value) => {
                            setColumnMappings((prev) =>
                              prev.map((m) =>
                                m.csv_column === header
                                  ? { ...m, target_field: value || null }
                                  : m
                              )
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">(Ignore)</SelectItem>
                            {TARGET_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {targetField && (
                        <Badge variant="secondary" className="text-xs">
                          {
                            TARGET_FIELDS.find((f) => f.value === targetField)
                              ?.label
                          }
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Preview */}
              {csvRows.length > 0 && (
                <div className="mt-6">
                  <Label>Preview (first 3 rows)</Label>
                  <div className="mt-2 rounded-md border max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {csvHeaders.map((header) => (
                            <TableHead key={header}>{header}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvRows.slice(0, 3).map((row, idx) => (
                          <TableRow key={idx}>
                            {csvHeaders.map((header) => (
                              <TableCell key={header}>
                                {row[header] || ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
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
                <div>
                  <Label>Review Import Data</Label>
                  <p className="text-sm text-muted-foreground">
                    {validRowCount} valid row(s),{" "}
                    {processedRows.length - validRowCount} with errors
                  </p>
                </div>
                {hasErrors && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {processedRows.length - validRowCount} errors
                  </Badge>
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
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRows.map((row, index) => {
                      const editableRow = editableRows[index] || row;
                      const hasRowErrors = editableRow.errors.length > 0;

                      return (
                        <TableRow
                          key={index}
                          className={hasRowErrors ? "bg-destructive/10" : ""}
                        >
                          <TableCell>{row.row_index}</TableCell>
                          <TableCell>
                            {hasRowErrors &&
                            editableRow.errors.some(
                              (e) => e.field === "firstName"
                            ) ? (
                              <Input
                                value={editableRow.firstName || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "firstName",
                                    e.target.value || null
                                  )
                                }
                                className="h-8 w-32 border-red-500"
                              />
                            ) : (
                              editableRow.firstName || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {hasRowErrors &&
                            editableRow.errors.some(
                              (e) => e.field === "lastName"
                            ) ? (
                              <Input
                                value={editableRow.lastName || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "lastName",
                                    e.target.value || null
                                  )
                                }
                                className="h-8 w-32 border-red-500"
                              />
                            ) : (
                              editableRow.lastName || "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {hasRowErrors &&
                            editableRow.errors.some(
                              (e) => e.field === "alias"
                            ) ? (
                              <Input
                                value={editableRow.alias || ""}
                                onChange={(e) =>
                                  updateEditableRow(
                                    index,
                                    "alias",
                                    e.target.value || null
                                  )
                                }
                                className="h-8 w-32 border-red-500"
                              />
                            ) : (
                              editableRow.alias || "-"
                            )}
                          </TableCell>
                          <TableCell>{editableRow.role || "-"}</TableCell>
                          <TableCell>
                            {editableRow.department_id
                              ? departmentMapping[editableRow.department_id]
                                  ?.name || editableRow.department_id
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {editableRow.cohort_id
                              ? cohortMapping[editableRow.cohort_id]?.name ||
                                editableRow.cohort_id
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {editableRow.errors.length > 0 ? (
                              <div className="space-y-1">
                                {editableRow.errors.map((error, errIdx) => (
                                  <div
                                    key={errIdx}
                                    className="text-xs text-red-500"
                                  >
                                    {error.message}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2 pt-4">
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
