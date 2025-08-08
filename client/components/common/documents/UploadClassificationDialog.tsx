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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentType } from "@/types";
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

  const applyTypeToAll = (type: DocumentType) => {
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, type }])
      )
    );
  };

  const applyTagsToAll = (tags: string[]) => {
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, tags }])
      )
    );
  };

  const hasZip = files.some((f) => f.name.toLowerCase().endsWith(".zip"));

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Classify documents before upload</DialogTitle>
          <DialogDescription>
            Choose a type and tags for each file. You can also apply choices to
            all files.
          </DialogDescription>
        </DialogHeader>

        {hasZip && (
          <div className="rounded-md border p-3 bg-muted/40 mb-4">
            <div className="text-sm mb-2">
              ZIP detected. These defaults will apply to all extracted
              documents.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Default Type for ZIP</Label>
                <Select
                  value={zipDefaults.type}
                  onValueChange={(v) =>
                    setZipDefaults((p) => ({ ...p, type: v as DocumentType }))
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
                <Label>Default Tags for ZIP</Label>
                <TagSelector
                  value={zipDefaults.tags}
                  onChange={(tags) => setZipDefaults((p) => ({ ...p, tags }))}
                  knownTags={knownTags}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 max-h-[50vh] overflow-auto pr-1">
          {files.map((file) => {
            const fc = perFile[file.name] ?? { type: "homework", tags: [] };
            const isZip = file.name.toLowerCase().endsWith(".zip");
            return (
              <div key={file.name} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate mr-2">
                    {file.name}
                  </div>
                  <Badge variant="secondary">
                    {Math.round(file.size / 1024)} KB
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <Label>
                      Type{" "}
                      {isZip && (
                        <span className="text-muted-foreground">
                          (applies to ZIP file itself)
                        </span>
                      )}
                    </Label>
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
                    <Label>Tags</Label>
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
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => applyTypeToAll("homework")}
            >
              Reset types
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyTagsToAll([])}
            >
              Clear tags
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Label className="text-sm">Apply type to all:</Label>
              <Select onValueChange={(v) => applyTypeToAll(v as DocumentType)}>
                <SelectTrigger className="w-[180px]">
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
          </div>
          <div className="flex items-center justify-end gap-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadClassificationDialog;
