/**
 * DocumentNew.tsx
 * Document upload page component with inline classification form (ported from UploadClassificationDialog)
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import type {
  CreateDocumentIn,
  CreateDocumentOut,
  DocumentsListOut,
  FinalizeUploadOut,
} from "@/app/(main)/management/documents/new/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ParameterItemPicker } from "@/components/common/forms/ParameterItemPicker";
import { DocumentTypePicker } from "@/components/documents/DocumentTypePicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { inferMimeFromName } from "@/utils/mime-map";
import { Building2, FileText, Tag, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type DocumentType =
  | "homework"
  | "project"
  | "quiz"
  | "midterm"
  | "lab"
  | "lecture"
  | "syllabus";

type FileClassification = {
  type: DocumentType;
  parameterItemIds: string[];
  departmentIds?: string[];
};

interface DocumentNewProps {
  listData: DocumentsListOut;
  finalizeUploadAction: (uploadId: string) => Promise<FinalizeUploadOut>;
  createDocumentAction: (input: CreateDocumentIn) => Promise<CreateDocumentOut>;
}

const DEFAULT_TYPE: DocumentType = "homework";

export default function DocumentNew({
  listData,
  finalizeUploadAction,
  createDocumentAction,
}: DocumentNewProps) {
  const { effectiveProfile } = useProfile();
  const router = useRouter();
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeUploads, setActiveUploads] = useState<
    Map<
      string,
      {
        file: File;
        progress: number;
        toastId: string;
        status: "uploading" | "finalizing" | "completed" | "error";
      }
    >
  >(new Map());

  // Classification state (ported from UploadClassificationDialog)
  const [perFile, setPerFile] = useState<Record<string, FileClassification>>(
    {}
  );
  const [zipDefaults, setZipDefaults] = useState<FileClassification>({
    type: DEFAULT_TYPE,
    parameterItemIds: [],
  });
  const [globalDefaultType, setGlobalDefaultType] =
    useState<DocumentType>(DEFAULT_TYPE);
  const [globalDefaultParameterItemIds, setGlobalDefaultParameterItemIds] =
    useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] =
    useState<string[]>(defaultDepartmentIds);
  const [keepDefaultPerFile, setKeepDefaultPerFile] = useState<
    Record<string, boolean>
  >({});
  const [_stagedSelections, setStagedSelections] = useState<
    Record<
      string,
      {
        apply_all_parameter_item_ids?: string[];
        per_file_parameter_item_ids?: Record<string, string[]>;
      }
    >
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
  );

  // Extract mappings from list data
  const departmentMapping = useMemo(
    () => listData?.department_mapping || {},
    [listData]
  );
  const parameterItemMapping = useMemo(
    () => listData?.parameter_item_mapping || {},
    [listData]
  );
  const parameterMapping = useMemo(
    () => listData?.parameter_mapping || {},
    [listData]
  );

  const validDepartmentIds = useMemo(() => {
    return listData?.valid_department_ids || [];
  }, [listData]);

  const validParameterItemIds = useMemo(() => {
    return Object.keys(parameterItemMapping);
  }, [parameterItemMapping]);

  // Identify document_parameter=true parameters
  const documentParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter === true
    );
  }, [parameterMapping]);

  // Filter valid parameter item IDs based on selected departments
  const filteredValidParameterItemIds = useMemo(() => {
    const selectedDeptIds = selectedDepartmentIds || [];
    if (selectedDeptIds.length === 0) {
      return validParameterItemIds;
    }

    const selectedDeptParameterItemIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (
        deptData &&
        "parameter_item_ids" in deptData &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          selectedDeptParameterItemIds.add(id)
        );
      }
    });

    const allDeptParameterItemIds = new Set<string>();
    Object.values(departmentMapping).forEach((deptData) => {
      if (
        deptData?.parameter_item_ids &&
        Array.isArray(deptData.parameter_item_ids)
      ) {
        deptData.parameter_item_ids.forEach((id: string) =>
          allDeptParameterItemIds.add(id)
        );
      }
    });

    return validParameterItemIds.filter((itemId) => {
      const inSelectedDepts = selectedDeptParameterItemIds.has(itemId);
      const isCrossDept = !allDeptParameterItemIds.has(itemId);
      return inSelectedDepts || isCrossDept;
    });
  }, [validParameterItemIds, selectedDepartmentIds, departmentMapping]);

  // Track department changes and manage staged selections (ported logic)
  React.useEffect(() => {
    const currentDeptIds = selectedDepartmentIds || [];
    const prevDeptIds = previousDepartmentIds || [];

    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIds(currentDeptIds);
      }
      return;
    }

    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id)
    );
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
    );

    if (deselectedDepts.length > 0) {
      setStagedSelections((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          const perFileParams: Record<string, string[]> = {};
          Object.keys(perFile).forEach((fileName) => {
            const fileClass = perFile[fileName];
            if (fileClass) {
              perFileParams[fileName] = [...(fileClass.parameterItemIds || [])];
            }
          });
          updated[deptId] = {
            apply_all_parameter_item_ids: [...globalDefaultParameterItemIds],
            per_file_parameter_item_ids: perFileParams,
          };
        });
        return updated;
      });
    }

    if (newlySelectedDepts.length > 0) {
      setStagedSelections((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (staged) {
            if (
              staged.apply_all_parameter_item_ids &&
              staged.apply_all_parameter_item_ids.length > 0
            ) {
              const validParamSet = new Set(filteredValidParameterItemIds);
              const validParams = staged.apply_all_parameter_item_ids.filter(
                (id) => validParamSet.has(id)
              );
              if (validParams.length > 0) {
                setGlobalDefaultParameterItemIds((prevParams) => {
                  const combined = new Set([...prevParams, ...validParams]);
                  return Array.from(combined);
                });
              }
            }
            if (
              staged.per_file_parameter_item_ids &&
              Object.keys(staged.per_file_parameter_item_ids).length > 0
            ) {
              const validParamSet = new Set(filteredValidParameterItemIds);
              setPerFile((prevPerFile) => {
                const updated: Record<string, FileClassification> = {
                  ...prevPerFile,
                };
                Object.keys(staged.per_file_parameter_item_ids!).forEach(
                  (fileName) => {
                    const stagedParams =
                      staged.per_file_parameter_item_ids![fileName] || [];
                    const validParams = stagedParams.filter((id) =>
                      validParamSet.has(id)
                    );
                    if (validParams.length > 0 && updated[fileName]) {
                      const combined = new Set([
                        ...(updated[fileName].parameterItemIds || []),
                        ...validParams,
                      ]);
                      updated[fileName] = {
                        ...updated[fileName],
                        parameterItemIds: Array.from(combined),
                      };
                    }
                  }
                );
                return updated;
              });
            }
          }
        });
        return prev;
      });
    }

    setPreviousDepartmentIds(currentDeptIds);
  }, [
    selectedDepartmentIds,
    previousDepartmentIds,
    globalDefaultParameterItemIds,
    perFile,
    filteredValidParameterItemIds,
  ]);

  // Clear invalid parameter item selections when departments change
  React.useEffect(() => {
    if (globalDefaultParameterItemIds.length > 0) {
      const validSet = new Set(filteredValidParameterItemIds);
      const filtered = globalDefaultParameterItemIds.filter((id) =>
        validSet.has(id)
      );
      if (filtered.length !== globalDefaultParameterItemIds.length) {
        setGlobalDefaultParameterItemIds(filtered);
      }
    }

    setPerFile((prev) => {
      const updated: Record<string, FileClassification> = {};
      let hasChanges = false;
      Object.entries(prev).forEach(([fileName, fc]) => {
        const validSet = new Set(filteredValidParameterItemIds);
        const filtered = (fc.parameterItemIds || []).filter((id) =>
          validSet.has(id)
        );
        if (filtered.length !== (fc.parameterItemIds || []).length) {
          hasChanges = true;
          updated[fileName] = { ...fc, parameterItemIds: filtered };
        } else {
          updated[fileName] = fc;
        }
      });
      return hasChanges ? updated : prev;
    });
  }, [filteredValidParameterItemIds, globalDefaultParameterItemIds]);

  // Initialize defaults for new files
  React.useEffect(() => {
    const next: Record<string, FileClassification> = {};
    pendingFiles.forEach((f) => {
      const current: FileClassification = perFile[f.name] ?? {
        type: globalDefaultType,
        parameterItemIds: [...globalDefaultParameterItemIds],
      };
      next[f.name] = current;
    });
    setPerFile(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles.map((f) => f.name).join("|")]);

  // Keep the apply-all parameter items preselected with the intersection across all files
  React.useEffect(() => {
    const allFiles = Object.values(perFile);
    if (allFiles.length === 0) {
      setGlobalDefaultParameterItemIds([]);
      return;
    }
    const intersection = allFiles
      .map((f) => new Set(f.parameterItemIds ?? []))
      .reduce<string[]>((acc, set, index) => {
        if (index === 0) return Array.from(set);
        return acc.filter((id) => set.has(id));
      }, []);
    setGlobalDefaultParameterItemIds(intersection);
  }, [perFile]);

  const applyTypeToAll = (type: DocumentType) => {
    setGlobalDefaultType(type);
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, type }])
      )
    );
    setZipDefaults((p) => ({ ...p, type }));
  };

  const applyParameterItemsToAll = (incomingIds: string[]) => {
    if (incomingIds.length === 0) return;
    setGlobalDefaultParameterItemIds((prev) => {
      const merged = Array.from(new Set([...prev, ...incomingIds]));
      return merged;
    });
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const merged = Array.from(
            new Set([...(v.parameterItemIds ?? []), ...incomingIds])
          );
          return [k, { ...v, parameterItemIds: merged }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      parameterItemIds: Array.from(
        new Set([...(p.parameterItemIds ?? []), ...incomingIds])
      ),
    }));
  };

  const removeParameterItemsFromAll = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    setGlobalDefaultParameterItemIds((prev) =>
      prev.filter((id) => !idsToRemove.includes(id))
    );
    setPerFile((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => {
          const nextIds = (v.parameterItemIds ?? []).filter(
            (id) => !idsToRemove.includes(id)
          );
          return [k, { ...v, parameterItemIds: nextIds }];
        })
      )
    );
    setZipDefaults((p) => ({
      ...p,
      parameterItemIds: (p.parameterItemIds ?? []).filter(
        (id) => !idsToRemove.includes(id)
      ),
    }));
  };

  // Validation: Check that each document has at least one parameter item for each document_parameter=true parameter
  const validationErrors = useMemo(() => {
    const errors: Record<string, string[]> = {};

    if (documentParameterIds.length === 0) {
      return errors;
    }

    pendingFiles.forEach((file) => {
      const fc = perFile[file.name] ?? {
        type: globalDefaultType,
        parameterItemIds: [...globalDefaultParameterItemIds],
      };

      const selectedItemIds = fc.parameterItemIds || [];

      documentParameterIds.forEach((paramId) => {
        const itemsForParam = filteredValidParameterItemIds.filter((itemId) => {
          const item = parameterItemMapping[itemId];
          return item && item.parameter_id === paramId;
        });

        const hasItemForParam = itemsForParam.some((itemId) =>
          selectedItemIds.includes(itemId)
        );

        if (!hasItemForParam && itemsForParam.length > 0) {
          if (!errors[file.name]) {
            errors[file.name] = [];
          }
          const paramName = parameterMapping[paramId]?.name || paramId;
          errors[file.name]!.push(
            `Required: Select at least one ${paramName} option`
          );
        }
      });
    });

    return errors;
  }, [
    pendingFiles,
    perFile,
    globalDefaultType,
    globalDefaultParameterItemIds,
    documentParameterIds,
    filteredValidParameterItemIds,
    parameterItemMapping,
    parameterMapping,
  ]);

  const canSubmit = useMemo(() => {
    return Object.keys(validationErrors).length === 0;
  }, [validationErrors]);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setPendingFiles((prev) => [...prev, ...acceptedFiles]);
      }
    },
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
      "application/zip": [".zip"],
      "text/html": [".html"],
    },
    multiple: true,
    disabled: activeUploads.size > 0,
  });

  const uploadFile = async (file: File, classification: FileClassification) => {
    const fileId = uuidv4();
    const toastId = toast.loading(`Preparing upload: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
    });

    setActiveUploads((prev) =>
      new Map(prev).set(fileId, {
        file,
        progress: 0,
        toastId: toastId as string,
        status: "uploading",
      })
    );

    let tusUploadInstance: tus.Upload | null = null;
    try {
      tusUploadInstance = new tus.Upload(file, {
        endpoint: `/api/uploads/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type || inferMimeFromName(file.name),
          fileId: fileId,
        },
        onError: (error) => {
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
          });
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                progress,
              });
            }
            return newMap;
          });

          toast.loading(`Uploading ${file.name}... ${progress}%`, {
            description: `${Math.round((bytesUploaded / 1024 / 1024) * 100) / 100} MB / ${Math.round((bytesTotal / 1024 / 1024) * 100) / 100} MB`,
            id: toastId,
            dismissible: true,
          });
        },
        onSuccess: async () => {
          setActiveUploads((prev) => {
            const newMap = new Map(prev);
            const upload = newMap.get(fileId);
            if (upload) {
              newMap.set(fileId, {
                ...upload,
                status: "finalizing",
              });
            }
            return newMap;
          });

          try {
            // Extract TUS upload_id from upload URL
            // URL format: /api/uploads/upload/{upload_id}
            const uploadUrl = tusUploadInstance?.url || "";
            const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
            if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
              throw new Error("Failed to extract upload ID from upload URL");
            }
            const tusUploadId = tusUploadIdMatch[1];

            // Finalize upload to get database upload_id
            const finalizeResult = await finalizeUploadAction(tusUploadId);

            if (!finalizeResult.success || !finalizeResult.uploadId) {
              throw new Error(
                finalizeResult.message || "Failed to finalize upload"
              );
            }

            const databaseUploadId = finalizeResult.uploadId;

            // Create document with upload_id
            const finalDepartmentIds = transformDepartmentIdsForSubmit(
              classification.departmentIds || selectedDepartmentIds,
              isSuperadmin,
              validDepartmentIds
            );

            const createResult = await createDocumentAction({
              body: {
                name: file.name,
                type: classification.type,
                uploadId: databaseUploadId,
                departmentIds: finalDepartmentIds,
                parameterItemIds: classification.parameterItemIds || [],
                profileId: effectiveProfile?.id || "",
              },
            });

            if (createResult.success) {
              toast.success(`Upload completed: ${file.name}!`, {
                description: "Document created successfully",
                id: toastId,
              });

              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                const upload = newMap.get(fileId);
                if (upload) {
                  newMap.set(fileId, {
                    ...upload,
                    status: "completed",
                  });
                }
                return newMap;
              });

              setTimeout(() => {
                setActiveUploads((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(fileId);
                  const remaining = Array.from(newMap.values()).filter(
                    (u) => u.status !== "completed" && u.status !== "error"
                  );
                  if (remaining.length === 0 && newMap.size === 0) {
                    setTimeout(() => {
                      router.push("/management/documents");
                      router.refresh();
                    }, 500);
                  }
                  return newMap;
                });
              }, 2000);
            } else {
              toast.error(`Document creation failed: ${file.name}`, {
                description:
                  createResult.message || "Failed to create document",
                id: toastId,
              });
              setActiveUploads((prev) => {
                const newMap = new Map(prev);
                newMap.delete(fileId);
                return newMap;
              });
            }
          } catch (error) {
            toast.error(`Upload processing failed: ${file.name}`, {
              description:
                error instanceof Error
                  ? error.message
                  : "Failed to process uploaded file",
              id: toastId,
            });
            setActiveUploads((prev) => {
              const newMap = new Map(prev);
              newMap.delete(fileId);
              return newMap;
            });
          }
        },
      });

      await tusUploadInstance.start();
    } catch {
      toast.error(`Upload failed: ${file.name}`, {
        description: "An error occurred during upload",
        id: toastId,
      });
      setActiveUploads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pendingFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }

    if (!canSubmit) {
      const firstError = Object.values(validationErrors)[0];
      if (firstError && firstError.length > 0) {
        toast.error(firstError[0]);
      }
      return;
    }

    const finalDepartmentIds = transformDepartmentIdsForSubmit(
      selectedDepartmentIds,
      isSuperadmin,
      validDepartmentIds
    );

    // Upload all files with their classifications
    for (const file of pendingFiles) {
      const fc = perFile[file.name] ?? {
        type: globalDefaultType,
        parameterItemIds: [...globalDefaultParameterItemIds],
        departmentIds: selectedDepartmentIds,
      };

      const classification: FileClassification = {
        ...fc,
        departmentIds:
          fc.departmentIds && fc.departmentIds.length > 0
            ? transformDepartmentIdsForSubmit(
                fc.departmentIds,
                isSuperadmin,
                validDepartmentIds
              ) || []
            : finalDepartmentIds || [],
      };

      await uploadFile(file, classification);
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== fileName));
    setPerFile((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    setKeepDefaultPerFile((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  };

  const handleAddFiles = (files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dropzone */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            } ${activeUploads.size > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              {isDragActive
                ? "Drop files here"
                : "Drag & drop files here, or click to select"}
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PDF, images, Word documents, text files, and ZIP archives
            </p>
          </div>

          {/* Active uploads */}
          {activeUploads.size > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Uploading files:</p>
              {Array.from(activeUploads.values()).map((upload) => (
                <div
                  key={upload.toastId}
                  className="flex items-center justify-between p-2 bg-muted rounded"
                >
                  <span className="text-sm">{upload.file.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {upload.progress}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classification form - shown when files are selected */}
      {pendingFiles.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Defaults Toolbar - only show when multiple files */}
            {pendingFiles.length > 1 && (
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md border flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">
                  Defaults →
                </span>
                {validDepartmentIds.length > 1 && (
                  <div data-testid="document-department-selector">
                    <DepartmentPicker
                      mapping={departmentMapping}
                      validIds={validDepartmentIds}
                      selectedIds={selectedDepartmentIds}
                      onSelect={setSelectedDepartmentIds}
                      placeholder="Dept"
                      multiSelect={true}
                      compact={true}
                      buttonClassName="h-7 px-2 text-xs"
                    />
                  </div>
                )}
                <div data-testid="document-type-selector">
                  <DocumentTypePicker
                    selectedType={globalDefaultType}
                    onSelect={applyTypeToAll}
                    placeholder="Type"
                    compact={true}
                  />
                </div>
                <div
                  className="flex-1 min-w-[120px]"
                  data-testid="document-parameter-selector"
                >
                  <ParameterItemPicker
                    mapping={parameterItemMapping}
                    validIds={filteredValidParameterItemIds}
                    selectedIds={globalDefaultParameterItemIds}
                    onSelect={(next) => {
                      const added = next.filter(
                        (id) => !globalDefaultParameterItemIds.includes(id)
                      );
                      const removed = globalDefaultParameterItemIds.filter(
                        (id) => !next.includes(id)
                      );
                      if (added.length) applyParameterItemsToAll(added);
                      if (removed.length) removeParameterItemsFromAll(removed);
                      setGlobalDefaultParameterItemIds(next);
                    }}
                    parameterId=""
                    parameterName="Params"
                    allowCreate={false}
                    multiSelect={true}
                    badgesPosition="below"
                    showClearAll={true}
                    hideSelectedChips={false}
                    compact={true}
                    required={
                      documentParameterIds.length > 0 &&
                      documentParameterIds.some((paramId) =>
                        filteredValidParameterItemIds.some(
                          (itemId) =>
                            parameterItemMapping[itemId]?.parameter_id ===
                            paramId
                        )
                      )
                    }
                  />
                </div>
              </div>
            )}

            {/* Table Layout - Documents as rows */}
            <div className="border rounded-md max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">File Name</TableHead>
                    {validDepartmentIds.length > 1 && (
                      <TableHead className="w-[180px]">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Department</span>
                        </div>
                      </TableHead>
                    )}
                    <TableHead className="w-[150px]">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Type</span>
                      </div>
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Parameter Items</span>
                      </div>
                    </TableHead>
                    {pendingFiles.length > 1 && (
                      <TableHead className="w-[120px]">Keep Default</TableHead>
                    )}
                    {pendingFiles.length > 1 && (
                      <TableHead className="w-[80px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingFiles.map((file) => {
                    const fc = perFile[file.name] ?? {
                      type: globalDefaultType,
                      parameterItemIds: [...globalDefaultParameterItemIds],
                      departmentIds: selectedDepartmentIds,
                    };

                    const keepDefault = keepDefaultPerFile[file.name] ?? true;

                    const useDefaultDepartment = keepDefault;
                    const useDefaultType = keepDefault;
                    const useDefaultParameterItems = keepDefault;

                    return (
                      <TableRow key={file.name}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div
                              className="text-sm font-medium truncate max-w-[180px]"
                              title={file.name}
                            >
                              📄 {file.name}
                            </div>
                            <Badge
                              variant="secondary"
                              className="text-xs w-fit"
                            >
                              {Math.round(file.size / 1024)} KB
                            </Badge>
                            {validationErrors[file.name] &&
                              validationErrors[file.name]!.length > 0 && (
                                <div className="text-xs text-red-600 mt-1">
                                  {validationErrors[file.name]!.map(
                                    (error, idx) => (
                                      <div key={idx}>{error}</div>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        </TableCell>
                        {validDepartmentIds.length > 1 && (
                          <TableCell>
                            <DepartmentPicker
                              mapping={departmentMapping}
                              validIds={validDepartmentIds}
                              selectedIds={
                                useDefaultDepartment
                                  ? selectedDepartmentIds
                                  : fc.departmentIds || selectedDepartmentIds
                              }
                              onSelect={(ids) => {
                                if (!useDefaultDepartment) {
                                  setPerFile((prev) => {
                                    const prevForFile: FileClassification =
                                      prev[file.name] ?? {
                                        type: globalDefaultType,
                                        parameterItemIds: [
                                          ...globalDefaultParameterItemIds,
                                        ],
                                        departmentIds: selectedDepartmentIds,
                                      };
                                    return {
                                      ...prev,
                                      [file.name]: {
                                        ...prevForFile,
                                        departmentIds: ids,
                                      },
                                    } as Record<string, FileClassification>;
                                  });
                                }
                              }}
                              placeholder="Dept"
                              multiSelect={true}
                              compact={true}
                              buttonClassName="h-7 px-2 text-xs"
                              disabled={useDefaultDepartment}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <DocumentTypePicker
                            selectedType={
                              useDefaultType ? globalDefaultType : fc.type
                            }
                            onSelect={(type) => {
                              if (!useDefaultType) {
                                setPerFile((prev) => {
                                  const prevForFile: FileClassification = prev[
                                    file.name
                                  ] ?? {
                                    type: globalDefaultType,
                                    parameterItemIds: [
                                      ...globalDefaultParameterItemIds,
                                    ],
                                    departmentIds: selectedDepartmentIds,
                                  };
                                  return {
                                    ...prev,
                                    [file.name]: {
                                      ...prevForFile,
                                      type,
                                    },
                                  } as Record<string, FileClassification>;
                                });
                              }
                            }}
                            placeholder="Type"
                            compact={true}
                            disabled={useDefaultType}
                          />
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <ParameterItemPicker
                            mapping={parameterItemMapping}
                            validIds={filteredValidParameterItemIds}
                            selectedIds={
                              useDefaultParameterItems
                                ? globalDefaultParameterItemIds
                                : fc.parameterItemIds
                            }
                            onSelect={(parameterItemIds) => {
                              if (!useDefaultParameterItems) {
                                setPerFile((prev) => {
                                  const prevForFile: FileClassification = prev[
                                    file.name
                                  ] ?? {
                                    type: fc.type,
                                    parameterItemIds: [
                                      ...globalDefaultParameterItemIds,
                                    ],
                                    departmentIds: selectedDepartmentIds,
                                  };
                                  return {
                                    ...prev,
                                    [file.name]: {
                                      ...prevForFile,
                                      parameterItemIds,
                                    },
                                  } as Record<string, FileClassification>;
                                });
                              }
                            }}
                            parameterId=""
                            parameterName="Params"
                            allowCreate={false}
                            multiSelect={true}
                            badgesPosition="below"
                            showClearAll={false}
                            hideSelectedChips={false}
                            compact={true}
                            disabled={useDefaultParameterItems}
                            required={
                              documentParameterIds.length > 0 &&
                              documentParameterIds.some((paramId) =>
                                filteredValidParameterItemIds.some(
                                  (itemId) =>
                                    parameterItemMapping[itemId]
                                      ?.parameter_id === paramId
                                )
                              )
                            }
                          />
                        </TableCell>
                        {pendingFiles.length > 1 && (
                          <TableCell>
                            <Checkbox
                              checked={keepDefault}
                              onCheckedChange={(checked) => {
                                setKeepDefaultPerFile((prev) => ({
                                  ...prev,
                                  [file.name]: checked === true,
                                }));
                              }}
                            />
                          </TableCell>
                        )}
                        {pendingFiles.length > 1 && (
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleRemoveFile(file.name)}
                                    aria-label="Remove file from upload"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remove file</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Add More Documents button */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list && list.length > 0) {
                      const next = Array.from(list);
                      handleAddFiles(next);
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
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById(
                      "upload-dialog-file-input"
                    ) as HTMLInputElement | null;
                    el?.click();
                  }}
                  className="border bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-200"
                >
                  + Add More Documents
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/management/documents")}
          disabled={activeUploads.size > 0}
        >
          Back
        </Button>
        <Button
          type="submit"
          disabled={
            activeUploads.size > 0 || pendingFiles.length === 0 || !canSubmit
          }
          data-testid="document-classify-submit"
        >
          Start Upload
        </Button>
      </div>
    </form>
  );
}
