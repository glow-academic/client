"use client";

import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { TagSelector } from "@/components/common/tags/TagSelector";
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
import { DocumentType } from "@/types";
import { inferMimeFromName } from "@/utils/mime-map";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { extractKnownTagsFromDocuments } from "@/utils/tags/search-tags";

export type FileClassification = {
  type: DocumentType;
  tags: string[];
};

export interface UploadClassificationDialogProps {
  open: boolean;
  files: File[];
  onClose: () => void;
  onConfirm: (
    perFile: Record<string, FileClassification>,
    defaultsForZip: FileClassification
  ) => void;
  onAddFiles?: (files: File[]) => void;
  onRemoveFile?: (fileName: string) => void;
}

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "homework", label: "📚 Homework" },
  { value: "project", label: "🎯 Project" },
  { value: "quiz", label: "❓ Quiz" },
  { value: "midterm", label: "📝 Midterm" },
  { value: "lab", label: "🧪 Lab" },
  { value: "lecture", label: "📖 Lecture" },
  { value: "syllabus", label: "📋 Syllabus" },
];

export function UploadClassificationDialog({
  open,
  files,
  onClose,
  onConfirm,
  onAddFiles,
  onRemoveFile,
}: UploadClassificationDialogProps) {
  const { data: existingDocuments = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const knownTags = React.useMemo(
    () => extractKnownTagsFromDocuments(existingDocuments),
    [existingDocuments]
  );

  // Per-file classification state (keyed by file.name)
  const [perFile, setPerFile] = React.useState<
    Record<string, FileClassification>
  >({});
  const [zipDefaults, setZipDefaults] = React.useState<FileClassification>({
    type: "homework",
    tags: [],
  });
  // Additive apply-to-all temporary tags displayed below the input
  const [applyAllTempTags, setApplyAllTempTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Initialize defaults for new files
    const next: Record<string, FileClassification> = {};
    files.forEach((f) => {
      const current: FileClassification = perFile[f.name] ?? {
        type: "homework",
        tags: [],
      };
      next[f.name] = current;
    });
    setPerFile(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.name).join("|")]);

  // Keep the apply-all UI preselected with the intersection of tags across all files
  React.useEffect(() => {
    const allFiles = Object.values(perFile);
    if (allFiles.length === 0) {
      setApplyAllTempTags([]);
      return;
    }
    const intersection = allFiles
      .map((f) => new Set(f.tags ?? []))
      .reduce<string[]>((acc, set, index) => {
        if (index === 0) return Array.from(set);
        return acc.filter((t) => set.has(t));
      }, []);
    setApplyAllTempTags(intersection);
  }, [perFile]);

  const applyTypeToAll = (type: DocumentType) => {
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, type }])
      )
    );
    setZipDefaults((p) => ({ ...p, type }));
  };

  const applyTagsToAll = (incomingTags: string[]) => {
    if (incomingTags.length === 0) return;
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const merged = Array.from(
            new Set([...(v.tags ?? []), ...incomingTags])
          );
          return [k, { ...v, tags: merged }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      tags: Array.from(new Set([...(p.tags ?? []), ...incomingTags])),
    }));
  };

  const removeTagsFromAll = (tagsToRemove: string[]) => {
    if (tagsToRemove.length === 0) return;
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const nextTags = (v.tags ?? []).filter(
            (t) => !tagsToRemove.includes(t)
          );
          return [k, { ...v, tags: nextTags }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      tags: (p.tags ?? []).filter((t) => !tagsToRemove.includes(t)),
    }));
  };

  // Previously used to show a ZIP-specific panel; now unified under apply-to-all controls
  // const hasZip = files.some((f) => f.name.toLowerCase().endsWith(".zip"));

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Classify Documents Before Upload</DialogTitle>
          <DialogDescription>
            Choose a type and tags for each file. You can also apply choices to
            all files.
          </DialogDescription>
        </DialogHeader>

        {/* ZIP-specific panel removed; apply-to-all controls below cover ZIP behavior */}

        {/* Apply to all controls above the file list - only show when multiple files */}
        {files.length > 1 && (
          <div className="rounded-md border p-3 bg-muted/40 mb-4">
            <div className="text-sm font-medium mb-3">
              Apply to all files below
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Select
                  onValueChange={(v) => applyTypeToAll(v as DocumentType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <TagSelector
                  value={applyAllTempTags}
                  onChange={(next) => {
                    setApplyAllTempTags((prev) => {
                      const added = next.filter((t) => !prev.includes(t));
                      const removed = prev.filter((t) => !next.includes(t));
                      if (added.length) applyTagsToAll(added);
                      if (removed.length) removeTagsFromAll(removed);
                      return next;
                    });
                  }}
                  knownTags={knownTags}
                  placeholder="Add tags for all files..."
                  badgesPosition="below"
                  showClearAll
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[50vh] overflow-auto pr-1">
          {files.map((file) => {
            const fc = perFile[file.name] ?? { type: "homework", tags: [] };
            const mime = file.type || inferMimeFromName(file.name);
            // gradient colors based on type (blue/purple theme) and mime
            const typeColorMap: Record<DocumentType, string> = {
              homework: "from-indigo-100",
              project: "from-purple-100",
              quiz: "from-indigo-200",
              midterm: "from-violet-200",
              lab: "from-blue-100",
              lecture: "from-purple-200",
              syllabus: "from-indigo-50",
            };
            const mimeToColor = (m: string) => {
              const mm = m.toLowerCase();
              if (mm.includes("pdf")) return "to-purple-200";
              if (
                mm.includes("word") ||
                mm.includes("msword") ||
                mm.includes("doc")
              )
                return "to-blue-200";
              if (mm.startsWith("image/")) return "to-purple-300";
              if (mm.includes("text")) return "to-indigo-200";
              if (mm.includes("zip")) return "to-indigo-300";
              if (
                mm.includes("json") ||
                mm.includes("yaml") ||
                mm.includes("xml")
              )
                return "to-indigo-300";
              return "to-violet-200";
            };
            const gradientClass = `bg-gradient-to-br ${typeColorMap[fc.type]} ${mimeToColor(mime)}`;
            return (
              <div
                key={file.name}
                className={`rounded-md p-0.5 ${gradientClass}`}
              >
                <div className="rounded-md p-3 bg-white text-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium truncate mr-2 text-gray-900">
                      {file.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {Math.round(file.size / 1024)} KB
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          // Remove this file from the local classification map and rely on parent to re-render with fewer files
                          setPerFile((prev) => {
                            const next = { ...prev };
                            delete next[file.name];
                            return next;
                          });
                          if (onRemoveFile) {
                            onRemoveFile(file.name);
                          } else {
                            // Dispatch a custom event to request removal upstream
                            const evt = new CustomEvent("upload:remove-file", {
                              detail: { fileName: file.name },
                            });
                            window.dispatchEvent(evt);
                          }
                        }}
                        aria-label="Remove file from upload"
                        title="Remove file"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <Select
                        value={fc.type}
                        onValueChange={(v) =>
                          setPerFile((prev) => {
                            const prevForFile: FileClassification = prev[
                              file.name
                            ] ?? { type: "homework", tags: [] };
                            return {
                              ...prev,
                              [file.name]: {
                                ...prevForFile,
                                type: v as DocumentType,
                              },
                            } as Record<string, FileClassification>;
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <TagSelector
                        value={fc.tags}
                        onChange={(tags) =>
                          setPerFile((prev) => {
                            const prevForFile: FileClassification = prev[
                              file.name
                            ] ?? { type: fc.type, tags: [] };
                            return {
                              ...prev,
                              [file.name]: { ...prevForFile, tags },
                            } as Record<string, FileClassification>;
                          })
                        }
                        knownTags={knownTags}
                        badgesPosition="below"
                        showClearAll
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center justify-between gap-2 w-full">
            <div>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const list = e.target.files;
                  if (list && list.length > 0) {
                    const next = Array.from(list);
                    onAddFiles?.(next);
                    // reset input so same file can be selected again later
                    e.currentTarget.value = "";
                  }
                }}
                accept={[
                  "application/pdf",
                  "image/*",
                  "application/msword",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  "text/plain",
                  "application/zip",
                  "text/html",
                  ".java,.py,.c,.h,.cpp,.hpp,.cc,.cs,.js,.jsx,.ts,.tsx,.mjs,.cjs,.html,.css,.scss,.md,.json,.yml,.yaml,.xml,.sh,.bash,.zsh,.rb,.go,.rs,.kt,.swift,.m,.mm,.sql,.ipynb",
                ].join(",")}
                className="hidden"
                id="upload-dialog-file-input"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const el = document.getElementById(
                    "upload-dialog-file-input"
                  ) as HTMLInputElement | null;
                  el?.click();
                }}
              >
                Add More Documents
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => onConfirm(perFile, zipDefaults)}
              >
                Start Upload
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadClassificationDialog;
