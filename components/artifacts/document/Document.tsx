/**
 * Document.tsx
 * Canonical document editor using flat GET resources and draft-only updates.
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseAsArrayOf, parseAsBoolean, parseAsString, type Parser } from "nuqs";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Images } from "@/components/resources/Images";
import { Names } from "@/components/resources/Names";
import { ParameterFields } from "@/components/resources/ParameterFields";
import { Texts } from "@/components/resources/Texts";
import { Uploads } from "@/components/resources/Uploads";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";

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

const FLUSH_KEYS = ["uploads", "images", "texts"] as const;

const DOCUMENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: null, type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: null,
    type: "multi",
  },
  {
    key: "parameter_fields",
    formKey: "parameter_field_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "files", formKey: "file_ids", flushKey: "file_ids", type: "multi" },
  {
    key: "images",
    formKey: "image_ids",
    flushKey: "image_ids",
    type: "multi",
  },
  { key: "texts", formKey: "text_ids", flushKey: "text_ids", type: "multi" },
];

type CreateDocumentIn = InputOf<"/document/create", "post">;
type CreateDocumentOut = OutputOf<"/document/create", "post">;
type UpdateDocumentIn = InputOf<"/document/update", "post">;
type UpdateDocumentOut = OutputOf<"/document/update", "post">;
type PatchDocumentDraftIn = InputOf<"/document/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/document/draft", "patch">;
type DocumentData = OutputOf<"/document/get", "post">;

type PendingImageValue = {
  name: string;
  description: string;
  upload_id: string;
};

type DocumentFormState = {
  name: string | null;
  description: string | null;
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  parameter_field_ids: string[];
  file_ids: string[];
  image_ids: string[];
  text_ids: string[];
  pending_upload_ids: string[];
  pending_text_contents: string[];
  pending_images: PendingImageValue[];
  pending_ids: string[];
};

type DocumentDraftFormState = NonNullable<PatchDocumentDraftOut["form_state"]>;

export interface DocumentProps {
  documentId?: string;
  mode?: "create" | "edit";
  documentDetail?: DocumentData;
  documentDetailDefault?: DocumentData;
  createDocumentAction?: (input: CreateDocumentIn) => Promise<CreateDocumentOut>;
  updateDocumentAction?: (input: UpdateDocumentIn) => Promise<UpdateDocumentOut>;
  patchDocumentDraftAction?: (
    input: PatchDocumentDraftIn,
  ) => Promise<PatchDocumentDraftOut>;
  uploadBasePath?: string;
  uploadFileAction?: (
    formData: FormData,
  ) => Promise<{ success: boolean; upload_id?: string; message?: string }>;
}

const collectPendingIds = (data: DocumentData | null | undefined): string[] => {
  if (!data) return [];

  const ids = new Set<string>((data.pending_ids ?? []).filter(Boolean));
  const add = (value?: string | null) => {
    if (value) ids.add(value);
  };

  (data.names ?? []).forEach((item) => item.pending && add(item.id));
  (data.descriptions ?? []).forEach((item) => item.pending && add(item.id));
  (data.flags ?? []).forEach((item) => item.pending && add(item.flag_option_id));
  (data.departments ?? []).forEach(
    (item) => item.pending && add(item.department_id),
  );
  (data.parameter_fields ?? []).forEach((item) => item.pending && add(item.id));
  (data.files ?? []).forEach((item) => item.pending && add(item.files_id ?? item.id));
  (data.images ?? []).forEach((item) => item.pending && add(item.image_id ?? item.id));
  (data.texts ?? []).forEach((item) => item.pending && add(item.texts_id ?? item.id));

  return Array.from(ids);
};

function DocumentComponent({
  documentId,
  mode = documentId ? "edit" : "create",
  documentDetail: documentDetailProp,
  documentDetailDefault,
  createDocumentAction,
  updateDocumentAction,
  patchDocumentDraftAction,
  uploadBasePath,
  uploadFileAction,
}: DocumentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!documentId;
  const documentDetail = documentDetailProp ?? documentDetailDefault ?? null;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const documentSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      fieldSearch: parseAsString,
      uploadSearch: parseAsString,
      fieldShowSelected: parseAsBoolean,
      parameterIds: parseAsArrayOf(parseAsString),
    }),
    [],
  );

  const documentDataRef = useRef(documentDetail);
  useEffect(() => {
    documentDataRef.current = documentDetail;
  }, [documentDetail]);

  const stableDocumentDataFields = useMemo(() => {
    if (!documentDetail) return null;
    return {
      names: documentDetail.names,
      descriptions: documentDetail.descriptions,
      flags: documentDetail.flags,
      departments: documentDetail.departments,
      parameter_fields: documentDetail.parameter_fields,
      parameters: documentDetail.parameters,
      files: documentDetail.files,
      images: documentDetail.images,
      texts: documentDetail.texts,
      group_id: documentDetail.group_id,
      show_ai_generate: documentDetail.show_ai_generate,
      basic_show_ai_generate: documentDetail.basic_show_ai_generate,
      content_show_ai_generate: documentDetail.content_show_ai_generate,
    };
  }, [
    documentDetail?.names,
    documentDetail?.descriptions,
    documentDetail?.flags,
    documentDetail?.departments,
    documentDetail?.parameter_fields,
    documentDetail?.parameters,
    documentDetail?.files,
    documentDetail?.images,
    documentDetail?.texts,
    documentDetail?.group_id,
    documentDetail?.show_ai_generate,
    documentDetail?.basic_show_ai_generate,
    documentDetail?.content_show_ai_generate,
  ]);

  const canRegenerate = useCallback(
    (resourceType: string): boolean => {
      if (!stableDocumentDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableDocumentDataFields.names?.find((n) => n.selected)?.generated ?? false;
        case "descriptions":
          return (
            stableDocumentDataFields.descriptions?.find((d) => d.selected)?.generated ?? false
          );
        case "flags":
          return stableDocumentDataFields.flags?.find((f) => f.selected)?.generated ?? false;
        case "departments":
          return (
            stableDocumentDataFields.departments?.filter((d) => d.selected).some((d) => d.generated) ??
            false
          );
        case "fields":
          return (
            stableDocumentDataFields.parameter_fields
              ?.filter((f) => f.selected)
              .some((f) => f.generated) ?? false
          );
        case "uploads":
          return (
            stableDocumentDataFields.files?.filter((f) => f.selected).some((f) => f.generated) ??
            false
          );
        case "images":
          return (
            stableDocumentDataFields.images?.filter((i) => i.selected).some((i) => i.generated) ??
            false
          );
        case "texts":
          return (
            stableDocumentDataFields.texts?.filter((t) => t.selected).some((t) => t.generated) ??
            false
          );
        default:
          return false;
      }
    },
    [stableDocumentDataFields],
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType),
    [canRegenerate],
  );

  const getInitialFormState = useCallback((): DocumentFormState => {
    const data = documentDataRef.current;
    if (!data) {
      return {
        name: null,
        description: null,
        name_id: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        parameter_field_ids: [],
        file_ids: [],
        image_ids: [],
        text_ids: [],
        pending_upload_ids: [],
        pending_text_contents: [],
        pending_images: [],
        pending_ids: [],
      };
    }

    return {
      name: null,
      description: null,
      name_id: data.names?.find((n) => n.selected)?.id ?? null,
      description_id: data.descriptions?.find((d) => d.selected)?.id ?? null,
      active_flag_id: data.flags?.find((f) => f.selected)?.flag_option_id ?? null,
      department_ids: (data.departments?.filter((d) => d.selected) ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      parameter_field_ids: (data.parameter_fields?.filter((f) => f.selected) ?? [])
        .map((f) => f.field_id)
        .filter(Boolean) as string[],
      file_ids: (data.files?.filter((f) => f.selected) ?? [])
        .map((f) => f.files_id ?? f.id)
        .filter(Boolean) as string[],
      image_ids: (data.images?.filter((i) => i.selected) ?? [])
        .map((i) => i.image_id ?? i.id)
        .filter(Boolean) as string[],
      text_ids: (data.texts?.filter((t) => t.selected) ?? [])
        .map((t) => t.texts_id ?? t.id)
        .filter(Boolean) as string[],
      pending_upload_ids: [],
      pending_text_contents: [],
      pending_images: [],
      pending_ids: collectPendingIds(data),
    };
  }, []);

  const [formState, setFormState] = useState<DocumentFormState>(getInitialFormState);
  const formStateRef = useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  const lastPatchedFormStateRef = useRef<DocumentFormState | null>(
    getInitialFormState(),
  );

  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  const fileIdsStr = useMemo(() => JSON.stringify(formState.file_ids), [formState.file_ids]);
  const imageIdsStr = useMemo(() => JSON.stringify(formState.image_ids), [formState.image_ids]);
  const textIdsStr = useMemo(() => JSON.stringify(formState.text_ids), [formState.text_ids]);
  const departmentIdsStr = useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids],
  );
  const parameterFieldIdsStr = useMemo(
    () => JSON.stringify(formState.parameter_field_ids),
    [formState.parameter_field_ids],
  );
  const pendingUploadIdsStr = useMemo(
    () => JSON.stringify(formState.pending_upload_ids),
    [formState.pending_upload_ids],
  );
  const pendingTextsStr = useMemo(
    () => JSON.stringify(formState.pending_text_contents),
    [formState.pending_text_contents],
  );
  const pendingImagesStr = useMemo(
    () => JSON.stringify(formState.pending_images),
    [formState.pending_images],
  );
  const pendingIdsStr = useMemo(
    () => JSON.stringify(formState.pending_ids),
    [formState.pending_ids],
  );

  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name: formState.name,
        description: formState.description,
        name_id: formState.name_id,
        description_id: formState.description_id,
        active_flag_id: formState.active_flag_id,
        department_ids: formState.department_ids,
        parameter_field_ids: formState.parameter_field_ids,
        file_ids: formState.file_ids,
        image_ids: formState.image_ids,
        text_ids: formState.text_ids,
        pending_upload_ids: formState.pending_upload_ids,
        pending_text_contents: formState.pending_text_contents,
        pending_images: formState.pending_images,
        pending_ids: formState.pending_ids,
      }),
    [
      formState.name,
      formState.description,
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      departmentIdsStr,
      parameterFieldIdsStr,
      fileIdsStr,
      imageIdsStr,
      textIdsStr,
      pendingUploadIdsStr,
      pendingTextsStr,
      pendingImagesStr,
      pendingIdsStr,
    ],
  );

  const hasResourceIds =
    checkHasResourceIds(
      DOCUMENT_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    formState.pending_upload_ids.length > 0 ||
    formState.pending_text_contents.length > 0 ||
    formState.pending_images.length > 0;

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const current = formStateRef.current as unknown as DocumentFormState;
      const ref = lastPatchedFormStateRef.current;

      const idPayload = buildDraftPayload(DOCUMENT_RESOURCES, {
        formState: formStateRef.current,
        referenceState: lastPatchedFormStateRef.current as unknown as Record<
          string,
          unknown
        > | null,
        flushResults: (flushResults ?? {}) as Record<string, unknown>,
      });

      if (current.active_flag_id !== (ref?.active_flag_id ?? null)) {
        idPayload["flag_ids"] = current.active_flag_id ? [current.active_flag_id] : null;
      }

      if (current.name != null) {
        if (!ref || current.name !== ref.name) {
          idPayload["name"] = current.name;
          delete idPayload["name_id"];
        }
      }

      if (current.description != null) {
        if (!ref || current.description !== ref.description) {
          idPayload["description"] = current.description;
          delete idPayload["description_id"];
        }
      }

      if (current.pending_upload_ids.length > 0) {
        idPayload["files"] = current.pending_upload_ids.map((upload_id) => ({
          upload_id,
        }));
      }

      if (current.pending_text_contents.length > 0) {
        idPayload["texts"] = current.pending_text_contents.map((content) => ({
          content,
        }));
      }

      if (current.pending_images.length > 0) {
        idPayload["images"] = current.pending_images;
      }

      return {
        draft_id: draftId || null,
        ...idPayload,
        ...(current.pending_ids.length ? { pending_ids: current.pending_ids } : {}),
      };
    },
    [],
  );

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as DocumentFormState),
    };
  }, []);

  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess,
  });

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !== JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.parameter_field_ids) !==
          JSON.stringify(newState.parameter_field_ids) ||
        JSON.stringify(prev.file_ids) !== JSON.stringify(newState.file_ids) ||
        JSON.stringify(prev.image_ids) !== JSON.stringify(newState.image_ids) ||
        JSON.stringify(prev.text_ids) !== JSON.stringify(newState.text_ids) ||
        JSON.stringify(prev.pending_ids) !== JSON.stringify(newState.pending_ids)
      ) {
        serverSyncPendingRef.current = true;
        lastPatchedFormStateRef.current = newState;
        return newState;
      }
      return prev;
    });
  }, [
    documentDetail?.names,
    documentDetail?.descriptions,
    documentDetail?.flags,
    documentDetail?.departments,
    documentDetail?.parameter_fields,
    documentDetail?.files,
    documentDetail?.images,
    documentDetail?.texts,
    documentDetail?.pending_ids,
    getInitialFormState,
    serverSyncPendingRef,
  ]);

  useEffect(() => {
    if (patchDocumentDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) => {
        const result = await patchDocumentDraftAction({
          body: payload,
        } as PatchDocumentDraftIn);

        const fs = result.form_state as DocumentDraftFormState | undefined;
        if (fs) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => {
            const nextState: DocumentFormState = {
              ...prev,
              name: (fs.name ?? null) as string | null,
              description: (fs.description ?? null) as string | null,
              name_id: (fs.name_id ?? prev.name_id) as string | null,
              description_id: (fs.description_id ?? prev.description_id) as string | null,
              active_flag_id:
                ((fs.flag_ids?.[0] ?? prev.active_flag_id) as string | null) ?? null,
              department_ids:
                (fs.department_ids as string[] | undefined) ?? prev.department_ids,
              parameter_field_ids:
                (fs.parameter_field_ids as string[] | undefined) ??
                prev.parameter_field_ids,
              file_ids: (fs.file_ids as string[] | undefined) ?? prev.file_ids,
              image_ids: (fs.image_ids as string[] | undefined) ?? prev.image_ids,
              text_ids: (fs.text_ids as string[] | undefined) ?? prev.text_ids,
              pending_upload_ids: [],
              pending_text_contents: [],
              pending_images: [],
              pending_ids: (fs.pending_ids as string[] | undefined) ?? prev.pending_ids,
            };
            lastPatchedFormStateRef.current = nextState;
            return nextState;
          });
        }

        return result;
      };
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchDocumentDraftAction, serverSyncPendingRef]);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "document",
    validResourceTypes: [...VALID_RESOURCE_TYPES],
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      let currentDraftId = (formDataRef.current["draftId"] as string | undefined) ?? null;
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
    [documentId, flushAllAndSave, formDataRef, generate],
  );

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
      ],
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources],
  );

  const disabled = useMemo(() => {
    if (!documentDetail) return false;
    return !documentDetail.can_edit;
  }, [documentDetail]);

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
      ) as unknown as DocumentFormState;

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!effectiveFormState.name_id && !effectiveFormState.name) {
        toast.error("Document name is required");
        throw new Error("Document name is required");
      }

      const commonFields = {
        name_id: effectiveFormState.name_id || undefined,
        name: !effectiveFormState.name_id
          ? (effectiveFormState.name ?? undefined)
          : undefined,
        description_id: effectiveFormState.description_id || undefined,
        description: !effectiveFormState.description_id
          ? (effectiveFormState.description ?? undefined)
          : undefined,
        flag_id: effectiveFormState.active_flag_id || undefined,
        department_ids: effectiveFormState.department_ids.length
          ? effectiveFormState.department_ids
          : undefined,
        field_ids: effectiveFormState.parameter_field_ids.length
          ? effectiveFormState.parameter_field_ids
          : undefined,
        upload_ids: effectiveFormState.file_ids.length
          ? effectiveFormState.file_ids
          : undefined,
        image_ids: effectiveFormState.image_ids.length
          ? effectiveFormState.image_ids
          : undefined,
        text_ids: effectiveFormState.text_ids.length
          ? effectiveFormState.text_ids
          : undefined,
      };

      try {
        if (isEditMode && documentId && updateDocumentAction) {
          await updateDocumentAction({
            body: {
              documents: [{ document_id: documentId, ...commonFields }],
            },
          } as UpdateDocumentIn);
        } else if (createDocumentAction) {
          await createDocumentAction({
            body: {
              documents: [commonFields],
            },
          } as CreateDocumentIn);
        } else {
          toast.error("Save action not available");
          throw new Error("Save action not available");
        }

        toast.success(
          `Document ${isEditMode ? "updated" : "created"} successfully!`,
        );
        router.push("/management/documents");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} document: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        throw error;
      }
    },
    [
      createDocumentAction,
      documentId,
      flushAllResources,
      isAutosaveEnabled,
      isEditMode,
      profile?.id,
      router,
      updateDocumentAction,
    ],
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name;
      const hasDescription = !!formState.description_id || !!formState.description;
      const hasFields = formState.parameter_field_ids.length > 0;
      const hasUploads = formState.file_ids.length > 0 || formState.pending_upload_ids.length > 0;
      const hasImages = formState.image_ids.length > 0 || formState.pending_images.length > 0;
      const hasTexts = formState.text_ids.length > 0 || formState.pending_text_contents.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "fields":
          if (!hasName) return "pending";
          return hasFields ? "completed" : "active";
        case "uploads":
          if (!hasName) return "pending";
          return hasUploads ? "completed" : "active";
        case "images":
          if (!hasName) return "pending";
          return hasImages ? "completed" : "active";
        case "texts":
          if (!hasName) return "pending";
          return hasTexts ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the document name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active_flag_id"],
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields (parameter items) for this document.",
        resetFields: ["parameter_field_ids", "parameterIds"],
      },
      {
        id: "uploads",
        title: "Files",
        description: "Upload files for this document.",
        resetFields: ["file_ids", "uploadSearch"],
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

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "department_ids",
      "parameter_field_ids",
      "file_ids",
      "image_ids",
      "text_ids",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "fields":
        return "Fields reset";
      case "uploads":
        return "Files reset";
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
            name: null,
            description: null,
            name_id: null,
            description_id: null,
            active_flag_id: null,
            department_ids: [],
          };
        case "fields":
          return {
            ...prev,
            parameter_field_ids: [],
          };
        case "uploads":
          return {
            ...prev,
            file_ids: [],
            pending_upload_ids: [],
          };
        case "images":
          return {
            ...prev,
            image_ids: [],
            pending_images: [],
          };
        case "texts":
          return {
            ...prev,
            text_ids: [],
            pending_text_contents: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/documents",
      backLabel: "Back",
      createLabel: "Create Document",
      updateLabel: "Update Document",
    }),
    [],
  );

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
      const s = stableDocumentDataFields;

      switch (stepId) {
        case "basic": {
          const descriptionSearchTerm =
            (stepFormData["descriptionSearch"] as string | null | undefined) || "";

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
                  name_id={formState.name_id}
                  name_resource={s?.names?.find((n) => n.selected) ?? null}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({
                      ...prev,
                      name_id: nameId,
                      name: nameId ? null : prev.name,
                    }))
                  }
                  onNameChange={(name) =>
                    setFormState((prev) => ({
                      ...prev,
                      name: name || null,
                      name_id: null,
                    }))
                  }
                  placeholder="e.g., Course Syllabus"
                  defaultName="New Document"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={[
                "name",
                "description",
                "descriptionSearch",
                "department_ids",
                "active_flag_id",
              ]}
              actions={
                s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={
                    s?.descriptions?.find((d) => d.selected) ?? null
                  }
                  show_description={true}
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                      description: descriptionId ? null : prev.description,
                    }))
                  }
                  onDescriptionChange={(description) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: description || null,
                      description_id: null,
                    }))
                  }
                  searchTerm={descriptionSearchTerm}
                  onSearchChange={(term) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  label="Description"
                  placeholder="Document description and purpose"
                  rows={4}
                  data-testid="input-document-description"
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={s?.departments?.filter((d) => d.selected) ?? []}
                  show_departments={true}
                  departments={s?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                />

                <Flags
                  flags={s?.flags ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={(s?.flags?.length ?? 0) > 0}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                />
              </div>
            </StepCard>
          );
        }

        case "fields": {
          const parameterIds =
            ((stepFormData["parameterIds"] as string[] | null | undefined) ?? []);
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["parameter_field_ids", "parameterIds"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                s?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="fields"
                    resourceTypes={stepResources["fields"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <ParameterFields
                parameterIds={parameterIds}
                parameterFieldIds={formState.parameter_field_ids}
                parameterFieldResources={
                  s?.parameter_fields?.filter((f) => f.selected) ?? []
                }
                allParameters={s?.parameters ?? []}
                availableFields={s?.parameter_fields ?? []}
                onToggleParameter={(parameterId, open) => {
                  if (open) {
                    setStepFormData({ parameterIds: [...parameterIds, parameterId] });
                  } else {
                    setStepFormData({
                      parameterIds: parameterIds.filter((id) => id !== parameterId),
                    });
                  }
                }}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    parameter_field_ids: ids,
                  }))
                }
                disabled={disabled}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </StepCard>
          );
        }

        case "uploads": {
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
              resetFields={["file_ids", "uploadSearch"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                s?.content_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="uploads"
                    resourceTypes={stepResources["uploads"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Uploads
                upload_ids={formState.file_ids}
                upload_resources={s?.files?.filter((f) => f.selected) ?? []}
                show_uploads={true}
                upload_suggestions={(s?.files ?? [])
                  .filter((f) => f.suggested)
                  .map((f) => f.files_id ?? f.id)
                  .filter(Boolean) as string[]}
                uploads={s?.files ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, file_ids: ids }))
                }
                label="Files"
                searchTerm={uploadSearchTerm}
                registerFlush={registerFlushCallbacks["uploads"]}
                isAutosaveEnabled={isAutosaveEnabled}
                onFileUploadComplete={(uploadId) =>
                  setFormState((prev) => ({
                    ...prev,
                    pending_upload_ids: [...prev.pending_upload_ids, uploadId],
                  }))
                }
                {...(uploadBasePath ? { uploadBasePath } : {})}
                {...(uploadFileAction ? { uploadFileAction } : {})}
              />
            </StepCard>
          );
        }

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
                s?.content_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="images"
                    resourceTypes={stepResources["images"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Images
                image_ids={formState.image_ids}
                image_resources={s?.images?.filter((i) => i.selected) ?? []}
                show_images={true}
                image_suggestions={(s?.images ?? [])
                  .filter((i) => i.suggested)
                  .map((i) => i.image_id ?? i.id)
                  .filter(Boolean) as string[]}
                images={s?.images ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, image_ids: ids }))
                }
                label="Images"
                registerFlush={registerFlushCallbacks["images"]}
                isAutosaveEnabled={isAutosaveEnabled}
                onImageUploadValue={(image) =>
                  setFormState((prev) => ({
                    ...prev,
                    pending_images: [...prev.pending_images, image],
                  }))
                }
                {...(uploadBasePath ? { uploadBasePath } : {})}
                {...(uploadFileAction ? { uploadFileAction } : {})}
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
                s?.content_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="texts"
                    resourceTypes={stepResources["texts"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGenerating}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <Texts
                text_ids={formState.text_ids}
                text_resources={s?.texts?.filter((t) => t.selected) ?? []}
                show_texts={true}
                text_suggestions={(s?.texts ?? [])
                  .filter((t) => t.suggested)
                  .map((t) => t.texts_id ?? t.id)
                  .filter(Boolean) as string[]}
                texts={s?.texts ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, text_ids: ids }))
                }
                label="Texts"
                registerFlush={registerFlushCallbacks["texts"]}
                isAutosaveEnabled={isAutosaveEnabled}
                onTextContentCreate={(content) =>
                  setFormState((prev) => ({
                    ...prev,
                    pending_text_contents: [...prev.pending_text_contents, content],
                  }))
                }
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      canRegenerateForStepCard,
      disabled,
      formState.active_flag_id,
      formState.department_ids,
      formState.description_id,
      formState.file_ids,
      formState.image_ids,
      formState.name_id,
      formState.parameter_field_ids,
      formState.text_ids,
      handleDirectStepGenerate,
      handleGenerateResources,
      isAutosaveEnabled,
      isEditMode,
      isGenerating,
      registerFlushCallbacks,
      stableDocumentDataFields,
      stepResources,
      uploadBasePath,
      uploadFileAction,
    ],
  );

  return (
    <TooltipProvider>
      <div
        className="w-full space-y-8 p-6"
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
      </div>
    </TooltipProvider>
  );
}

export default React.memo(DocumentComponent, (prevProps, nextProps) => {
  const prevDetail = prevProps.documentDetail ?? prevProps.documentDetailDefault;
  const nextDetail = nextProps.documentDetail ?? nextProps.documentDetailDefault;

  const prevIds = {
    name_id: prevDetail?.names?.find((n) => n.selected)?.id,
    description_id: prevDetail?.descriptions?.find((d) => d.selected)?.id,
    active_flag_id: prevDetail?.flags?.find((f) => f.selected)?.flag_option_id,
    department_ids: (prevDetail?.departments?.filter((d) => d.selected) ?? []).map(
      (d) => d.department_id,
    ),
    parameter_field_ids: (
      prevDetail?.parameter_fields?.filter((f) => f.selected) ?? []
    ).map((f) => f.field_id),
    file_ids: (prevDetail?.files?.filter((f) => f.selected) ?? []).map(
      (f) => f.files_id ?? f.id,
    ),
    image_ids: (prevDetail?.images?.filter((i) => i.selected) ?? []).map(
      (i) => i.image_id ?? i.id,
    ),
    text_ids: (prevDetail?.texts?.filter((t) => t.selected) ?? []).map(
      (t) => t.texts_id ?? t.id,
    ),
  };

  const nextIds = {
    name_id: nextDetail?.names?.find((n) => n.selected)?.id,
    description_id: nextDetail?.descriptions?.find((d) => d.selected)?.id,
    active_flag_id: nextDetail?.flags?.find((f) => f.selected)?.flag_option_id,
    department_ids: (nextDetail?.departments?.filter((d) => d.selected) ?? []).map(
      (d) => d.department_id,
    ),
    parameter_field_ids: (
      nextDetail?.parameter_fields?.filter((f) => f.selected) ?? []
    ).map((f) => f.field_id),
    file_ids: (nextDetail?.files?.filter((f) => f.selected) ?? []).map(
      (f) => f.files_id ?? f.id,
    ),
    image_ids: (nextDetail?.images?.filter((i) => i.selected) ?? []).map(
      (i) => i.image_id ?? i.id,
    ),
    text_ids: (nextDetail?.texts?.filter((t) => t.selected) ?? []).map(
      (t) => t.texts_id ?? t.id,
    ),
  };

  if (
    prevProps.documentId !== nextProps.documentId ||
    prevProps.mode !== nextProps.mode ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false;
  }

  if (
    prevProps.createDocumentAction !== nextProps.createDocumentAction ||
    prevProps.updateDocumentAction !== nextProps.updateDocumentAction ||
    prevProps.patchDocumentDraftAction !== nextProps.patchDocumentDraftAction ||
    prevProps.uploadBasePath !== nextProps.uploadBasePath ||
    prevProps.uploadFileAction !== nextProps.uploadFileAction
  ) {
    return false;
  }

  return true;
});
