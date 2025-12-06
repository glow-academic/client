/**
 * Document.tsx
 * Unified component for creating and editing documents
 * Supports both regular document uploads and template documents
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import type {
  DocumentDetailOut,
  RenderTemplateIn,
  RenderTemplateOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
} from "@/app/(main)/management/documents/d/[documentId]/page";
import type {
  CreateDocumentIn,
  CreateDocumentOut,
  DocumentsListOut,
  FinalizeUploadOut,
  GenerateTemplateIn,
  GenerateTemplateOut,
} from "@/app/(main)/management/documents/new/page";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import ParameterItemPicker from "@/components/common/forms/ParameterItemPicker";
import { TemplatePicker } from "@/components/common/forms/TemplatePicker";
import TemplateForm, {
  type TemplateSchema,
  isTemplateSchema,
} from "@/components/documents/TemplateForm";
import TemplatePreview from "@/components/documents/TemplatePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
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
import { searchParamsToTemplateArgs } from "@/utils/template-args-url";
import { Building2, FileCode, Power, Tag, UploadCloud, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import { v4 as uuidv4 } from "uuid";

type FileClassification = {
  parameterItemIds: string[];
  departmentIds?: string[];
};

export interface DocumentProps {
  documentId?: string;
  mode?: "create" | "edit";
  // Server-provided data
  documentDetail?: DocumentDetailOut;
  documentDetailDefault?: DocumentsListOut;
  // Server actions
  createDocumentAction?: (
    input: CreateDocumentIn
  ) => Promise<CreateDocumentOut>;
  updateDocumentAction?: (
    input: UpdateDocumentIn
  ) => Promise<UpdateDocumentOut>;
  finalizeUploadAction?: (uploadId: string) => Promise<FinalizeUploadOut>;
  generateTemplateAction?: (
    input: GenerateTemplateIn
  ) => Promise<GenerateTemplateOut>;
  renderTemplateAction?: (
    input: RenderTemplateIn
  ) => Promise<RenderTemplateOut>;
  renderedHtml?: string | null;
}

export default function Document({
  documentId,
  mode = documentId ? "edit" : "create",
  documentDetail: serverDocumentDetail,
  documentDetailDefault: serverDocumentDetailDefault,
  createDocumentAction,
  updateDocumentAction,
  finalizeUploadAction,
  generateTemplateAction,
  renderTemplateAction,
  renderedHtml = null,
}: DocumentProps) {
  const router = useRouter();
  const { effectiveDepartmentIds, effectiveProfile } = useProfile();
  const isEditMode = mode === "edit" && !!documentId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  // Use server-provided data directly
  const documentDetail = serverDocumentDetail;
  const documentDetailDefault = serverDocumentDetailDefault;

  // Extract body types for type safety
  type CreateDocumentBody = CreateDocumentIn extends { body: infer B }
    ? B
    : never;
  type UpdateDocumentBody = UpdateDocumentIn extends { body: infer B }
    ? B
    : never;
  type GenerateTemplateBody = GenerateTemplateIn extends { body: infer B }
    ? B
    : never;

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    active: boolean;
    departmentIds: string[];
    parameterItemIds: string[];
    classifyAgentId: string | null;
    documentAgentId: string | null;
  }>({
    name: "",
    description: "",
    active: true,
    departmentIds: [],
    parameterItemIds: [],
    classifyAgentId: null,
    documentAgentId: null,
  });

  // Template state
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [templateSchema, setTemplateSchema] = useState<TemplateSchema | null>(
    null
  );
  const [templateUploadId, setTemplateUploadId] = useState<string | null>(null);
  const [templateArgs, setTemplateArgs] = useState<Record<string, unknown>>({});
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateMapping, setTemplateMapping] = useState<
    Record<
      string,
      {
        template_args: Record<string, unknown>;
        active: boolean;
        created_at: string;
        updated_at: string;
      }
    >
  >({});
  const [clientRenderedHtml, setClientRenderedHtml] = useState<string | null>(
    renderedHtml
  );
  const searchParams = useSearchParams();

  // Create mode: File upload state
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
  const [perFile, setPerFile] = useState<Record<string, FileClassification>>(
    {}
  );
  const [globalDefaultParameterItemIds, setGlobalDefaultParameterItemIds] =
    useState<string[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] =
    useState<string[]>(defaultDepartmentIds);
  const [keepDefaultPerFile, setKeepDefaultPerFile] = useState<
    Record<string, boolean>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
  );

  // Extract mappings from data
  const departmentMapping = useMemo(
    () =>
      (isEditMode
        ? documentDetail?.department_mapping
        : documentDetailDefault?.department_mapping) || {},
    [isEditMode, documentDetail, documentDetailDefault]
  );
  const parameterItemMapping = useMemo(
    () =>
      (isEditMode
        ? documentDetail?.parameter_item_mapping
        : documentDetailDefault?.parameter_item_mapping) || {},
    [isEditMode, documentDetail, documentDetailDefault]
  );
  const agentMapping = useMemo(
    () => (isEditMode ? documentDetail?.agent_mapping : {}) || {},
    [isEditMode, documentDetail]
  );
  const parameterMapping = useMemo(
    () => (isEditMode ? {} : documentDetailDefault?.parameter_mapping) || {},
    [isEditMode, documentDetailDefault]
  );

  const validDepartmentIds = useMemo(() => {
    if (isEditMode) {
      return documentDetail?.valid_department_ids || effectiveDepartmentIds;
    }
    return documentDetailDefault?.valid_department_ids || [];
  }, [
    isEditMode,
    documentDetail,
    documentDetailDefault,
    effectiveDepartmentIds,
  ]);

  const validParameterItemIds = useMemo(() => {
    if (isEditMode) {
      const baseIds = documentDetail?.valid_parameter_item_ids || [];
      const selectedDeptIds = formData.departmentIds;

      if (selectedDeptIds.length === 0) {
        return baseIds;
      }

      const deptParameterIds = new Set<string>();
      selectedDeptIds.forEach((deptId) => {
        const deptData = departmentMapping[deptId];
        if (deptData?.parameter_ids && Array.isArray(deptData.parameter_ids)) {
          deptData.parameter_ids.forEach((id) => deptParameterIds.add(id));
        }
      });

      return baseIds.filter((itemId) => {
        const item = parameterItemMapping[itemId];
        return item && deptParameterIds.has(item.parameter_id);
      });
    }
    return Object.keys(parameterItemMapping);
  }, [
    isEditMode,
    documentDetail,
    formData.departmentIds,
    departmentMapping,
    parameterItemMapping,
  ]);

  // Create mode: Filter valid parameter item IDs based on selected departments
  const filteredValidParameterItemIds = useMemo(() => {
    if (isEditMode) return [];
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
  }, [
    isEditMode,
    validParameterItemIds,
    selectedDepartmentIds,
    departmentMapping,
  ]);

  // Create mode: Identify document_parameter=true parameters
  const documentParameterIds = useMemo(() => {
    if (isEditMode) return [];
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter === true
    );
  }, [isEditMode, parameterMapping]);

  // Initialize form data from document detail (edit mode)
  useEffect(() => {
    if (isEditMode && documentDetail) {
      setFormData({
        name: documentDetail.name || "",
        description: documentDetail.description || "",
        active: documentDetail.active ?? true,
        departmentIds: documentDetail.department_ids || [],
        parameterItemIds: documentDetail.parameter_item_ids || [],
        classifyAgentId: documentDetail.classify_agent_id || null,
        documentAgentId: documentDetail.document_agent_id || null,
      });

      // Always initialize template_mapping if it exists (regardless of template flag)
      // This allows showing past templates even if document is not currently a template
      if (documentDetail.template_mapping) {
        setTemplateMapping(documentDetail.template_mapping);
      }

      // Initialize template args if template document
      if (documentDetail.template) {
        if (documentDetail.template_args) {
          setTemplateArgs(documentDetail.template_args);
        }
        if (documentDetail.template_upload_id) {
          setTemplateUploadId(documentDetail.template_upload_id);
        }
        if (documentDetail.template_id) {
          setSelectedTemplateId(documentDetail.template_id);
        }
        setIsTemplateMode(true);
      }
    }
  }, [isEditMode, documentDetail]);

  // Auto-select agents if only one option available (edit mode only)
  useEffect(() => {
    if (!isEditMode || !documentDetail) return;

    const classifyAgentIds =
      documentDetail.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("classify");
      }) || [];

    const documentAgentIds =
      documentDetail.valid_agent_ids?.filter((id) => {
        const agent = agentMapping[id];
        return agent?.roles?.includes("document");
      }) || [];

    // Auto-select first classify agent if only one option and not already set
    if (classifyAgentIds.length === 1 && !formData.classifyAgentId) {
      setFormData((prev) => ({
        ...prev,
        classifyAgentId: classifyAgentIds[0] || null,
      }));
    }

    // Auto-select first document agent if only one option and not already set
    if (documentAgentIds.length === 1 && !formData.documentAgentId) {
      setFormData((prev) => ({
        ...prev,
        documentAgentId: documentAgentIds[0] || null,
      }));
    }
  }, [
    isEditMode,
    documentDetail,
    agentMapping,
    formData.classifyAgentId,
    formData.documentAgentId,
  ]);

  // Template mode detection - use isTemplateMode or check if templateUploadId exists
  const isTemplateDocument =
    isTemplateMode || (isEditMode && !!documentDetail?.template);

  // Get schema for display - prioritize selected template's schema if switching templates
  const templateSchemaForDisplay = useMemo(() => {
    // If we have a selected template ID and it's in the mapping, use that schema
    if (selectedTemplateId && templateMapping[selectedTemplateId]) {
      const selectedTemplateSchema =
        templateMapping[selectedTemplateId].template_args;
      if (isTemplateSchema(selectedTemplateSchema)) {
        return selectedTemplateSchema;
      }
    }

    // Otherwise, use documentDetail template_schema in edit mode, or templateSchema state
    if (isEditMode && documentDetail?.template_schema) {
      return isTemplateSchema(documentDetail.template_schema)
        ? documentDetail.template_schema
        : null;
    }
    return templateSchema;
  }, [
    selectedTemplateId,
    templateMapping,
    isEditMode,
    documentDetail?.template_schema,
    templateSchema,
  ]);
  const templateHtmlForDisplay =
    isEditMode && documentDetail?.template_html
      ? documentDetail.template_html
      : templateHtml;

  // Client-side render endpoint call when query params change
  useEffect(() => {
    // Only render if we have a template schema, document ID, and are in template mode
    // In edit mode, also check if document is a template
    const shouldRender =
      templateSchemaForDisplay &&
      documentId &&
      (isTemplateMode || (isEditMode && !!documentDetail?.template));
    if (!shouldRender) {
      setClientRenderedHtml(renderedHtml);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        // Parse search params to template args
        const templateArgs = searchParamsToTemplateArgs(
          searchParams,
          templateSchemaForDisplay
        );

        // Get departmentIds from documentDetail (edit mode) or form state
        const departmentIds =
          isEditMode && documentDetail?.department_ids
            ? documentDetail.department_ids
            : formData.departmentIds.length > 0
              ? formData.departmentIds
              : null;

        // Always call render endpoint if we have template args, even if empty
        // This ensures we get a rendered preview with default values
        if (!renderTemplateAction) {
          console.error("Render template action not available");
          setClientRenderedHtml(null);
          return;
        }

        const renderBody: RenderTemplateIn["body"] = {
          documentId,
          templateArgs,
          profileId: effectiveProfile?.id || "",
        };
        if (departmentIds) {
          renderBody.departmentIds = departmentIds;
        }
        const result = await renderTemplateAction({ body: renderBody });
        setClientRenderedHtml(result.rendered_html);
      } catch (error) {
        // If render fails, set to null so TemplatePreview shows appropriate message
        console.error("Failed to render template:", error);
        setClientRenderedHtml(null);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(debounceTimer);
  }, [
    searchParams,
    templateSchemaForDisplay,
    documentId,
    isTemplateMode,
    isEditMode,
    documentDetail?.template,
    documentDetail?.department_ids,
    formData.departmentIds,
    effectiveProfile?.id,
    renderTemplateAction,
    renderedHtml,
  ]);

  // Create mode: Track department changes and manage staged selections
  React.useEffect(() => {
    if (isEditMode) return;
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
      // Store staged selections for deselected departments
    }

    if (newlySelectedDepts.length > 0) {
      // Restore staged selections for newly selected departments
    }

    setPreviousDepartmentIds(currentDeptIds);
  }, [
    isEditMode,
    selectedDepartmentIds,
    previousDepartmentIds,
    globalDefaultParameterItemIds,
    perFile,
    filteredValidParameterItemIds,
  ]);

  // Create mode: Clear invalid parameter item selections when departments change
  React.useEffect(() => {
    if (isEditMode) return;
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
  }, [
    isEditMode,
    filteredValidParameterItemIds,
    globalDefaultParameterItemIds,
  ]);

  // Create mode: Initialize defaults for new files
  React.useEffect(() => {
    if (isEditMode) return;
    const next: Record<string, FileClassification> = {};
    pendingFiles.forEach((f) => {
      const current: FileClassification = perFile[f.name] ?? {
        parameterItemIds: [...globalDefaultParameterItemIds],
      };
      next[f.name] = current;
    });
    setPerFile(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, pendingFiles.map((f) => f.name).join("|")]);

  // Create mode: Keep the apply-all parameter items preselected with the intersection across all files
  React.useEffect(() => {
    if (isEditMode) return;
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
  }, [isEditMode, perFile]);

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
  };

  // Create mode: Validation errors
  const validationErrors = useMemo(() => {
    if (isEditMode) return {};
    const errors: Record<string, string[]> = {};

    if (documentParameterIds.length === 0) {
      return errors;
    }

    pendingFiles.forEach((file) => {
      const fc = perFile[file.name] ?? {
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
    isEditMode,
    pendingFiles,
    perFile,
    globalDefaultParameterItemIds,
    documentParameterIds,
    filteredValidParameterItemIds,
    parameterItemMapping,
    parameterMapping,
  ]);

  const canSubmit = useMemo(() => {
    if (isEditMode) return true;
    return Object.keys(validationErrors).length === 0;
  }, [isEditMode, validationErrors]);

  // Create mode: Dropzone configuration
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
    disabled: activeUploads.size > 0 || isEditMode,
  });

  // Create mode: Upload file function
  const uploadFile = async (file: File, classification: FileClassification) => {
    if (!finalizeUploadAction || !createDocumentAction) return;

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
            const uploadUrl = tusUploadInstance?.url || "";
            const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
            if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
              throw new Error("Failed to extract upload ID from upload URL");
            }
            const tusUploadId = tusUploadIdMatch[1];

            const finalizeResult = await finalizeUploadAction(tusUploadId);

            if (!finalizeResult.success || !finalizeResult.uploadId) {
              throw new Error(
                finalizeResult.message || "Failed to finalize upload"
              );
            }

            const databaseUploadId = finalizeResult.uploadId;

            let suggestedParameterItemIds: string[] = [];
            try {
              const classifyResponse = await fetch(
                `/api/v3/uploads/upload/${tusUploadId}/classify`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    profileId: effectiveProfile?.id || "",
                    parameterIds: null,
                  }),
                }
              );

              if (classifyResponse.ok) {
                const classifyResult = await classifyResponse.json();
                if (
                  classifyResult.success &&
                  classifyResult.suggestedParameterItemIds
                ) {
                  suggestedParameterItemIds =
                    classifyResult.suggestedParameterItemIds[file.name] || [];
                }
              }
            } catch {
              // Classification failed, but continue with user's selections
            }

            const finalParameterItemIds = Array.from(
              new Set([
                ...(classification.parameterItemIds || []),
                ...suggestedParameterItemIds,
              ])
            );

            const finalDepartmentIds = transformDepartmentIdsForSubmit(
              classification.departmentIds || selectedDepartmentIds,
              isSuperadmin,
              validDepartmentIds
            );

            const createResult = await createDocumentAction({
              body: {
                name: file.name,
                description: "",
                uploadId: databaseUploadId,
                departmentIds: finalDepartmentIds,
                parameterItemIds: finalParameterItemIds,
                profileId: effectiveProfile?.id || "",
              } as CreateDocumentBody,
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

  const handleGenerateTemplate = async () => {
    if (!generateTemplateAction) {
      toast.error("Generate template action not available");
      return;
    }

    const departmentId = selectedDepartmentIds[0] || validDepartmentIds[0];
    if (!departmentId) {
      toast.error("Please select a department");
      return;
    }

    setIsGeneratingTemplate(true);
    try {
      const result = await generateTemplateAction({
        body: {
          departmentId,
          profileId: effectiveProfile?.id || undefined,
          documentId: isEditMode && documentId ? documentId : undefined,
        } as GenerateTemplateBody,
      });

      if (result.success) {
        setTemplateHtml(result.template_html);
        // Validate template_schema structure before setting
        if (isTemplateSchema(result.template_schema)) {
          setTemplateSchema(result.template_schema);
        } else {
          toast.error("Invalid template schema structure");
          return;
        }
        // Extract upload_id from result - it's part of GenerateTemplateOut
        setTemplateUploadId(result.upload_id || null);
        setSelectedTemplateId(result.upload_id || null);
        setIsTemplateMode(true);
        setTemplateArgs({});

        // If template_mapping is returned (when documentId was provided), update state
        if (result.template_mapping && isEditMode) {
          // Type assertion needed since API returns dict[str, Any] but we need TemplateInfo structure
          const mapping = result.template_mapping as Record<
            string,
            {
              template_args: Record<string, unknown>;
              active: boolean;
              created_at: string;
              updated_at: string;
            }
          >;
          setTemplateMapping(mapping);
        }

        toast.success("Template generated successfully");
      } else {
        toast.error(result.message || "Failed to generate template");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate template"
      );
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleTemplateSelect = async (templateId: string | null) => {
    if (!templateId) {
      // Create new template - clear current template
      setSelectedTemplateId(null);
      setTemplateHtml(null);
      setTemplateSchema(null);
      setTemplateUploadId(null);
      setTemplateArgs({});
      return;
    }

    const template = templateMapping[templateId];
    if (!template) {
      toast.error("Template not found");
      return;
    }

    // Set the selected template ID
    setSelectedTemplateId(templateId);
    setTemplateUploadId(templateId);

    // Enable template mode when switching to a template
    setIsTemplateMode(true);

    // Parse template schema from template_args
    const schema = template.template_args;
    if (isTemplateSchema(schema)) {
      setTemplateSchema(schema);
      // Initialize template args to empty object for the new template
      // User will fill in the values via the form
      setTemplateArgs({});
    } else {
      toast.error("Invalid template schema");
      return;
    }

    // Load template HTML from upload endpoint
    if (isEditMode && documentId && templateId) {
      try {
        const response = await fetch(`/api/uploads/download/${templateId}`, {
          method: "GET",
          credentials: "include",
        });
        if (response.ok) {
          const html = await response.text();
          setTemplateHtml(html);
        }
        // Silently handle errors - template HTML will remain as previous value
      } catch {
        // Silently handle errors - template HTML will remain as previous value
      }
    }
  };

  const handleCreateTemplateDocument = async () => {
    if (!templateUploadId || !effectiveProfile?.id || !createDocumentAction) {
      toast.error("Template upload ID required");
      return;
    }

    if (!templateSchema) {
      toast.error("Template schema required");
      return;
    }

    const finalDepartmentIds = transformDepartmentIdsForSubmit(
      selectedDepartmentIds,
      isSuperadmin,
      validDepartmentIds
    );

    try {
      const createResult = await createDocumentAction({
        body: {
          name: `Template Document - ${new Date().toLocaleString()}`,
          description: "",
          uploadId: null,
          departmentIds: finalDepartmentIds,
          parameterItemIds: [],
          profileId: effectiveProfile.id,
          templateUploadId: templateUploadId,
          // TemplateSchema is a structured object that needs to be sent as Record<string, unknown>
          // to match server's dict[str, Any] type
          templateArgs: templateSchema as unknown as Record<string, unknown>,
        } as CreateDocumentBody,
      });

      if (createResult.success && createResult.documentId) {
        toast.success("Template document created successfully");
        setTimeout(() => {
          router.push(`/management/documents/d/${createResult.documentId}`);
          router.refresh();
        }, 1000);
      } else {
        toast.error(
          createResult.message || "Failed to create template document"
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create template document"
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      // Edit mode: Update document
      if (!updateDocumentAction || !documentId) return;

      setIsSubmitting(true);
      try {
        const updateBody: UpdateDocumentBody = {
          documentId,
          name: formData.name,
          description: formData.description,
          active: formData.active,
          department_id:
            formData.departmentIds.length > 0
              ? (formData.departmentIds[0] ?? null)
              : null,
          parameter_item_ids: formData.parameterItemIds,
          classify_agent_id: formData.classifyAgentId ?? null,
          document_agent_id: formData.documentAgentId ?? null,
          templateUploadId:
            isTemplateDocument && templateUploadId ? templateUploadId : null,
          templateArgs: isTemplateDocument
            ? (templateArgs as Record<string, unknown> | null)
            : null,
        };
        await updateDocumentAction({ body: updateBody });

        toast.success("Document updated successfully");
        router.push("/management/documents");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update document"
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Create mode: Upload files or create template document
      if (isTemplateMode && templateUploadId) {
        // Create template document
        await handleCreateTemplateDocument();
      } else if (pendingFiles.length === 0) {
        toast.error("Please select at least one file to upload");
        return;
      } else if (!canSubmit) {
        const firstError = Object.values(validationErrors)[0];
        if (firstError && firstError.length > 0) {
          toast.error(firstError[0]);
        }
        return;
      } else {
        // Upload regular files
        const finalDepartmentIds = transformDepartmentIdsForSubmit(
          selectedDepartmentIds,
          isSuperadmin,
          validDepartmentIds
        );

        for (const file of pendingFiles) {
          const fc = perFile[file.name] ?? {
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
      }
    }
  };

  // Handle template switch change
  const handleTemplateChange = (checked: boolean) => {
    setIsTemplateMode(checked);
    if (!checked) {
      // Reset template mode when turning off
      setTemplateHtml(null);
      setTemplateSchema(null);
      setTemplateUploadId(null);
      setTemplateArgs({});
    }
  };

  // Handle generate template - sets template mode and updates formData
  const handleGenerateTemplateWithSwitch = async () => {
    await handleGenerateTemplate();
  };

  return (
    <div className="space-y-6">
      {/* Create Mode: File Classification Table */}
      {!isEditMode && !isTemplateMode && pendingFiles.length > 0 && (
        <div className="space-y-4">
          <Label className="text-base font-semibold">File Classification</Label>
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
                  parameterName="Fields"
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
                          parameterItemMapping[itemId]?.parameter_id === paramId
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
                  <TableHead className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Fields</span>
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
                    parameterItemIds: [...globalDefaultParameterItemIds],
                    departmentIds: selectedDepartmentIds,
                  };

                  const keepDefault = keepDefaultPerFile[file.name] ?? true;

                  const useDefaultDepartment = keepDefault;
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
                          <Badge variant="secondary" className="text-xs w-fit">
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
                                  const prevForFile: FileClassification = prev[
                                    file.name
                                  ] ?? {
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
                          parameterName="Fields"
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
                                  parameterItemMapping[itemId]?.parameter_id ===
                                  paramId
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
                    setPendingFiles((prev) => [...prev, ...next]);
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
        </div>
      )}

      {/* Form Fields - Inline, No Cards */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {/* Document name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Document name"
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Document description */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Document description"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Department Selection */}
          {validDepartmentIds && validDepartmentIds.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>Department</Label>
              <DepartmentPicker
                mapping={departmentMapping}
                validIds={validDepartmentIds}
                selectedIds={
                  isEditMode ? formData.departmentIds : selectedDepartmentIds
                }
                onSelect={(ids) => {
                  if (isEditMode) {
                    setFormData((prev) => ({ ...prev, departmentIds: ids }));
                  } else {
                    setSelectedDepartmentIds(ids);
                  }
                }}
                multiSelect={true}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Agent Selection */}
          {isEditMode &&
            (() => {
              const classifyAgentIds =
                documentDetail?.valid_agent_ids?.filter((id) => {
                  const agent = agentMapping[id];
                  return agent?.roles?.includes("classify");
                }) || [];

              const documentAgentIds =
                documentDetail?.valid_agent_ids?.filter((id) => {
                  const agent = agentMapping[id];
                  return agent?.roles?.includes("document");
                }) || [];

              // Only show agent pickers if there's more than one option
              const showClassifyPicker = classifyAgentIds.length > 1;
              const showDocumentPicker = documentAgentIds.length > 1;

              if (!showClassifyPicker && !showDocumentPicker) {
                return null;
              }

              return (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {/* Classify Agent */}
                  {showClassifyPicker && (
                    <div className="space-y-2">
                      <Label htmlFor="classifyAgentId">Classify Agent</Label>
                      {formData?.classifyAgentId !== undefined ? (
                        <AgentPicker
                          mapping={agentMapping}
                          validIds={classifyAgentIds}
                          selectedIds={
                            formData?.classifyAgentId
                              ? [formData.classifyAgentId]
                              : []
                          }
                          onSelect={(ids) =>
                            setFormData((prev) => ({
                              ...prev,
                              classifyAgentId: ids[0] || null,
                            }))
                          }
                          placeholder="Select classify agent"
                          disabled={isSubmitting}
                          multiSelect={false}
                        />
                      ) : null}
                    </div>
                  )}

                  {/* Document Agent */}
                  {showDocumentPicker && (
                    <div className="space-y-2">
                      <Label htmlFor="documentAgentId">Document Agent</Label>
                      {formData?.documentAgentId !== undefined ? (
                        <AgentPicker
                          mapping={agentMapping}
                          validIds={documentAgentIds}
                          selectedIds={
                            formData?.documentAgentId
                              ? [formData.documentAgentId]
                              : []
                          }
                          onSelect={(ids) =>
                            setFormData((prev) => ({
                              ...prev,
                              documentAgentId: ids[0] || null,
                            }))
                          }
                          placeholder="Select document agent"
                          disabled={isSubmitting}
                          multiSelect={false}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Active status */}
          <div className="space-y-2 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="active"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, active: checked }))
                  }
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Inactive documents will not be available for use in scenarios or
                simulations
              </p>
            </div>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-2">
            <Label>Fields</Label>
            <ParameterItemPicker
              mapping={parameterItemMapping}
              selectedIds={
                isEditMode
                  ? formData.parameterItemIds
                  : globalDefaultParameterItemIds
              }
              onSelect={(ids) => {
                if (isEditMode) {
                  setFormData((prev) => ({
                    ...prev,
                    parameterItemIds: ids as string[],
                  }));
                } else {
                  setGlobalDefaultParameterItemIds(ids as string[]);
                }
              }}
              validIds={
                isEditMode
                  ? validParameterItemIds
                  : filteredValidParameterItemIds
              }
              parameterId=""
              parameterName="Fields"
              allowCreate={false}
              multiSelect={true}
              badgesPosition="below"
              showClearAll={true}
              disabled={isSubmitting}
            />
          </div>

          {/* Template Switch with Generate Button */}
          <div className="space-y-2 pt-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="template"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                    Template
                  </Label>
                  <Switch
                    id="template"
                    checked={
                      isTemplateMode ||
                      (isEditMode && !!documentDetail?.template)
                    }
                    onCheckedChange={handleTemplateChange}
                    disabled={isSubmitting}
                  />
                </div>
                {(isTemplateMode ||
                  (isEditMode && !!documentDetail?.template)) && (
                  <div className="flex items-center gap-2">
                    {isEditMode &&
                      documentDetail &&
                      Object.keys(templateMapping).length > 0 && (
                        <TemplatePicker
                          templateMapping={templateMapping}
                          selectedTemplateId={selectedTemplateId}
                          onSelect={handleTemplateSelect}
                          onCreateNew={() => handleTemplateSelect(null)}
                          disabled={isSubmitting || isGeneratingTemplate}
                          buttonClassName="h-8"
                        />
                      )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleGenerateTemplateWithSwitch}
                      disabled={isGeneratingTemplate || activeUploads.size > 0}
                      className="h-8"
                    >
                      {isGeneratingTemplate ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Template documents can be dynamically rendered with variable
                arguments for personalized content generation
              </p>
            </div>
          </div>
        </div>

        {/* Document Viewer, Upload Dropzone, or Template Preview - Always in same spot */}
        {isTemplateDocument ? (
          /* Template Preview - side by side layout, 50% each */
          templateSchemaForDisplay && templateHtmlForDisplay ? (
            <div className="flex gap-4 min-h-[400px] max-h-[600px]">
              {/* Template Preview - 50% width */}
              <div className="w-1/2 flex flex-col min-h-0">
                <div className="border rounded-md flex-1 min-h-0 flex flex-col overflow-hidden">
                  <TemplatePreview
                    documentId={documentId || null}
                    templateHtml={templateHtmlForDisplay}
                    renderedHtml={clientRenderedHtml}
                  />
                </div>
              </div>
              {/* Template Args - 50% width with scroll */}
              <div className="w-1/2 flex flex-col min-h-0">
                <div className="border rounded-md flex-1 min-h-0 overflow-y-auto p-4">
                  <TemplateForm
                    schema={templateSchemaForDisplay}
                    values={templateArgs}
                    onChange={setTemplateArgs}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Show empty template preview when template mode is on but no template exists */
            <div className="border rounded-md min-h-[400px]">
              <TemplatePreview
                documentId={documentId || null}
                templateHtml={null}
                renderedHtml={null}
              />
            </div>
          )
        ) : isEditMode && documentDetail?.upload_id ? (
          /* Edit mode: Document Viewer - Show uploaded document */
          <div className="border rounded-md min-h-[400px]">
            <DocumentViewer
              document={{
                document_id: documentDetail.document_id || documentId || "",
                name: documentDetail.name || "",
                updatedAt:
                  documentDetail.updated_at || new Date().toISOString(),
                extension: documentDetail.extension || "",
                scenario_ids: documentDetail.scenario_ids || [],
                can_edit: documentDetail.can_edit ?? true,
                can_delete: documentDetail.can_delete ?? false,
                active: documentDetail.active ?? true,
                department_ids: documentDetail.department_ids || null,
                upload_id: documentDetail.upload_id || null,
                parameter_item_ids: documentDetail.parameter_item_ids || [],
              }}
              bare={true}
            />
          </div>
        ) : !isEditMode ? (
          /* Create mode: File Upload Dropzone */
          <div className="space-y-4">
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
            </div>

            {/* Active uploads */}
            {activeUploads.size > 0 && (
              <div className="space-y-2">
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
          </div>
        ) : null}

        {/* Submit buttons */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/management/documents")}
            disabled={isSubmitting || activeUploads.size > 0}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              activeUploads.size > 0 ||
              (!isEditMode && !isTemplateMode && pendingFiles.length === 0) ||
              (!isEditMode && !isTemplateMode && !canSubmit) ||
              (!isEditMode && isTemplateMode && !templateUploadId)
            }
            data-testid={
              isEditMode ? "document-update-submit" : "document-classify-submit"
            }
          >
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Uploading..."
              : isEditMode
                ? "Update"
                : isTemplateMode
                  ? "Create Template Document"
                  : "Start Upload"}
          </Button>
        </div>
      </form>
    </div>
  );
}
