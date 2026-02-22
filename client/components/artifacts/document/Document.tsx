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
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Fields } from "@/components/resources/Fields";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Images } from "@/components/resources/Images";
import { Texts } from "@/components/resources/Texts";
import { Uploads } from "@/components/resources/Uploads";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

const VALID_RESOURCE_TYPES = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "fields",
  "uploads",
  "images",
  "texts",
] as const;
type DocumentResourceType = (typeof VALID_RESOURCE_TYPES)[number];

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "uploads",
  "images",
  "texts",
] as const;

const DOCUMENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "fields", formKey: "field_ids", flushKey: null, type: "multi" },
  {
    key: "uploads",
    formKey: "upload_ids",
    flushKey: "uploads_id",
    type: "multi",
  },
  {
    key: "images",
    formKey: "image_ids",
    flushKey: "image_ids",
    type: "multi",
  },
  { key: "texts", formKey: "text_ids", flushKey: "text_ids", type: "multi" },
];

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
type CreateDraftImagesIn = InputOf<"/api/v4/resources/images", "post">;
type CreateDraftImagesOut = OutputOf<"/api/v4/resources/images", "post">;
type CreateDraftTextsIn = InputOf<"/api/v4/resources/texts", "post">;
type CreateDraftTextsOut = OutputOf<"/api/v4/resources/texts", "post">;
type PatchDocumentDraftIn = InputOf<
  "/api/v4/artifacts/documents/draft",
  "patch"
>;
type PatchDocumentDraftOut = OutputOf<
  "/api/v4/artifacts/documents/draft",
  "patch"
