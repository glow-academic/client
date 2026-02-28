"use client";

import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  FileUp,
  Loader2,
  Map,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as tus from "tus-js-client";

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
  DialogDescription,
  DialogFooter,
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

export interface BulkImportProps {
  open: boolean;
  onClose: () => void;
  fields: ImportFieldDef[];
  artifactName: string;
  onSave: (items: Record<string, unknown>[]) => Promise<{ results: SaveResult[] }>;
  parseCsvAction: (input: { body: { upload_id: string } }) => Promise<{
    headers: string[];
    rows: string[][];
    row_count: number;
  }>;
}

type Stage = "upload" | "map" | "review";

const IGNORE_VALUE = "__ignore__";

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

// ---- ColumnPicker combobox ----

function ColumnPicker({
  value,
  fields,
  usedKeys,
  onChange,
}: {
  value: string;
  fields: ImportFieldDef[];
  usedKeys: Set<string>;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedField = fields.find((f) => f.key === value);
  const displayLabel =
    value === IGNORE_VALUE || !selectedField ? "(Ignore)" : selectedField.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={IGNORE_VALUE}
                onSelect={() => {
                  onChange(IGNORE_VALUE);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === IGNORE_VALUE ? "opacity-100" : "opacity-0"
                  )}
                />
                (Ignore)
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Fields">
              {fields.map((f) => {
                const isSelected = value === f.key;
                const isUsed = usedKeys.has(f.key) && !isSelected;
                return (
                  <CommandItem
                    key={f.key}
                    value={f.key}
                    disabled={isUsed}
                    onSelect={() => {
                      onChange(f.key);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>
                        {f.label}
                        {f.required && <span className="text-destructive ml-1">*</span>}
                      </span>
                      {f.description && (
                        <span className="text-xs text-muted-foreground">{f.description}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---- Stepper ----

const STEPS: { key: Stage; label: string; icon: typeof FileUp }[] = [
  { key: "upload", label: "Upload", icon: FileUp },
  { key: "map", label: "Map Columns", icon: Map },
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
  const [uploadProgress, setUploadProgress] = useState(0);

  // Map stage
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<number, string>>({}); // csvColIndex -> fieldKey | IGNORE_VALUE
  const [included, setIncluded] = useState<Record<number, boolean>>({}); // csvColIndex -> included

  // Review stage
  const [editedData, setEditedData] = useState<Record<string, unknown>[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResults, setSaveResults] = useState<SaveResult[] | null>(null);

  // ---- Reset ----
  const reset = useCallback(() => {
    setStage("upload");
    setFileName(null);
    setIsUploading(false);
    setUploadProgress(0);
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings({});
    setIncluded({});
    setEditedData([]);
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
    const headerRow: Record<string, string> = {};
    const exampleRow: Record<string, string> = {};
    for (const f of fields) {
      headerRow[f.label] = f.label;
      exampleRow[f.label] = f.example ?? "";
    }
    const csv = unparseCSV([exampleRow]);
    // Prepend header manually since unparseCSV uses keys as headers which are already labels
    downloadCSV(csv, `${artifactName.toLowerCase()}_template.csv`);
  }, [fields, artifactName]);

  // ---- Upload stage ----
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setFileName(file.name);
      setIsUploading(true);
      setUploadProgress(0);

      try {
        // TUS upload
        const uploadId = await new Promise<string>((resolve, reject) => {
          const upload = new tus.Upload(file, {
            endpoint: "/api/uploads",
            retryDelays: [0, 3000, 5000],
            metadata: {
              filename: file.name,
              filetype: file.type || "text/csv",
            },
            onProgress: (bytesUploaded, bytesTotal) => {
              setUploadProgress(Math.round((bytesUploaded / bytesTotal) * 100));
            },
            onSuccess: async () => {
              const url = upload.url || "";
              const match = url.match(/\/uploads\/([^/]+)$/);
              if (!match?.[1]) {
                reject(new Error("Failed to extract upload ID"));
                return;
              }
              const tusId = match[1];

              // Finalize
              try {
                const finalizeRes = await fetch(
                  `/api/uploads/${tusId}/finalize`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
                );
                const finalizeData = await finalizeRes.json();
                if (!finalizeData.success || !finalizeData.upload_id) {
                  reject(new Error(finalizeData.message || "Finalize failed"));
                  return;
                }
                resolve(finalizeData.upload_id);
              } catch (err) {
                reject(err);
              }
            },
            onError: (error) => reject(error),
          });
          upload.start();
        });

        // Parse CSV via server action
        const parsed = await parseCsvAction({ body: { upload_id: uploadId } });
        setCsvHeaders(parsed.headers);
        setCsvRows(parsed.rows);

        // Auto-map by fuzzy matching
        const autoMappings: Record<number, string> = {};
        const autoIncluded: Record<number, boolean> = {};
        parsed.headers.forEach((header, idx) => {
          const normalized = header.toLowerCase().trim().replace(/[_\s-]+/g, "");
          const matched = fields.find((f) => {
            const fKey = f.key.toLowerCase().replace(/[_\s-]+/g, "");
            const fLabel = f.label.toLowerCase().replace(/[_\s-]+/g, "");
            return fKey === normalized || fLabel === normalized;
          });
          if (matched) {
            autoMappings[idx] = matched.key;
            autoIncluded[idx] = true;
          } else {
            autoMappings[idx] = IGNORE_VALUE;
            autoIncluded[idx] = false;
          }
        });
        setMappings(autoMappings);
        setIncluded(autoIncluded);
        setStage("map");
      } catch (err) {
        toast.error("Upload failed", {
          description: err instanceof Error ? err.message : "An error occurred",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [fields, parseCsvAction]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: isUploading,
    noClick: true,
    noKeyboard: true,
  });

  // ---- Map stage ----
  const updateMapping = useCallback((colIndex: number, fieldKey: string) => {
    setMappings((prev) => ({ ...prev, [colIndex]: fieldKey }));
    // Auto-include when a real field is selected
    if (fieldKey !== IGNORE_VALUE) {
      setIncluded((prev) => ({ ...prev, [colIndex]: true }));
    }
  }, []);

  const toggleInclude = useCallback((colIndex: number, checked: boolean) => {
    setIncluded((prev) => ({ ...prev, [colIndex]: checked }));
  }, []);

  const mappedFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    Object.entries(mappings).forEach(([colIdxStr, fieldKey]) => {
      const colIdx = parseInt(colIdxStr, 10);
      if (fieldKey !== IGNORE_VALUE && included[colIdx]) {
        keys.add(fieldKey);
      }
    });
    return keys;
  }, [mappings, included]);

  const allRequiredMapped = useMemo(
    () => fields.filter((f) => f.required).every((f) => mappedFieldKeys.has(f.key)),
    [fields, mappedFieldKeys]
  );

  // ---- Review stage: build data from CSV + mappings ----
  const buildMappedData = useCallback(() => {
    return csvRows.map((row) => {
      const item: Record<string, unknown> = {};
      Object.entries(mappings).forEach(([colIdxStr, fieldKey]) => {
        const colIdx = parseInt(colIdxStr, 10);
        if (fieldKey === IGNORE_VALUE || !included[colIdx]) return;
        const field = fields.find((f) => f.key === fieldKey);
        const raw = row[colIdx]?.trim() ?? "";
        if (!raw) return;

        if (field?.multi) {
          item[fieldKey] = raw.split(",").map((s) => s.trim()).filter(Boolean);
        } else if (field?.type === "boolean") {
          const lower = raw.toLowerCase();
          item[fieldKey] = lower === "true" || lower === "yes" || lower === "1";
        } else {
          item[fieldKey] = raw;
        }
      });
      return item;
    });
  }, [csvRows, mappings, included, fields]);

  const goToReview = useCallback(() => {
    const data = buildMappedData();
    setEditedData(data);
    setStage("review");
  }, [buildMappedData]);

  const mappedFields = useMemo(
    () => fields.filter((f) => mappedFieldKeys.has(f.key)),
    [fields, mappedFieldKeys]
  );

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import {artifactName} from CSV</DialogTitle>
          <DialogDescription>
            {stage === "upload" && "Upload a CSV file to import records in bulk."}
            {stage === "map" && "Map each CSV column to a destination field."}
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
                    Uploading {fileName}... {uploadProgress}%
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

          {/* ---- Map Stage ---- */}
          {stage === "map" && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Your File Column</TableHead>
                    <TableHead className="w-[180px]">Your Sample Data</TableHead>
                    <TableHead>Destination Column</TableHead>
                    <TableHead className="w-[80px] text-center">Include</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header, idx) => {
                    const sample = csvRows
                      .slice(0, 3)
                      .map((r) => r[idx])
                      .filter(Boolean)
                      .join(", ");
                    const currentMapping = mappings[idx] || IGNORE_VALUE;
                    const isIncluded = included[idx] ?? false;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[180px]">
                          <span className="truncate block">
                            {sample.length > 30 ? `${sample.slice(0, 30)}...` : sample || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ColumnPicker
                            value={currentMapping}
                            fields={fields}
                            usedKeys={mappedFieldKeys}
                            onChange={(key) => updateMapping(idx, key)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isIncluded && currentMapping !== IGNORE_VALUE}
                            disabled={currentMapping === IGNORE_VALUE}
                            onCheckedChange={(checked) => toggleInclude(idx, !!checked)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!allRequiredMapped && (
                <p className="text-sm text-destructive">
                  All required fields must be mapped:{" "}
                  {fields
                    .filter((f) => f.required && !mappedFieldKeys.has(f.key))
                    .map((f) => f.label)
                    .join(", ")}
                </p>
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
          {stage === "upload" && (
            <Button disabled>
              Next
            </Button>
          )}

          {stage === "map" && (
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setStage("upload");
              }}
              className="mr-auto"
            >
              Back
            </Button>
          )}
          {stage === "map" && (
            <Button onClick={goToReview} disabled={!allRequiredMapped}>
              Continue to Review
            </Button>
          )}

          {stage === "review" && !saveResults && (
            <Button variant="ghost" onClick={() => setStage("map")} className="mr-auto">
              Back
            </Button>
          )}
          {stage === "review" && !saveResults && (
            <Button onClick={handleSave} disabled={isSaving || editedData.length === 0}>
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
