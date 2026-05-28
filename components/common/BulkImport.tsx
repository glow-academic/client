"use client";

import {
  Check,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ---- Types ----

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  multi?: boolean;
  type?: string;
  example?: string;
  description?: string;
}

interface SaveResult {
  success: boolean;
  message: string;
  errors?: Array<{ field: string; message: string }> | null;
  [key: string]: unknown;
}

export interface ParseCsvResult {
  items: Record<string, unknown>[];
  mapped_fields: string[];
  row_count: number;
}

export interface BulkImportProps {
  open: boolean;
  onClose: () => void;
  fields: ImportFieldDef[];
  artifactName: string;
  onSave: (items: Record<string, unknown>[]) => Promise<{ results: SaveResult[] }>;
  parseCsvAction: (formData: FormData) => Promise<ParseCsvResult>;
}

type Stage = "upload" | "review";

// ---- CSV helpers ----

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function unparseCSV(rows: Record<string, string>[]): string {
  if (rows.length === 0) return "";
  const first = rows[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const lines = [
    headers.map(escapeCSVField).join(","),
    ...rows.map((row) => headers.map((h) => escapeCSVField(row[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Stepper ----

const STEPS: { key: Stage; label: string; icon: typeof FileUp }[] = [
  { key: "upload", label: "Upload", icon: FileUp },
  { key: "review", label: "Review", icon: CheckCircle2 },
];

function Stepper({ currentStage }: { currentStage: Stage }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStage);

  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const isActive = idx <= currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center">
            {idx > 0 && (
              <div
                className={cn(
                  "h-1 w-16",
                  idx <= currentIdx ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isActive ? <Icon className="h-4 w-4" /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isActive ? "font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Main Component ----

export default function BulkImport({
  open,
  onClose,
  fields,
  artifactName,
  onSave,
  parseCsvAction,
}: BulkImportProps) {
  // Stage
  const [stage, setStage] = useState<Stage>("upload");

  // Upload stage
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Review stage
  const [editedData, setEditedData] = useState<Record<string, unknown>[]>([]);
  const [serverMappedFieldKeys, setServerMappedFieldKeys] = useState<string[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<SaveResult[] | null>(null);

  // ---- Derived ----
  const mappedFieldKeys = useMemo(() => new Set(serverMappedFieldKeys), [serverMappedFieldKeys]);

  const mappedFields = useMemo(
    () => fields.filter((f) => mappedFieldKeys.has(f.key)),
    [fields, mappedFieldKeys]
  );

  // ---- Reset ----
  const reset = useCallback(() => {
    setStage("upload");
    setFileName(null);
    setIsUploading(false);
    setEditedData([]);
    setServerMappedFieldKeys([]);
    setShowErrorsOnly(false);
    setIsSaving(false);
    setSaveResults(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // ---- Template download ----
  const handleDownloadTemplate = useCallback(() => {
    const exampleRow: Record<string, string> = {};
    for (const f of fields) {
      exampleRow[f.label] = f.example ?? "";
    }
    const csv = unparseCSV([exampleRow]);
    downloadCSV(csv, `${artifactName.toLowerCase()}_template.csv`);
  }, [fields, artifactName]);

  // ---- Upload stage ----
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await parseCsvAction(formData);

        setEditedData(result.items as Record<string, unknown>[]);
        setServerMappedFieldKeys(result.mapped_fields);
        setStage("review");
      } catch (err) {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "An error occurred",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [parseCsvAction]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: isUploading,
    noClick: true,
    noKeyboard: true,
  });

  // ---- Inline editing in review ----
  const updateCell = useCallback((rowIdx: number, fieldKey: string, value: unknown) => {
    setEditedData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [fieldKey]: value };
      return next;
    });
  }, []);

  // ---- Validation ----
  const rowErrors = useMemo(() => {
    return editedData.map((item) => {
      const errors: Record<string, string> = {};
      for (const f of fields) {
        if (f.required && mappedFieldKeys.has(f.key)) {
          const val = item[f.key];
          if (val === undefined || val === null || val === "") {
            errors[f.key] = "Required";
          }
        }
      }
      return errors;
    });
  }, [editedData, fields, mappedFieldKeys]);

  const errorRowIndices = useMemo(
    () => rowErrors.reduce<number[]>((acc, errs, idx) => {
      if (Object.keys(errs).length > 0) acc.push(idx);
      return acc;
    }, []),
    [rowErrors]
  );

  const displayedRows = useMemo(() => {
    if (!showErrorsOnly) return editedData.map((item, idx) => ({ item, idx }));
    return errorRowIndices.map((idx) => ({ item: editedData[idx], idx }));
  }, [editedData, showErrorsOnly, errorRowIndices]);

  // ---- Save ----
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await onSave(editedData);
      setSaveResults(result.results);
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  }, [editedData, onSave]);

  const successCount = saveResults?.filter((r) => r.success).length ?? 0;
  const failCount = saveResults?.filter((r) => !r.success).length ?? 0;

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);

  // ---- Render ----
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        data-testid="dialog-bulk-import"
      >
        <DialogHeader>
          <DialogTitle>Import {artifactName} from CSV</DialogTitle>
          <DialogDescription>
            {stage === "upload" && "Upload a CSV file to import records in bulk."}
            {stage === "review" && !saveResults && `${editedData.length} rows ready to import.`}
            {stage === "review" && saveResults && `${successCount} succeeded, ${failCount} failed.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stepper */}
          <Stepper currentStage={stage} />

          {/* ---- Upload Stage ---- */}
          {stage === "upload" && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors relative",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
                isUploading && "pointer-events-none opacity-60"
              )}
            >
              <input {...getInputProps()} />
              {/* Download Template button */}
              <Button
                variant="outline"
                size="sm"
                className="absolute top-4 right-4"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate();
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>

              {isUploading ? (
                <div className="space-y-3">
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Uploading {fileName}...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <UploadIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop a .csv file here, or{" "}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFileDialog();
                      }}
                    >
                      browse
                    </button>
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 pt-2">
                    {requiredFields.length > 0 && (
                      <p>
                        <span className="font-medium">Required:</span>{" "}
                        {requiredFields.map((f) => f.label).join(", ")}
                      </p>
                    )}
                    {optionalFields.length > 0 && (
                      <p>
                        <span className="font-medium">Optional:</span>{" "}
                        {optionalFields.map((f) => f.label).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Review Stage ---- */}
          {stage === "review" && !saveResults && (
            <div className="space-y-4">
              {/* Error toggle */}
              {errorRowIndices.length > 0 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-errors"
                    checked={showErrorsOnly}
                    onCheckedChange={setShowErrorsOnly}
                  />
                  <Label htmlFor="show-errors">
                    Show rows with errors ({errorRowIndices.length})
                  </Label>
                </div>
              )}

              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      {mappedFields.map((f) => (
                        <TableHead key={f.key}>
                          {f.label}
                          {f.required && <span className="text-destructive ml-1">*</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedRows.map(({ item, idx: rowIdx }) => {
                      if (!item) return null;
                      return (
                      <TableRow key={rowIdx}>
                        <TableCell className="text-muted-foreground">{rowIdx + 1}</TableCell>
                        {mappedFields.map((f) => {
                          const val = item[f.key];
                          const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
                          const hasError = !!rowErrors[rowIdx]?.[f.key];
                          return (
                            <TableCell
                              key={f.key}
                              className={cn(hasError && "bg-destructive/10")}
                            >
                              <Input
                                value={display}
                                className={cn(
                                  "h-8 text-xs",
                                  hasError && "border-destructive"
                                )}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  if (f.multi) {
                                    updateCell(
                                      rowIdx,
                                      f.key,
                                      newVal.split(",").map((s) => s.trim()).filter(Boolean)
                                    );
                                  } else if (f.type === "boolean") {
                                    const lower = newVal.toLowerCase();
                                    updateCell(
                                      rowIdx,
                                      f.key,
                                      lower === "true" || lower === "yes" || lower === "1"
                                    );
                                  } else {
                                    updateCell(rowIdx, f.key, newVal);
                                  }
                                }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ---- Results Stage ---- */}
          {stage === "review" && saveResults && (
            <div className="overflow-auto max-h-96 space-y-2">
              {saveResults.map((r, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 p-3 rounded-md text-sm",
                    r.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                  )}
                >
                  {r.success ? (
                    <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">Row {idx + 1}:</span> {r.message}
                    {r.errors && Array.isArray(r.errors) && r.errors.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {r.errors.map((e, eIdx) => (
                          <div key={eIdx} className="text-xs text-muted-foreground">
                            {e.field}: {e.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Footer ---- */}
        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          {stage === "upload" && (
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {stage === "review" && !saveResults && (
            <Button variant="ghost" onClick={() => { reset(); setStage("upload"); }} className="mr-auto">
              Back
            </Button>
          )}
          {stage === "review" && !saveResults && (
            <Button
              onClick={handleSave}
              disabled={isSaving || editedData.length === 0}
              data-testid="btn-confirm-import"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>Import {artifactName}</>
              )}
            </Button>
          )}
          {stage === "review" && saveResults && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
