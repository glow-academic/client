"use client";

import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as tus from "tus-js-client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ---- Types ----

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  multi?: boolean;
  type?: string;
}

interface SaveResult {
  success: boolean;
  message: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface BulkImportProps {
  open: boolean;
  onClose: () => void;
  fields: ImportFieldDef[];
  onSave: (items: Record<string, unknown>[]) => Promise<{ results: SaveResult[] }>;
  parseCsvAction: (input: { body: { upload_id: string } }) => Promise<{
    headers: string[];
    rows: string[][];
    row_count: number;
  }>;
}

type Stage = "upload" | "map" | "review";

const SKIP_VALUE = "__skip__";

export default function BulkImport({
  open,
  onClose,
  fields,
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
  const [mappings, setMappings] = useState<Record<number, string>>({}); // csvColIndex -> fieldKey

  // Review/save stage
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
    setIsSaving(false);
    setSaveResults(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

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
        parsed.headers.forEach((header, idx) => {
          const normalized = header.toLowerCase().trim().replace(/[_\s-]+/g, "");
          const matched = fields.find((f) => {
            const fKey = f.key.toLowerCase().replace(/[_\s-]+/g, "");
            const fLabel = f.label.toLowerCase().replace(/[_\s-]+/g, "");
            return fKey === normalized || fLabel === normalized;
          });
          if (matched) {
            autoMappings[idx] = matched.key;
          }
        });
        setMappings(autoMappings);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: isUploading,
  });

  // ---- Map stage ----
  const updateMapping = useCallback((colIndex: number, fieldKey: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (fieldKey === SKIP_VALUE) {
        delete next[colIndex];
      } else {
        next[colIndex] = fieldKey;
      }
      return next;
    });
  }, []);

  const mappedFieldKeys = useMemo(
    () => new Set(Object.values(mappings)),
    [mappings]
  );

  const allRequiredMapped = useMemo(
    () => fields.filter((f) => f.required).every((f) => mappedFieldKeys.has(f.key)),
    [fields, mappedFieldKeys]
  );

  // ---- Review stage ----
  const mappedData = useMemo(() => {
    if (stage !== "review") return [];
    return csvRows.map((row) => {
      const item: Record<string, unknown> = {};
      Object.entries(mappings).forEach(([colIdxStr, fieldKey]) => {
        const colIdx = parseInt(colIdxStr, 10);
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
  }, [stage, csvRows, mappings, fields]);

  const mappedFields = useMemo(
    () => fields.filter((f) => mappedFieldKeys.has(f.key)),
    [fields, mappedFieldKeys]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await onSave(mappedData);
      setSaveResults(result.results);
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  }, [mappedData, onSave]);

  const successCount = saveResults?.filter((r) => r.success).length ?? 0;
  const failCount = saveResults?.filter((r) => !r.success).length ?? 0;

  // ---- Render ----
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {stage === "upload" && "Import CSV"}
            {stage === "map" && "Map Columns"}
            {stage === "review" && (saveResults ? "Import Results" : "Review & Import")}
          </DialogTitle>
          <DialogDescription>
            {stage === "upload" && "Upload a CSV file to import records in bulk."}
            {stage === "map" && "Map each CSV column to a field, or skip it."}
            {stage === "review" && !saveResults && `${csvRows.length} rows ready to import.`}
            {stage === "review" && saveResults && `${successCount} succeeded, ${failCount} failed.`}
          </DialogDescription>
        </DialogHeader>

        {/* ---- Upload Stage ---- */}
        {stage === "upload" && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="space-y-3">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Uploading {fileName}... {uploadProgress}%
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a .csv file here, or click to browse
                </p>
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
                  <TableHead className="w-[200px]">CSV Column</TableHead>
                  <TableHead className="w-[200px]">Sample Values</TableHead>
                  <TableHead>Map To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvHeaders.map((header, idx) => {
                  const samples = csvRows
                    .slice(0, 3)
                    .map((r) => r[idx])
                    .filter(Boolean)
                    .join(", ");
                  const currentMapping = mappings[idx] || SKIP_VALUE;
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {samples || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={currentMapping}
                          onValueChange={(val) => updateMapping(idx, val)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SKIP_VALUE}>Skip</SelectItem>
                            {fields.map((f) => (
                              <SelectItem
                                key={f.key}
                                value={f.key}
                                disabled={mappedFieldKeys.has(f.key) && mappings[idx] !== f.key}
                              >
                                {f.label}
                                {f.required ? " *" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  {mappedFields.map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedData.map((item, rowIdx) => (
                  <TableRow key={rowIdx}>
                    <TableCell className="text-muted-foreground">{rowIdx + 1}</TableCell>
                    {mappedFields.map((f) => {
                      const val = item[f.key];
                      const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
                      return (
                        <TableCell key={f.key} className="text-xs truncate max-w-[150px]">
                          {display || "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ---- Results Stage ---- */}
        {stage === "review" && saveResults && (
          <div className="overflow-auto max-h-[400px] space-y-2">
            {saveResults.map((r, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                  r.success ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                }`}
              >
                {r.success ? (
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <span className="font-medium">Row {idx + 1}:</span> {r.message}
                  {r.errors && r.errors.length > 0 && (
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

        {/* ---- Footer ---- */}
        <DialogFooter className="gap-2 sm:gap-0">
          {stage === "map" && (
            <Button variant="ghost" onClick={() => { reset(); setStage("upload"); }} className="mr-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
          {stage === "review" && !saveResults && (
            <Button variant="ghost" onClick={() => setStage("map")} className="mr-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          {stage === "map" && (
            <Button onClick={() => setStage("review")} disabled={!allRequiredMapped}>
              Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {stage === "review" && !saveResults && (
            <Button onClick={handleSave} disabled={isSaving || mappedData.length === 0}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import {mappedData.length} rows
                </>
              )}
            </Button>
          )}
          {stage === "review" && saveResults && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
