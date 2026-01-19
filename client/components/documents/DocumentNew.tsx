/**
 * DocumentNew.tsx
 * Refactored Document component following Persona.tsx pattern
 * Removed all template logic, converted to resource-based pattern
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Uploads } from "@/components/resources/Uploads";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveDocumentIn = InputOf<"/api/v4/documents/save", "post">;
type SaveDocumentOut = OutputOf<"/api/v4/documents/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<"/api/v4/resources/fields", "post">;
type CreateDraftUploadsIn = InputOf<"/api/v4/resources/uploads", "post">;
type CreateDraftUploadsOut = OutputOf<"/api/v4/resources/uploads", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v4/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/documents/draft", "patch">;

type DocumentData = OutputOf<"/api/v4/documents/get", "post">;
type DocumentsListOut = OutputOf<"/api/v4/documents/list", "post">;

export interface DocumentProps {
  documentId?: string;
  mode?: "create" | "edit";
  // Server-provided data
  documentDetail?: DocumentData;
  documentDetailDefault?: DocumentsListOut;
  // Server actions
  saveDocumentAction?: (input: SaveDocumentIn) => Promise<SaveDocumentOut>;
  patchDocumentDraftAction?: (
    input: PatchDocumentDraftIn
  ) => Promise<PatchDocumentDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createUploadsAction?: (
    input: CreateDraftUploadsIn
  ) => Promise<CreateDraftUploadsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createFieldsAction?: (
    input: CreateDraftFieldsIn
  ) => Promise<CreateDraftFieldsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
}

function DocumentComponent({
  documentId,
  mode = documentId ? "edit" : "create",
  documentDetail: serverDocumentDetail,
  documentDetailDefault: serverDocumentDetailDefault,
  saveDocumentAction,
  patchDocumentDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createUploadsAction,
  createFlagsAction,
  createFieldsAction,
  createDepartmentsAction,
}: DocumentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!documentId;
  const {
    effectiveProfile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // Use server-provided data directly
  const documentDetail = serverDocumentDetail;
  const documentDetailDefault = serverDocumentDetailDefault;

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const documentSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
      fieldSearch: parseAsString,
      uploadSearch: parseAsString,
      // Filter params (URL-backed)
      fieldShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store documentDetail to prevent callback recreation on every render
  const documentDetailRef = React.useRef(documentDetail);
  React.useEffect(() => {
    documentDetailRef.current = documentDetail;
  }, [documentDetail]);

  // Memoize documentDetail fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableDocumentDataFields = React.useMemo(() => {
    if (!documentDetail) return null;
    return {
      group_id: documentDetail.group_id,
      name_resource: documentDetail.name_resource,
      show_name: documentDetail.show_name,
      name_suggestions: documentDetail.name_suggestions,
      names: documentDetail.names,
      name_required: documentDetail.name_required,
      name_agent_id: documentDetail.name_agent_id,
      description_resource: documentDetail.description_resource,
      show_description: documentDetail.show_description,
      description_suggestions: documentDetail.description_suggestions,
      description_required: documentDetail.description_required,
      description_agent_id: documentDetail.description_agent_id,
      descriptions: documentDetail.descriptions,
      department_resources: documentDetail.department_resources,
      show_departments: documentDetail.show_departments,
      department_suggestions: documentDetail.department_suggestions,
      departments_required: documentDetail.departments_required,
      departments_agent_id: documentDetail.departments_agent_id,
      departments: documentDetail.departments,
      flag_resource: documentDetail.flag_resource,
      show_flag: documentDetail.show_flag,
      flag_required: documentDetail.flag_required,
      flag_agent_id: documentDetail.flag_agent_id,
      field_resources: documentDetail.field_resources,
      show_fields: documentDetail.show_fields,
      field_suggestions: documentDetail.field_suggestions,
      fields_required: documentDetail.fields_required,
      fields_agent_id: documentDetail.fields_agent_id,
      fields: documentDetail.fields,
      upload_resources: documentDetail.upload_resources,
      show_uploads: documentDetail.show_uploads,
      upload_suggestions: documentDetail.upload_suggestions,
      uploads_required: documentDetail.uploads_required,
      uploads_agent_id: documentDetail.uploads_agent_id,
      uploads: documentDetail.uploads,
      basic_agent_id: documentDetail.basic_agent_id,
      fields_agent_id: documentDetail.fields_agent_id,
      uploads_agent_id: documentDetail.uploads_agent_id,
      can_edit: documentDetail.can_edit,
      disabled_reason: documentDetail.disabled_reason,
    };
    // Intentionally depend on individual documentDetail fields, not whole object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentDetail?.group_id,
    documentDetail?.name_resource,
    documentDetail?.show_name,
    documentDetail?.name_suggestions,
    documentDetail?.names,
    documentDetail?.name_required,
    documentDetail?.name_agent_id,
    documentDetail?.description_resource,
    documentDetail?.show_description,
    documentDetail?.description_suggestions,
    documentDetail?.description_required,
    documentDetail?.description_agent_id,
    documentDetail?.descriptions,
    documentDetail?.department_resources,
    documentDetail?.show_departments,
    documentDetail?.department_suggestions,
    documentDetail?.departments_required,
    documentDetail?.departments_agent_id,
    documentDetail?.departments,
    documentDetail?.flag_resource,
    documentDetail?.show_flag,
    documentDetail?.flag_required,
    documentDetail?.flag_agent_id,
    documentDetail?.field_resources,
    documentDetail?.show_fields,
    documentDetail?.field_suggestions,
    documentDetail?.fields_required,
    documentDetail?.fields_agent_id,
    documentDetail?.fields,
    documentDetail?.upload_resources,
    documentDetail?.show_uploads,
    documentDetail?.upload_suggestions,
    documentDetail?.uploads_required,
    documentDetail?.uploads_agent_id,
    documentDetail?.uploads,
    documentDetail?.basic_agent_id,
    documentDetail?.fields_agent_id,
    documentDetail?.uploads_agent_id,
    documentDetail?.can_edit,
    documentDetail?.disabled_reason,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableDocumentDataFields to prevent callback recreation when documentDetail object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableDocumentDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableDocumentDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableDocumentDataFields.description_resource?.generated ?? false
          );
        case "flags":
          return stableDocumentDataFields.flag_resource?.generated ?? false;
        case "departments":
          return (
            stableDocumentDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        case "fields":
          return (
            stableDocumentDataFields.field_resources?.some(
              (f) => f.generated
            ) ?? false
          );
        case "uploads":
          return (
            stableDocumentDataFields.upload_resources?.some(
              (u) => u.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableDocumentDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = documentDetailRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        field_ids: [] as string[],
        upload_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_resource?.id ?? null,
      description_id: data.description_resource?.id ?? null,
      active_flag_id: data.flag_resource?.id ?? null,
      department_ids: data.department_ids ?? [],
      field_ids: data.field_ids ?? [],
      upload_ids: data.upload_ids ?? [],
    };
    // Remove documentDetail from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(documentDetail?.department_ids ?? []),
    [documentDetail?.department_ids]
  );
  const fieldIdsStr = React.useMemo(
    () => JSON.stringify(documentDetail?.field_ids ?? []),
    [documentDetail?.field_ids]
  );
  const uploadIdsStr = React.useMemo(
    () => JSON.stringify(documentDetail?.upload_ids ?? []),
    [documentDetail?.upload_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateFieldIdsStr = React.useMemo(
    () => JSON.stringify(formState.field_ids),
    [formState.field_ids]
  );
  const formStateUploadIdsStr = React.useMemo(
    () => JSON.stringify(formState.upload_ids),
    [formState.upload_ids]
  );

  // Update form state when server data changes
  // Use documentDetail directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.field_ids) !== JSON.stringify(newState.field_ids) ||
        JSON.stringify(prev.upload_ids) !== JSON.stringify(newState.upload_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    documentDetail?.name_resource?.id,
    documentDetail?.description_resource?.id,
    documentDetail?.flag_resource?.id,
    departmentIdsStr,
    fieldIdsStr,
    uploadIdsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    documentDetail && "draft_version" in documentDetail
      ? (documentDetail as { draft_version?: number | null }).draft_version
      : null;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Use ref to stabilize patchDocumentDraftAction to prevent effect recreation when prop reference changes
  const patchDocumentDraftActionRef = React.useRef(patchDocumentDraftAction);
  React.useEffect(() => {
    patchDocumentDraftActionRef.current = patchDocumentDraftAction;
  }, [patchDocumentDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      department_ids: formState.department_ids,
      field_ids: formState.field_ids,
      upload_ids: formState.upload_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateDepartmentIdsStr,
    formStateFieldIdsStr,
    formStateUploadIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.department_ids.length > 0 ||
      formState.field_ids.length > 0 ||
      formState.upload_ids.length > 0;

    if (!hasResourceIds || !patchDocumentDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchDocumentDraftActionRef.current) return;
        const result = await patchDocumentDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            field_ids: formState.field_ids,
            upload_ids: formState.upload_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchDocumentDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchDocumentDraftAction and setDraftId are accessed via refs
  ]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from documentDetail (no need to track multiple)
    const currentGroupId = documentDetail?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      field_ids?: string[];
      department_ids?: string[];
      upload_ids?: string[];
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "document" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this document or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "fields",
        "uploads",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        // Only update the field that matches resource_type (others will be null)
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;
          if (data.field_ids && data.field_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newFieldIds = data.field_ids.filter(
              (id) => !prev.field_ids.includes(id)
            );
            updates.field_ids = [...prev.field_ids, ...newFieldIds];
          }
          if (data.department_ids && data.department_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newDeptIds = data.department_ids.filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (data.upload_ids && data.upload_ids.length > 0) {
            // For arrays, append new IDs (avoid duplicates)
            const newUploadIds = data.upload_ids.filter(
              (id) => !prev.upload_ids.includes(id)
            );
            updates.upload_ids = [...prev.upload_ids, ...newUploadIds];
          }

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "document" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this document or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "document" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this document or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "fields",
        "uploads",
      ];
      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    // Listen to document-specific events filtered by artifact_type and group_id
    socket.on("document_generation_progress", handleGenerationProgress);
    socket.on("document_generation_complete", handleGenerationComplete);
    socket.on("document_generation_error", handleGenerationError);

    return () => {
      socket.off("document_generation_progress", handleGenerationProgress);
      socket.off("document_generation_complete", handleGenerationComplete);
      socket.off("document_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, documentDetail?.group_id]);

  // Multi-generation handler - accepts list of resource types and optional user instructions
  // Helper function to determine agent_type from resource types
  const determineAgentType = useCallback(
    (resourceTypes: ResourceType[]): string | null => {
      const basicResources: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
      ];
      const allResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
        "departments",
        "fields",
        "uploads",
      ];

      const isBasicCombo =
        resourceTypes.length === basicResources.length &&
        resourceTypes.every((rt) => basicResources.includes(rt));
      const isAllResources =
        resourceTypes.length === allResourceTypes.length &&
        resourceTypes.every((rt) => allResourceTypes.includes(rt));

      if (isAllResources) {
        return "general";
      } else if (isBasicCombo) {
        return "basic";
      } else if (resourceTypes.length === 1) {
        // Single resource type - map to agent_type
        const agentTypeMap: Record<ResourceType, string> = {
          names: "name",
          descriptions: "description",
          flags: "flags",
          departments: "departments",
          fields: "fields",
          uploads: "uploads",
        };
        const firstType = resourceTypes[0];
        if (firstType && firstType in agentTypeMap) {
          return agentTypeMap[firstType];
        }
      }
      return null;
    },
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const fieldSearch =
        (formData["fieldSearch"] as string | undefined) ?? null;
      const uploadSearch =
        (formData["uploadSearch"] as string | undefined) ?? null;
      const fieldShowSelected =
        (formData["fieldShowSelected"] as boolean | undefined) ?? false;

      // Emit document_generate event
      socket.emit("document_generate", {
        resource_types: resourceTypes, // Simple array of strings
        agent_type: agentType,
        user_instructions: userInstructions ? [userInstructions] : null,
        // GetDocumentApiRequest fields from formData
        draft_id: draftId || null,
        field_search: fieldSearch || null,
        upload_search: uploadSearch || null,
        field_show_selected: fieldShowSelected || false,
        mcp: false,
        document_id: documentId || null,
      });
    },
    [socket, isConnected, documentId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () =>
      handleGenerateResources(["names"], determineAgentType(["names"])),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDescription = useCallback(
    async () =>
      handleGenerateResources(
        ["descriptions"],
        determineAgentType(["descriptions"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateDepartments = useCallback(
    async () =>
      handleGenerateResources(
        ["departments"],
        determineAgentType(["departments"])
      ),
    [handleGenerateResources, determineAgentType]
  );

  const handleGenerateFlags = useCallback(
    async () =>
      handleGenerateResources(["flags"], determineAgentType(["flags"])),
    [handleGenerateResources, determineAgentType]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!documentDetail) return false;
    return !documentDetail.can_edit;
  }, [documentDetail]);

  // Set breadcrumb context when document data is loaded
  useEffect(() => {
    const documentName = documentDetail?.name_resource?.name;
    if (documentName && documentId && isEditMode) {
      setEntityMetadata({
        entityId: documentId,
        entityName: documentName,
        entityType: "document",
      });
    }
    return () => clearEntityMetadata();
  }, [
    documentDetail,
    documentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Set generation capability when document data is loaded
  useEffect(() => {
    if (documentDetail?.basic_agent_id) {
      setGenerationCapability({
        artifactType: "document",
        canGenerate: true,
        agentId: documentDetail.basic_agent_id,
      });
    } else {
      setGenerationCapability({
        artifactType: "document",
        canGenerate: false,
        agentId: null,
      });
    }
    return () => clearGenerationCapability();
  }, [
    documentDetail?.basic_agent_id,
    setGenerationCapability,
    clearGenerationCapability,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from documentDetail
      if (documentDetail?.name_required && !formState.name_id) {
        toast.error("Document name is required");
        throw new Error("Document name is required");
      }

      if (
        documentDetail?.departments_required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        documentDetail?.fields_required &&
        (!formState.field_ids || formState.field_ids.length === 0)
      ) {
        toast.error("Fields are required");
        throw new Error("Fields are required");
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveDocumentAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveDocumentAction({
          body: {
            input_document_id: isEditMode && documentId ? documentId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            field_ids: formState.field_ids || [],
            upload_ids: formState.upload_ids || [],
            // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
          },
        });
        toast.success(
          `Document ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/management/documents");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} document: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      documentId,
      effectiveProfile?.id,
      saveDocumentAction,
      router,
      documentDetail?.name_required,
      documentDetail?.departments_required,
      documentDetail?.fields_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasFields = formState.field_ids.length > 0;
      const hasUploads = formState.upload_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "fields":
          if (!hasName || !hasDescription) return "pending";
          return hasFields ? "completed" : "active";
        case "uploads":
          if (!hasName || !hasDescription) return "pending";
          return hasUploads ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      fields: ["fields"],
      uploads: ["uploads"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "fields",
        "uploads",
      ], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<ResourceType, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      fields: "Fields",
      uploads: "Uploads",
      colors: "Colors", // Not used but required by type
      icons: "Icons", // Not used but required by type
      instructions: "Instructions", // Not used but required by type
      examples: "Examples", // Not used but required by type
    }),
    []
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt],
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
      const agentType = determineAgentType(resourceTypes);
      await handleGenerateResources(
        resourceTypes,
        agentType,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources, determineAgentType]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (documentDetail?.basic_agent_id) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [documentDetail?.basic_agent_id, handleOpenStepCardModal]);

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the document name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields (parameter items) for this document.",
        resetFields: ["field_ids"],
      },
      {
        id: "uploads",
        title: "Files",
        description: "Upload files for this document.",
        resetFields: ["upload_ids"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "department_ids",
      "field_ids",
      "upload_ids",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "fields":
        return "Fields reset";
      case "uploads":
        return "Uploads reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/management/documents",
      backLabel: "Back",
      createLabel: "Create Document",
      updateLabel: "Update Document",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      // Use memoized fields to avoid dependency on documentDetail object reference
      const currentDocumentData = stableDocumentDataFields;
      switch (stepId) {
        case "basic":
          const descriptionSearchTerm =
            (stepFormData["descriptionSearch"] as string | null | undefined) ||
            "";
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentDocumentData?.name_resource ?? null}
                  show_name={currentDocumentData?.show_name ?? true}
                  name_suggestions={currentDocumentData?.name_suggestions ?? []}
                  names={currentDocumentData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Course Syllabus"
                  defaultName="New Document"
                  required={currentDocumentData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentDocumentData?.group_id ?? null}
                  agent_id={currentDocumentData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={[
                "name",
                "description",
                "descriptionSearch",
                "department_ids",
                "active",
              ]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                currentDocumentData?.basic_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentDocumentData?.description_resource ?? null
                  }
                  show_description={
                    currentDocumentData?.show_description ?? true
                  }
                  description_suggestions={
                    currentDocumentData?.description_suggestions ?? []
                  }
                  descriptions={currentDocumentData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={descriptionSearchTerm}
                  onSearchChange={(term) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Document description and purpose"
                  required={currentDocumentData?.description_required ?? false}
                  rows={4}
                  data-testid="input-document-description"
                  group_id={currentDocumentData?.group_id ?? null}
                  agent_id={currentDocumentData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentDocumentData?.department_resources ?? []
                  }
                  show_departments={
                    currentDocumentData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentDocumentData?.department_suggestions ?? []
                  }
                  departments={currentDocumentData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={currentDocumentData?.departments_required ?? false}
                  group_id={currentDocumentData?.group_id ?? null}
                  agent_id={currentDocumentData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentDocumentData?.flag_resource ?? null}
                  show_flag={currentDocumentData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive documents will not be available for scenarios"
                  required={currentDocumentData?.flag_required ?? false}
                  group_id={currentDocumentData?.group_id ?? null}
                  agent_id={currentDocumentData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "fields":
          const fieldSearchTerm =
            (stepFormData["fieldSearch"] as string | null | undefined) || "";
          const fieldShowSelected =
            (stepFormData["fieldShowSelected"] as boolean | null | undefined) ??
            false;
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={fieldSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ fieldSearch: term || null })
              }
              searchPlaceholder="Search fields..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: fieldShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ fieldShowSelected: value || null }),
                },
              ]}
              resetFields={["field_ids", "fieldSearch", "fieldShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["fields"] &&
                stepResources["fields"].length > 0 &&
                currentDocumentData?.fields_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "fields"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "fields",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["fields"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["fields"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["fields"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Fields
                field_ids={formState.field_ids ?? []}
                field_resources={currentDocumentData?.field_resources ?? []}
                show_fields={currentDocumentData?.show_fields ?? false}
                field_suggestions={currentDocumentData?.field_suggestions ?? []}
                fields={currentDocumentData?.fields ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={currentDocumentData?.fields_required ?? false}
                group_id={currentDocumentData?.group_id ?? null}
                agent_id={currentDocumentData?.fields_agent_id ?? null}
                createFieldsAction={createFieldsAction}
                searchTerm={fieldSearchTerm}
                showSelectedFilter={fieldShowSelected}
              />
            </StepCard>
          );

        case "uploads":
          const uploadSearchTerm =
            (stepFormData["uploadSearch"] as string | null | undefined) || "";
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={uploadSearchTerm}
              onSearchChange={(term: string) =>
                setStepFormData({ uploadSearch: term || null })
              }
              searchPlaceholder="Search uploads..."
              debounceMs={300}
              resetFields={["upload_ids", "uploadSearch"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["uploads"] &&
                stepResources["uploads"].length > 0 &&
                currentDocumentData?.uploads_agent_id ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "uploads"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "uploads",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["uploads"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["uploads"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["uploads"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <Uploads
                upload_ids={formState.upload_ids ?? []}
                upload_resources={currentDocumentData?.upload_resources ?? []}
                show_uploads={currentDocumentData?.show_uploads ?? false}
                upload_suggestions={
                  currentDocumentData?.upload_suggestions ?? []
                }
                uploads={currentDocumentData?.uploads ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, upload_ids: ids }))
                }
                label="Files"
                required={currentDocumentData?.uploads_required ?? false}
                group_id={currentDocumentData?.group_id ?? null}
                agent_id={currentDocumentData?.uploads_agent_id ?? null}
                createUploadsAction={createUploadsAction}
                searchTerm={uploadSearchTerm}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      // Use stableDocumentDataFields instead of documentDetail to prevent callback recreation
      // when only object reference changes (but content is same)
      stableDocumentDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      formState.field_ids,
      formState.upload_ids,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      createFieldsAction,
      createDepartmentsAction,
      createUploadsAction,
      canRegenerate,
      handleOpenStepCardModal,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`document-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={documentDetail?.disabled_reason ?? null}
          entityType="document"
        />

        <GenericForm
          nuqsParsers={
            documentSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={documentDetail}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />

        {/* Generate/Regenerate Modal */}
        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(DocumentComponent, (prevProps, nextProps) => {
  // Compare documentDetail by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.documentDetail?.name_resource?.id,
    description_id: prevProps.documentDetail?.description_resource?.id,
    active_flag_id: prevProps.documentDetail?.flag_resource?.id,
    department_ids: prevProps.documentDetail?.department_ids,
    field_ids: prevProps.documentDetail?.field_ids,
    upload_ids: prevProps.documentDetail?.upload_ids,
  };
  const nextIds = {
    name_id: nextProps.documentDetail?.name_resource?.id,
    description_id: nextProps.documentDetail?.description_resource?.id,
    active_flag_id: nextProps.documentDetail?.flag_resource?.id,
    department_ids: nextProps.documentDetail?.department_ids,
    field_ids: nextProps.documentDetail?.field_ids,
    upload_ids: nextProps.documentDetail?.upload_ids,
  };

  // Compare primitive props
  if (
    prevProps.documentId !== nextProps.documentId ||
    prevProps.mode !== nextProps.mode ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveDocumentAction !== nextProps.saveDocumentAction ||
    prevProps.patchDocumentDraftAction !== nextProps.patchDocumentDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createUploadsAction !== nextProps.createUploadsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createFieldsAction !== nextProps.createFieldsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
