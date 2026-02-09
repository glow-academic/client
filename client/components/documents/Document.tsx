/**
 * Document.tsx
 * Implementation using modular resource components
 * Used to create and manage documents - supports both creation and editing
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
import { Flags } from "@/components/resources/FlagsLegacy";
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
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveDocumentIn = InputOf<"/api/v4/artifacts/documents/save", "post">;
type SaveDocumentOut = OutputOf<"/api/v4/artifacts/documents/save", "post">;
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
type CreateDraftUploadsIn = InputOf<"/api/v4/resources/uploads", "post">;
type CreateDraftUploadsOut = OutputOf<"/api/v4/resources/uploads", "post">;
type PatchDocumentDraftIn = InputOf<"/api/v4/artifacts/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/artifacts/documents/draft", "patch">;

type DocumentData = OutputOf<"/api/v4/artifacts/documents/get", "post">;

export interface DocumentProps {
  documentId?: string;
  mode?: "create" | "edit";
  // Server-provided data
  documentDetail?: DocumentData;
  documentDetailDefault?: DocumentData;
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
}

function DocumentComponent({
  documentId,
  mode = documentId ? "edit" : "create",
  documentDetail: documentDetailProp,
  documentDetailDefault,
  saveDocumentAction,
  patchDocumentDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createUploadsAction,
}: DocumentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!documentId;
  const documentDetail = documentDetailProp ?? documentDetailDefault;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

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
  const getInitialFormState = useCallback(() => {
    if (!documentDetail) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        field_ids: [] as string[],
        upload_ids: [] as string[],
      };
    }
    // Extract resource IDs from resource buckets
    const current = documentDetail.resources?.current;
    return {
      name_id: current?.names?.[0]?.id ?? null,
      description_id: current?.descriptions?.[0]?.id ?? null,
      active_flag_id: current?.flags?.[0]?.flag_option_id ?? null,
      department_ids:
        current?.departments?.map((d) => d.department_id).filter((x): x is string => x != null) ??
        ([] as string[]),
      field_ids:
        current?.fields?.map((f) => f.id).filter((x): x is string => x != null) ??
        ([] as string[]),
      upload_ids:
        current?.uploads?.map((u) => u.uploads_id).filter((x): x is string => x != null) ??
        ([] as string[]),
    };
  }, [documentDetail]);

  const [formState, setFormState] = useState(getInitialFormState);

  // Update form state when server data changes
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
  }, [
    documentDetail?.resources?.current?.names,
    documentDetail?.resources?.current?.descriptions,
    documentDetail?.resources?.current?.flags,
    documentDetail?.resources?.current?.departments,
    documentDetail?.resources?.current?.fields,
    documentDetail?.resources?.current?.uploads,
    getInitialFormState,
  ]);

  // Draft version tracking for optimistic concurrency control
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
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formState.department_ids,
    formState.field_ids,
    formState.upload_ids,
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
            expected_version: lastSavedVersionRef.current,
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
  }, [draftPatchKey, draftId, formState]);

  // WebSocket handlers for AI generation - unified handler for all resource types
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from documentDetail (no need to track multiple)
    const currentGroupId = documentDetail?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      // Full resource objects from server
      name_resource?: { id?: string | null } | null;
      description_resource?: { id?: string | null } | null;
      flag_resource?: { id?: string | null } | null;
      department_resources?: Array<{ department_id?: string | null }> | null;
      field_resources?: Array<{ id?: string | null }> | null;
      upload_resources?: Array<{ id?: string | null }> | null;
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
        // Extract IDs from full resource objects
        const nameId = data.name_resource?.id ?? null;
        const descriptionId = data.description_resource?.id ?? null;
        const flagId = data.flag_resource?.id ?? null;
        const deptIds = (
          data.department_resources
            ?.map((d) => d.department_id)
            .filter((x): x is string => x != null) ?? []
        );
        const fieldIds = (
          data.field_resources?.map((f) => f.id).filter((x): x is string => x != null) ?? []
        );
        const uploadIds = (
          data.upload_resources?.map((u) => u.id).filter((x): x is string => x != null) ?? []
        );

        // Update formState with extracted IDs
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (nameId) updates.name_id = nameId;
          if (descriptionId) updates.description_id = descriptionId;
          if (flagId) updates.active_flag_id = flagId;
          if (fieldIds.length > 0) {
            const newFieldIds = (fieldIds as string[]).filter(
              (id) => !prev.field_ids.includes(id)
            );
            updates.field_ids = [...prev.field_ids, ...newFieldIds];
          }
          if (deptIds.length > 0) {
            const newDeptIds = (deptIds as string[]).filter(
              (id) => !prev.department_ids.includes(id)
            );
            updates.department_ids = [...prev.department_ids, ...newDeptIds];
          }
          if (uploadIds.length > 0) {
            const newUploadIds = (uploadIds as string[]).filter(
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

  // Map resource types to domain_ids for socket emit
  const resourceTypeToDomainId = useCallback(
    (resourceType: ResourceType): string | null => {
      if (!documentDetail) return null;
      switch (resourceType) {
        case "names":
          return documentDetail.name_domain_id ?? null;
        case "descriptions":
          return documentDetail.description_domain_id ?? null;
        case "flags":
          return documentDetail.flag_domain_id ?? null;
        case "departments":
          return documentDetail.departments_domain_id ?? null;
        case "fields":
          return documentDetail.fields_domain_id ?? null;
        case "uploads":
          return documentDetail.uploads_domain_id ?? null;
        default:
          return null;
      }
    },
    [documentDetail]
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      _agentType: string | null,
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Convert resource types to domain_ids
      const domainIds = resourceTypes
        .map((rt) => resourceTypeToDomainId(rt))
        .filter(Boolean) as string[];

      if (domainIds.length === 0) {
        toast.error("No valid domains for generation");
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

      // Emit document_generate event with domain_ids
      socket.emit("document_generate", {
        domain_ids: domainIds,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        document_id: documentId || null,
      });
    },
    [socket, isConnected, documentId, resourceTypeToDomainId]
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"], null),
    [handleGenerateResources]
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"], null),
    [handleGenerateResources]
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"], null),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"], null),
    [handleGenerateResources]
  );

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      const current = documentDetail?.resources?.current;
      if (!current) return false;
      switch (resourceType) {
        case "names":
          return current.names?.[0]?.generated ?? false;
        case "descriptions":
          return current.descriptions?.[0]?.generated ?? false;
        case "flags":
          return current.flags?.[0]?.generated ?? false;
        case "departments":
          return current.departments?.some((d) => d.generated) ?? false;
        case "fields":
          return current.fields?.some((f) => f.generated) ?? false;
        case "uploads":
          return current.uploads?.some((u) => u.generated) ?? false;
        default:
          return false;
      }
    },
    [documentDetail]
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!documentDetail) return false;
    return !documentDetail.can_edit;
  }, [documentDetail]);

  // Set breadcrumb context when document data is loaded
  useEffect(() => {
    const documentName = documentDetail?.resources?.current?.names?.[0]?.name;
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
      if (!profile?.id) {
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

      const groupId = documentDetail?.group_id;
      if (!groupId) {
        toast.error("Missing group ID. Please refresh and try again.");
        throw new Error("Missing group ID");
      }

      try {
        await saveDocumentAction({
          body: {
            group_id: groupId,
            input_document_id: isEditMode && documentId ? documentId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            field_ids: formState.field_ids || [],
            upload_ids: formState.upload_ids || [],
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
      profile?.id,
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
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      fields: "Fields",
      uploads: "Uploads",
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
          label: resourceLabels[rt] ?? "",
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
      await handleGenerateResources(
        resourceTypes,
        null,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

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

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            description_id: null,
            active_flag_id: null,
            department_ids: [],
          };
        case "fields":
          return {
            ...prev,
            field_ids: [],
          };
        case "uploads":
          return {
            ...prev,
            upload_ids: [],
          };
        default:
          return prev;
      }
    });
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
                  name_resource={documentDetail?.resources?.current?.names?.[0] ?? null}
                  show_name={documentDetail?.show_name ?? true}
                  name_suggestions={documentDetail?.name_suggestions ?? []}
                  names={documentDetail?.resources?.resources?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., Course Syllabus"
                  defaultName="New Document"
                  required={documentDetail?.name_required ?? false}
                  hideDescription={true}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={documentDetail?.name_show_ai_generate ?? false}
                  create_tool_id={documentDetail?.name_create_tool_id ?? null}
                  link_tool_id={documentDetail?.name_link_tool_id ?? null}
                  createNamesAction={createNamesAction}
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
                documentDetail?.basic_show_ai_generate ? (
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
                    documentDetail?.resources?.current?.descriptions?.[0] ?? null
                  }
                  show_description={documentDetail?.show_description ?? true}
                  description_suggestions={
                    documentDetail?.description_suggestions ?? []
                  }
                  descriptions={documentDetail?.resources?.resources?.descriptions ?? []}
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
                  required={documentDetail?.description_required ?? false}
                  rows={4}
                  data-testid="input-document-description"
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={documentDetail?.description_show_ai_generate ?? false}
                  create_tool_id={documentDetail?.description_create_tool_id ?? null}
                  link_tool_id={documentDetail?.description_link_tool_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    documentDetail?.resources?.current?.departments ?? []
                  }
                  show_departments={documentDetail?.show_departments ?? false}
                  department_suggestions={
                    documentDetail?.department_suggestions ?? []
                  }
                  departments={documentDetail?.resources?.resources?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  isGenerating={isGenerating("departments")}
                  required={documentDetail?.departments_required ?? false}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={documentDetail?.departments_show_ai_generate ?? false}
                  link_tool_id={documentDetail?.departments_link_tool_id ?? null}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={(() => {
                    const f = documentDetail?.resources?.current?.flags?.[0];
                    if (!f) return null;
                    return { id: f.flag_option_id ?? null, name: f.label ?? null, description: f.description ?? null, icon: null, generated: f.generated ?? null };
                  })()}
                  show_flag={documentDetail?.show_flag ?? false}
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
                  required={documentDetail?.flag_required ?? false}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={documentDetail?.flag_show_ai_generate ?? false}
                  link_tool_id={documentDetail?.flag_link_tool_id ?? null}
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
                documentDetail?.fields_show_ai_generate ? (
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
                field_resources={documentDetail?.resources?.current?.fields ?? []}
                show_fields={documentDetail?.show_fields ?? false}
                field_suggestions={documentDetail?.field_suggestions ?? []}
                fields={documentDetail?.resources?.resources?.fields ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={documentDetail?.fields_required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={documentDetail?.fields_show_ai_generate ?? false}
                link_tool_id={documentDetail?.fields_link_tool_id ?? null}
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
              resetFields={["upload_ids", "uploadSearch"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["uploads"] &&
                stepResources["uploads"].length > 0 &&
                documentDetail?.uploads_show_ai_generate ? (
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
                upload_resources={documentDetail?.resources?.current?.uploads ?? []}
                show_uploads={documentDetail?.show_uploads ?? false}
                upload_suggestions={documentDetail?.upload_suggestions ?? []}
                uploads={documentDetail?.resources?.resources?.uploads ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, upload_ids: ids }))
                }
                label="Files"
                required={documentDetail?.uploads_required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={documentDetail?.uploads_show_ai_generate ?? false}
                create_tool_id={documentDetail?.uploads_link_tool_id ?? null}
                link_tool_id={documentDetail?.uploads_link_tool_id ?? null}
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
      documentDetail,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateDepartments,
      handleGenerateFlags,
      isGenerating,
      stepResources,
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      formState.department_ids,
      formState.field_ids,
      formState.upload_ids,
      createNamesAction,
      createDescriptionsAction,
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
          onReset={(stepId) => handleReset(stepId)}
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
  // Compare documentDetail by resource IDs from buckets, not object reference
  const prevDetail = prevProps.documentDetail ?? prevProps.documentDetailDefault;
  const nextDetail = nextProps.documentDetail ?? nextProps.documentDetailDefault;
  const prevCurrent = prevDetail?.resources?.current;
  const nextCurrent = nextDetail?.resources?.current;
  const prevIds = {
    name_id: prevCurrent?.names?.[0]?.id,
    description_id: prevCurrent?.descriptions?.[0]?.id,
    active_flag_id: prevCurrent?.flags?.[0]?.flag_option_id,
    department_ids: prevCurrent?.departments?.map((d) => d.department_id),
    field_ids: prevCurrent?.fields?.map((f) => f.id),
    upload_ids: prevCurrent?.uploads?.map((u) => u.uploads_id),
  };
  const nextIds = {
    name_id: nextCurrent?.names?.[0]?.id,
    description_id: nextCurrent?.descriptions?.[0]?.id,
    active_flag_id: nextCurrent?.flags?.[0]?.flag_option_id,
    department_ids: nextCurrent?.departments?.map((d) => d.department_id),
    field_ids: nextCurrent?.fields?.map((f) => f.id),
    upload_ids: nextCurrent?.uploads?.map((u) => u.uploads_id),
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
    prevProps.createUploadsAction !== nextProps.createUploadsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