>;

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
    input: PatchDocumentDraftIn,
  ) => Promise<PatchDocumentDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createUploadsAction?: (
    input: CreateDraftUploadsIn,
  ) => Promise<CreateDraftUploadsOut>;
  createImagesAction?: (
    input: CreateDraftImagesIn,
  ) => Promise<CreateDraftImagesOut>;
  createTextsAction?: (
    input: CreateDraftTextsIn,
  ) => Promise<CreateDraftTextsOut>;
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
  createImagesAction,
  createTextsAction,
}: DocumentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!documentId;
  const documentDetail = documentDetailProp ?? documentDetailDefault;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

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
    [],
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
        image_ids: [] as string[],
        text_ids: [] as string[],
      };
    }
    // Extract resource IDs from section-first response
    return {
      name_id: documentDetail.names?.resource?.id ?? null,
      description_id: documentDetail.descriptions?.resource?.id ?? null,
      active_flag_id: documentDetail.flags?.current?.[0]?.flag_option_id ?? null,
      department_ids:
        documentDetail.departments?.current
          ?.map((d) => d.department_id)
          .filter((x): x is string => x != null) ?? ([] as string[]),
      field_ids:
        documentDetail.fields?.current
          ?.map((f) => f.field_id)
          .filter((x): x is string => x != null) ?? ([] as string[]),
      upload_ids:
        documentDetail.uploads?.current
          ?.map((u) => u.uploads_id ?? u.upload_id)
          .filter((x): x is string => x != null) ?? ([] as string[]),
      image_ids:
        documentDetail.images?.current
          ?.map((i) => i.image_id)
          .filter((x): x is string => x != null) ?? ([] as string[]),
      text_ids:
        documentDetail.texts?.current
          ?.map((t) => t.texts_id)
          .filter((x): x is string => x != null) ?? ([] as string[]),
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
        JSON.stringify(prev.upload_ids) !== JSON.stringify(newState.upload_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(newState.image_ids) ||
        JSON.stringify(prev.text_ids) !== JSON.stringify(newState.text_ids)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    documentDetail?.names?.resource,
    documentDetail?.descriptions?.resource,
    documentDetail?.flags?.current,
    documentDetail?.departments?.current,
    documentDetail?.fields?.current,
    documentDetail?.uploads?.current,
    documentDetail?.images?.current,
    documentDetail?.texts?.current,
    getInitialFormState,
  ]);

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion = documentDetail?.draft_version;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  const formStateRef = React.useRef(formState as Record<string, unknown>);
  React.useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );

  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  React.useEffect(() => {
    if (patchDocumentDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        return await patchDocumentDraftAction({
          body: payload,
        } as PatchDocumentDraftIn);
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchDocumentDraftAction]);

  const formStateKey = React.useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        active_flag_id: formState.active_flag_id,
        department_ids: formState.department_ids,
        field_ids: formState.field_ids,
        upload_ids: formState.upload_ids,
        image_ids: formState.image_ids,
        text_ids: formState.text_ids,
      }),
    [formState],
  );

  const hasResourceIds = checkHasResourceIds(
    DOCUMENT_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => ({
      input_draft_id: inputDraftId || null,
      group_id: documentDetail?.group_id ?? null,
      ...buildDraftPayload(DOCUMENT_RESOURCES, {
        formState: formStateRef.current,
        referenceState:
          lastPatchedFormStateRef.current as unknown as Record<
            string,
            unknown
          > | null,
        flushResults: (flushResults ?? {}) as Record<string, unknown>,
      }),
      expected_version: expectedVersion,
    }),
    [documentDetail],
  );

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    serverDraftVersion: draftVersion ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = { ...formStateRef.current };
    },
  });

  // AI generation via shared hook
  const { isGenerating, generate } = useArtifactAi({
    artifactType: "document",
    groupId: documentDetail?.group_id,
    validResourceTypes: [...VALID_RESOURCE_TYPES],
  });

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string,
    ) => {
      // Read search params from formData
      const formData = formDataRef.current;
      let currentDraftId = (formData["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) {
        currentDraftId = await flushAllAndSave();
      }
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: documentId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [
      documentId,
      generate,
      flushAllAndSave,
    ],
  );

  // Individual generation handlers - generate directly without modals
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources],
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources],
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources],
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources],
  );

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!documentDetail) return false;
      switch (resourceType) {
        case "names":
          return documentDetail.names?.resource?.generated ?? false;
        case "descriptions":
          return documentDetail.descriptions?.resource?.generated ?? false;
        case "flags":
          return documentDetail.flags?.current?.[0]?.generated ?? false;
        case "departments":
          return documentDetail.departments?.current?.some((d) => d.generated) ?? false;
        case "fields":
          return documentDetail.fields?.current?.some((f) => f.generated) ?? false;
        case "uploads":
          return documentDetail.uploads?.current?.some((u) => u.generated) ?? false;
        case "images":
          return documentDetail.images?.current?.some((i) => i.generated) ?? false;
        case "texts":
          return documentDetail.texts?.current?.some((t) => t.generated) ?? false;
        default:
          return false;
      }
    },
    [documentDetail],
  );
  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ResourceType),
    [canRegenerate],
  );

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!documentDetail) return false;
    return !documentDetail.can_edit;
  }, [documentDetail]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: Record<string, unknown> = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effectiveFormState = computeEffectiveFormState(
        DOCUMENT_RESOURCES,
        formStateRef.current,
        flushResults,
      ) as unknown as typeof formState;

      // Validate required resource IDs using section required flags
      if (documentDetail?.names?.required && !effectiveFormState.name_id) {
        toast.error("Document name is required");
        throw new Error("Document name is required");
      }

      if (
        documentDetail?.departments?.required &&
        (!effectiveFormState.department_ids ||
          effectiveFormState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        documentDetail?.fields?.required &&
        (!effectiveFormState.field_ids ||
          effectiveFormState.field_ids.length === 0)
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
      if (!effectiveFormState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveDocumentAction({
          body: {
            input_document_id: isEditMode && documentId ? documentId : null,
            name_id: effectiveFormState.name_id!,
            description_id: effectiveFormState.description_id ?? null,
            flag_id: effectiveFormState.active_flag_id ?? null,
            department_ids: effectiveFormState.department_ids?.length
              ? effectiveFormState.department_ids
              : null,
            field_ids: effectiveFormState.field_ids?.length
              ? effectiveFormState.field_ids
              : null,
            upload_ids: effectiveFormState.upload_ids?.length
              ? effectiveFormState.upload_ids
              : null,
            image_ids: effectiveFormState.image_ids?.length
              ? effectiveFormState.image_ids
              : null,
            text_ids: effectiveFormState.text_ids?.length
              ? effectiveFormState.text_ids
              : null,
          },
        });
        toast.success(
          `Document ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/management/documents");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} document: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    },
    [
      documentDetail,
      formStateRef,
      isEditMode,
      documentId,
      profile?.id,
      saveDocumentAction,
      router,
      isAutosaveEnabled,
      flushAllResources,
      getInitialFormState,
      documentDetail?.names?.required,
      documentDetail?.departments?.required,
      documentDetail?.fields?.required,
      documentDetail?.group_id,
    ],
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasFields = formState.field_ids.length > 0;
      const hasUploads = formState.upload_ids.length > 0;
      const hasImages = formState.image_ids.length > 0;
      const hasTexts = formState.text_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "fields":
          if (!hasName || !hasDescription) return "pending";
          return hasFields ? "completed" : "active";
        case "uploads":
          if (!hasName || !hasDescription) return "pending";
          return hasUploads ? "completed" : "active";
        case "images":
          if (!hasName || !hasDescription) return "pending";
          return hasImages ? "completed" : "active";
        case "texts":
          if (!hasName || !hasDescription) return "pending";
          return hasTexts ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState],
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      fields: ["fields"],
      uploads: ["uploads"],
      images: ["images"],
      texts: ["texts"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "fields",
        "uploads",
        "images",
        "texts",
      ], // All resources for full-page generation
    }),
    [],
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
      images: "Images",
      texts: "Texts",
    }),
    [],
  );

  // Generation modal via shared hook
  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: (selectedResources, instructions) => {
        handleGenerateResources(selectedResources as ResourceType[], instructions);
      },
      isGenerating,
    });

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
      {
        id: "images",
        title: "Images",
        description: "Select images for this document.",
        resetFields: ["image_ids"],
      },
      {
        id: "texts",
        title: "Texts",
        description: "Select text content for this document.",
        resetFields: ["text_ids"],
      },
    ],
    [],
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
      "image_ids",
      "text_ids",
    ],
    [],
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
      case "images":
        return "Images reset";
      case "texts":
        return "Texts reset";
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
        case "images":
          return {
            ...prev,
            image_ids: [],
          };
        case "texts":
          return {
            ...prev,
            text_ids: [],
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
    [],
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
                  name_resource={
                    documentDetail?.names?.resource ?? null
                  }
                  show_name={documentDetail?.names?.show ?? true}
                  name_suggestions={documentDetail?.names?.suggestions ?? []}
                  names={documentDetail?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  placeholder="e.g., Course Syllabus"
                  defaultName="New Document"
                  required={documentDetail?.names?.required ?? false}
                  hideDescription={true}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={
                    documentDetail?.names?.show_ai_generate ?? false
                  }
                  create_tool_id={documentDetail?.names?.create_tool_id ?? null}
                  createNamesAction={createNamesAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
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
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
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
                    documentDetail?.descriptions?.resource ?? null
                  }
                  show_description={documentDetail?.descriptions?.show ?? true}
                  description_suggestions={
                    documentDetail?.descriptions?.suggestions ?? []
                  }
                  descriptions={
                    documentDetail?.descriptions?.resources ?? []
                  }
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
                  label="Description"
                  placeholder="Document description and purpose"
                  required={documentDetail?.descriptions?.required ?? false}
                  rows={4}
                  data-testid="input-document-description"
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={
                    documentDetail?.descriptions?.show_ai_generate ?? false
                  }
                  create_tool_id={
                    documentDetail?.descriptions?.create_tool_id ?? null
                  }
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    documentDetail?.departments?.current ?? []
                  }
                  show_departments={documentDetail?.departments?.show ?? false}
                  department_suggestions={
                    documentDetail?.departments?.suggestions ?? []
                  }
                  departments={
                    documentDetail?.departments?.resources ?? []
                  }
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  required={documentDetail?.departments?.required ?? false}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={
                    documentDetail?.departments?.show_ai_generate ?? false
                  }
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flags={documentDetail?.flags?.resources ?? []}
                  flag_id={formState.active_flag_id ?? null}
                  show_flags={documentDetail?.flags?.show ?? false}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  group_id={documentDetail?.group_id ?? null}
                  showAiGenerate={
                    documentDetail?.flags?.show_ai_generate ?? false
                  }
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
                documentDetail?.fields?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="fields"
                    resourceTypes={stepResources["fields"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Fields
                field_ids={formState.field_ids ?? []}
                field_resources={
                  documentDetail?.fields?.current ?? []
                }
                show_fields={documentDetail?.fields?.show ?? false}
                field_suggestions={documentDetail?.fields?.suggestions ?? []}
                fields={documentDetail?.fields?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={documentDetail?.fields?.required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={
                  documentDetail?.fields?.show_ai_generate ?? false
                }
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
                documentDetail?.uploads?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="uploads"
                    resourceTypes={stepResources["uploads"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Uploads
                upload_ids={formState.upload_ids ?? []}
                upload_resources={
                  documentDetail?.uploads?.current ?? []
                }
                show_uploads={documentDetail?.uploads?.show ?? false}
                upload_suggestions={documentDetail?.uploads?.suggestions ?? []}
                uploads={documentDetail?.uploads?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, upload_ids: ids }))
                }
                label="Files"
                required={documentDetail?.uploads?.required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={
                  documentDetail?.uploads?.show_ai_generate ?? false
                }
                create_tool_id={documentDetail?.uploads?.create_tool_id ?? null}
                createUploadsAction={createUploadsAction}
                searchTerm={uploadSearchTerm}
                registerFlush={registerFlushCallbacks["uploads"]}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </StepCard>
          );

        case "images":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["image_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["images"] &&
                stepResources["images"].length > 0 &&
                documentDetail?.images?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="images"
                    resourceTypes={stepResources["images"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Images
                image_ids={formState.image_ids ?? []}
                image_resources={
                  documentDetail?.images?.current ?? []
                }
                show_images={documentDetail?.images?.show ?? false}
                image_suggestions={documentDetail?.images?.suggestions ?? []}
                images={documentDetail?.images?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, image_ids: ids }))
                }
                label="Images"
                required={documentDetail?.images?.required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={
                  documentDetail?.images?.show_ai_generate ?? false
                }
                create_tool_id={documentDetail?.images?.create_tool_id ?? null}
                createImagesAction={createImagesAction}
                registerFlush={registerFlushCallbacks["images"]}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </StepCard>
          );

        case "texts":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["text_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["texts"] &&
                stepResources["texts"].length > 0 &&
                documentDetail?.texts?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="texts"
                    resourceTypes={stepResources["texts"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Texts
                text_ids={formState.text_ids ?? []}
                text_resources={
                  documentDetail?.texts?.current ?? []
                }
                show_texts={documentDetail?.texts?.show ?? false}
                text_suggestions={documentDetail?.texts?.suggestions ?? []}
                texts={documentDetail?.texts?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, text_ids: ids }))
                }
                label="Texts"
                required={documentDetail?.texts?.required ?? false}
                group_id={documentDetail?.group_id ?? null}
                showAiGenerate={
                  documentDetail?.texts?.show_ai_generate ?? false
                }
                create_tool_id={documentDetail?.texts?.create_tool_id ?? null}
                createTextsAction={createTextsAction}
                registerFlush={registerFlushCallbacks["texts"]}
                isAutosaveEnabled={isAutosaveEnabled}
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
      formState.image_ids,
      formState.text_ids,
      createNamesAction,
      createDescriptionsAction,
      createUploadsAction,
      createImagesAction,
      createTextsAction,
      canRegenerate,
      canRegenerateForStepCard,
      handleOpenStepCardModal,
      isAutosaveEnabled,
      registerFlushCallbacks,
    ],
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
        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(DocumentComponent, (prevProps, nextProps) => {
  // Compare documentDetail by resource IDs from sections, not object reference
  const prevDetail =
    prevProps.documentDetail ?? prevProps.documentDetailDefault;
  const nextDetail =
    nextProps.documentDetail ?? nextProps.documentDetailDefault;
  const prevIds = {
    name_id: prevDetail?.names?.resource?.id,
    description_id: prevDetail?.descriptions?.resource?.id,
    active_flag_id: prevDetail?.flags?.current?.[0]?.flag_option_id,
    department_ids: prevDetail?.departments?.current?.map((d) => d.department_id),
    field_ids: prevDetail?.fields?.current?.map((f) => f.field_id),
    upload_ids: prevDetail?.uploads?.current?.map(
      (u) => u.uploads_id ?? u.upload_id,
    ),
    image_ids: prevDetail?.images?.current?.map((i) => i.image_id),
    text_ids: prevDetail?.texts?.current?.map((t) => t.texts_id),
  };
  const nextIds = {
    name_id: nextDetail?.names?.resource?.id,
    description_id: nextDetail?.descriptions?.resource?.id,
    active_flag_id: nextDetail?.flags?.current?.[0]?.flag_option_id,
    department_ids: nextDetail?.departments?.current?.map((d) => d.department_id),
    field_ids: nextDetail?.fields?.current?.map((f) => f.field_id),
    upload_ids: nextDetail?.uploads?.current?.map(
      (u) => u.uploads_id ?? u.upload_id,
    ),
    image_ids: nextDetail?.images?.current?.map((i) => i.image_id),
    text_ids: nextDetail?.texts?.current?.map((t) => t.texts_id),
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
    prevProps.createImagesAction !== nextProps.createImagesAction ||
    prevProps.createTextsAction !== nextProps.createTextsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
