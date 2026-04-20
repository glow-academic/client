"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AuthItemCardGrid,
  type AuthItemCard,
} from "@/components/artifacts/auth/AuthItemCardGrid";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Items } from "@/components/resources/Items";
import { Names } from "@/components/resources/Names";
import { Protocols } from "@/components/resources/Protocols";
import { Slugs } from "@/components/resources/Slugs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { parseAsString, type Parser } from "nuqs";

type CreateAuthIn = InputOf<"/auth/create", "post">;
type CreateAuthOut = OutputOf<"/auth/create", "post">;
type UpdateAuthIn = InputOf<"/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/auth/update", "post">;
type PatchAuthDraftIn = InputOf<"/auth/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/auth/draft", "patch">;
type AuthData = OutputOf<"/auth/get", "post">;

type CanonicalAuthData = AuthData;

type AuthFormState = {
  name: string | null;
  name_id: string | null;
  description: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  protocol_ids: string[];
  slug_ids: string[];
  item_ids: string[];
  pending_ids: string[];
  items: Array<{
    name: string;
    description: string;
    encrypted: boolean;
    position: number;
    active: boolean;
    key_id: string | null;
  }>;
};

type FlushResult = {
  draft_id?: string | null;
};

type AuthResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "protocols"
  | "slugs"
  | "items";

const FLUSH_KEYS = [] as const;

const VALID_RESOURCE_TYPES: AuthResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "protocols",
  "slugs",
  "items",
];

export interface AuthProps {
  authId?: string;
  authData?: AuthData;
  createAuthAction?: (input: CreateAuthIn) => Promise<CreateAuthOut>;
  updateAuthAction?: (input: UpdateAuthIn) => Promise<UpdateAuthOut>;
  patchAuthDraftAction?: (input: PatchAuthDraftIn) => Promise<PatchAuthDraftOut>;
}

function AuthComponent({
  authId,
  authData,
  createAuthAction,
  updateAuthAction,
  patchAuthDraftAction,
}: AuthProps) {
  const router = useRouter();
  const isEditMode = !!authId;
  const s = authData as CanonicalAuthData | undefined;

  const [formState, setFormState] = useState<AuthFormState>({
    name: null,
    name_id: null,
    description: null,
    description_id: null,
    active_flag_id: null,
    department_ids: [],
    protocol_ids: [],
    slug_ids: [],
    item_ids: [],
    pending_ids: [],
    items: [],
  });

  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, flushAllResources } = useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "auth",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const getInitialFormState = useCallback((): AuthFormState => {
    if (!s) {
      return {
        name: null,
        name_id: null,
        description: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        protocol_ids: [],
        slug_ids: [],
        item_ids: [],
        pending_ids: [],
        items: [],
      };
    }

    const selectedName = s.names?.find((item) => item.selected) ?? null;
    const selectedDescription = s.descriptions?.find((item) => item.selected) ?? null;
    const selectedFlag = s.flags?.find((item) => item.selected) ?? null;
    const selectedProtocols = (s.protocols?.filter((item) => item.selected) ?? [])
      .map((item) => item.id)
      .filter((item): item is string => !!item);
    const selectedSlugs = (s.slugs?.filter((item) => item.selected) ?? [])
      .map((item) => item.id)
      .filter((item): item is string => !!item);
    const selectedItems = (s.items?.filter((item) => item.selected) ?? [])
      .map((item) => item.id)
      .filter((item): item is string => !!item);
    const selectedDepartments = (s.departments?.filter((item) => item.selected) ?? [])
      .map((item) => item.department_id)
      .filter((item): item is string => !!item);
    const selectedItemResources = s.items?.filter((item) => item.selected) ?? [];

    return {
      name: selectedName?.name ?? null,
      name_id: selectedName?.id ?? null,
      description: selectedDescription?.description ?? null,
      description_id: selectedDescription?.id ?? null,
      active_flag_id: selectedFlag?.flag_option_id ?? null,
      department_ids: selectedDepartments,
      protocol_ids: selectedProtocols,
      slug_ids: selectedSlugs,
      item_ids: selectedItems,
      pending_ids: (s.pending_ids ?? []).filter((item): item is string => !!item),
      items:
        selectedItemResources.map((item, index) => ({
          name: item.name ?? "",
          description: item.description ?? "",
          encrypted: item.encrypted ?? true,
          position: item.position ?? index + 1,
          active: true,
          key_id: null,
        })),
    };
  }, [s]);

  const formStateRef = React.useRef(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  useEffect(() => {
    const next = getInitialFormState();
    setFormState((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(next)) return next;
      return prev;
    });
  }, [getInitialFormState]);

  const serverSyncPendingRef = React.useRef(false);
  const formStateKey = useMemo(() => {
    if (serverSyncPendingRef.current) return "";
    return JSON.stringify(formState);
  }, [formState]);
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>) | undefined
  >(undefined);
  useEffect(() => {
    if (!patchAuthDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchAuthDraftAction({ body: payload } as PatchAuthDraftIn);
      const formStateFromServer = (result as PatchAuthDraftOut & {
        form_state?: {
          name?: string | null;
          name_id?: string | null;
          description?: string | null;
          description_id?: string | null;
          flag_id?: string | null;
          department_ids?: string[] | null;
          protocol_ids?: string[] | null;
          slug_ids?: string[] | null;
          item_ids?: string[] | null;
          pending_ids?: string[] | null;
        } | null;
      }).form_state;
      if (formStateFromServer) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => ({
          ...prev,
          name: formStateFromServer.name ?? prev.name,
          name_id: formStateFromServer.name_id ?? prev.name_id,
          description: formStateFromServer.description ?? prev.description,
          description_id: formStateFromServer.description_id ?? prev.description_id,
          active_flag_id: formStateFromServer.flag_id ?? prev.active_flag_id,
          department_ids: formStateFromServer.department_ids ?? prev.department_ids,
          protocol_ids: formStateFromServer.protocol_ids ?? prev.protocol_ids,
          slug_ids: formStateFromServer.slug_ids ?? prev.slug_ids,
          item_ids: formStateFromServer.item_ids ?? prev.item_ids,
          pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
        }));
        requestAnimationFrame(() => {
          serverSyncPendingRef.current = false;
        });
      }
      return result;
    };
  }, [patchAuthDraftAction]);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const hasResourceIds =
    !!formState.name_id ||
    !!formState.description_id ||
    !!formState.active_flag_id ||
    formState.department_ids.length > 0 ||
    formState.protocol_ids.length > 0 ||
    formState.slug_ids.length > 0 ||
    formState.item_ids.length > 0 ||
    formState.items.length > 0;

  const buildPatchPayload = useCallback(
    (inputDraftId: string | null): Record<string, unknown> => {
      const fs = formStateRef.current as unknown as AuthFormState;
      const payload: Record<string, unknown> = {
        draft_id: inputDraftId || null,
        flag_id: fs.active_flag_id ?? null,
        department_ids: fs.department_ids.length > 0 ? fs.department_ids : [],
        protocol_ids: fs.protocol_ids.length > 0 ? fs.protocol_ids : [],
        slug_ids: fs.slug_ids.length > 0 ? fs.slug_ids : [],
        item_ids: fs.item_ids.length > 0 ? fs.item_ids : [],
        pending_ids: fs.pending_ids,
      };

      if (fs.name && fs.name.trim().length > 0) {
        payload["name"] = fs.name;
      } else {
        payload["name_id"] = fs.name_id ?? null;
      }
      if (fs.description && fs.description.trim().length > 0) {
        payload["description"] = fs.description;
      } else {
        payload["description_id"] = fs.description_id ?? null;
      }

      return payload;
    },
    [],
  );

  const { setUrlFormDataRef, onFormDataChange, flushAllAndSave, formDataRef } =
    useDraftLifecycle({
      formStateKey,
      patchActionRef,
      isAutosaveEnabled,
      buildPatchPayload,
      setSelectedDraftId,
      hasResourceIds,
      flushRegistryRef,
      formStateRef,
      onPatchSuccess: () => {
        lastPatchedFormStateRef.current = { ...formStateRef.current };
      },
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: AuthResourceType[], userInstructions?: string) => {
      let currentDraftId: string | null =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = (await flushAllAndSave()) ?? null;
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: authId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [
      authId,
      generate,
      formDataRef,
      flushAllAndSave,
    ],
  );

  const canRegenerate = useCallback(
    (rt: AuthResourceType): boolean => {
      if (!s) return false;
      switch (rt) {
        case "names":
          return s.names?.find((item) => item.selected)?.generated ?? false;
        case "descriptions":
          return s.descriptions?.find((item) => item.selected)?.generated ?? false;
        case "flags":
          return s.flags?.some((item) => item.selected && item.generated) ?? false;
        case "protocols":
          return s.protocols?.some((item) => item.selected && item.generated) ?? false;
        case "slugs":
          return s.slugs?.some((item) => item.selected && item.generated) ?? false;
        case "items":
          return s.items?.some((item) => item.selected && item.generated) ?? false;
        default:
          return false;
      }
    },
    [s],
  );
  const canRegenerateForStepCard = useCallback(
    (rt: string) => canRegenerate(rt as AuthResourceType),
    [canRegenerate],
  );
  const isGeneratingForStepCard = useCallback(
    (rt: string) => isGenerating(rt as AuthResourceType),
    [isGenerating],
  );

  const stepResources: Record<string, AuthResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags"],
      protocols: ["protocols"],
      slugs: ["slugs"],
      items: ["items"],
      all: ["names", "descriptions", "flags", "protocols", "slugs", "items"],
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
    [stepResources, handleGenerateResources],
  );

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);
  const showProtocols = (s?.protocols?.length ?? 0) > 0;
  const showSlugs = (s?.slugs?.length ?? 0) > 0;
  const showItems = (s?.items?.length ?? 0) > 0;
  const nameRequired = true;
  const descriptionRequired = false;
  const protocolsRequired = showProtocols;
  const slugsRequired = showSlugs;
  const sectionResourceIds = useMemo(
    () => ({
      names: new Set((s?.names ?? []).map((item) => item.id).filter((item): item is string => !!item)),
      descriptions: new Set((s?.descriptions ?? []).map((item) => item.id).filter((item): item is string => !!item)),
      flags: new Set((s?.flags ?? []).map((item) => item.flag_option_id).filter((item): item is string => !!item)),
      protocols: new Set((s?.protocols ?? []).map((item) => item.id).filter((item): item is string => !!item)),
      slugs: new Set((s?.slugs ?? []).map((item) => item.id).filter((item): item is string => !!item)),
      items: new Set((s?.items ?? []).map((item) => item.id).filter((item): item is string => !!item)),
    }),
    [s],
  );

  const retainPendingIds = useCallback(
    (prevPendingIds: string[], section: keyof typeof sectionResourceIds, nextSelectedIds: string[]) =>
      prevPendingIds.filter(
        (id) => !sectionResourceIds[section].has(id) || nextSelectedIds.includes(id),
      ),
    [sectionResourceIds],
  );

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!isAutosaveEnabled) {
        await flushAllResources();
      }

      const effectiveFormState = formStateRef.current as unknown as AuthFormState;

      if (nameRequired && !effectiveFormState.name_id) {
        throw new Error("Auth name is required");
      }
      if (descriptionRequired && !effectiveFormState.description_id) {
        throw new Error("Description is required");
      }
      if (protocolsRequired && effectiveFormState.protocol_ids.length === 0) {
        throw new Error("Protocols are required");
      }
      if (slugsRequired && effectiveFormState.slug_ids.length === 0) {
        throw new Error("Slugs are required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }

      if (isEditMode && authId && updateAuthAction) {
        await updateAuthAction({
          body: {
            auths: [
              {
                auth_id: authId,
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                protocol_ids: effectiveFormState.protocol_ids?.length
                  ? effectiveFormState.protocol_ids
                  : null,
                slug_ids: effectiveFormState.slug_ids?.length
                  ? effectiveFormState.slug_ids
                  : null,
                item_ids:
                  effectiveFormState.item_ids?.length
                    ? effectiveFormState.item_ids
                    : effectiveFormState.items.length > 0
                      ? effectiveFormState.items.map((item) => item.key_id).filter((id): id is string => !!id)
                      : null,
              },
            ],
            group_id: s?.group_id ?? null,
          },
        } as UpdateAuthIn);
      } else if (createAuthAction) {
        await createAuthAction({
          body: {
            auths: [
              {
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                protocol_ids: effectiveFormState.protocol_ids?.length
                  ? effectiveFormState.protocol_ids
                  : null,
                slug_ids: effectiveFormState.slug_ids?.length
                  ? effectiveFormState.slug_ids
                  : null,
                items:
                  effectiveFormState.items.length > 0
                    ? effectiveFormState.items
                    : null,
              },
            ],
            group_id: s?.group_id ?? null,
          },
        } as CreateAuthIn);
      } else {
        throw new Error("Save action not available");
      }

      toast.success(`Auth ${isEditMode ? "updated" : "created"} successfully!`);
      router.push("/system/auth");
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      profile?.id,
      createAuthAction,
      updateAuthAction,
      isEditMode,
      authId,
      router,
      nameRequired,
      descriptionRequired,
      protocolsRequired,
      slugsRequired,
    ],
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasProtocols = formState.protocol_ids.length > 0;
      const hasSlugs = formState.slug_ids.length > 0;
      const hasItems = formState.items.length > 0 || formState.item_ids.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "protocols":
          if (!hasName || !hasDescription) return "pending";
          return hasProtocols ? "completed" : "active";
        case "slugs":
          if (!hasName || !hasDescription) return "pending";
          return hasSlugs ? "completed" : "active";
        case "items":
          if (!hasName || !hasDescription) return "pending";
          return hasItems ? "completed" : "active";
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
        description: "Set the auth name, description, and status.",
        resetFields: ["name_id", "description_id", "active_flag_id"],
      },
      {
        id: "protocols",
        title: "Protocols",
        description: "Select supported protocols.",
        resetFields: ["protocol_ids"],
      },
      {
        id: "slugs",
        title: "Slugs",
        description: "Select auth slugs.",
        resetFields: ["slug_ids"],
      },
      {
        id: "items",
        title: "Auth Items",
        description: "Define auth item fields.",
        resetFields: ["item_ids", "items"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "protocol_ids",
      "slug_ids",
      "item_ids",
      "items",
    ],
    [],
  );

  const authItemCards = useMemo(
    () =>
      formState.items.map((item, index) => ({
        id: `item-${index}`,
        name: item.name,
        description: item.description,
        encrypted: item.encrypted,
        active: item.active,
        position: item.position || index + 1,
        isNew: false,
      })),
    [formState.items],
  );

  const handleItemsChange = useCallback((items: AuthItemCard[]) => {
    setFormState((prev) => ({
      ...prev,
      items: items.map((item) => ({
        name: item.name,
        description: item.description || "",
        encrypted: item.encrypted,
        position: item.position,
        active: item.active,
        key_id: null,
      })),
    }));
  }, []);

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
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic":
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
                  name_resource={s?.names?.find((item) => item.selected) ?? null}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({
                      ...prev,
                      name_id: nameId,
                      name: null,
                      pending_ids: retainPendingIds(prev.pending_ids, "names", nameId ? [nameId] : []),
                    }))
                  }
                  onNameChange={(name) =>
                    setFormState((prev) => ({ ...prev, name }))
                  }
                  required={nameRequired}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name_id", "description_id", "active_flag_id"]}
              actions={
                s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={s?.descriptions?.find((item) => item.selected) ?? null}
                  show_description={true}
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                      description: null,
                      pending_ids: retainPendingIds(
                        prev.pending_ids,
                        "descriptions",
                        descriptionId ? [descriptionId] : [],
                      ),
                    }))
                  }
                  onDescriptionChange={(description) =>
                    setFormState((prev) => ({ ...prev, description }))
                  }
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  required={descriptionRequired}
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Flags
                  flags={s?.flags ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={true}
                  columns={1}
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                      pending_ids: retainPendingIds(prev.pending_ids, "flags", flagId ? [flagId] : []),
                    }))
                  }
                />
              </div>
            </StepCard>
          );

        case "protocols":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["protocol_ids"]}
              actions={
                s?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="protocols"
                    resourceTypes={stepResources["protocols"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <Protocols
                protocol_ids={formState.protocol_ids}
                protocol_resources={s?.protocols?.filter((item) => item.selected) ?? []}
                show_protocols={showProtocols}
                protocols={s?.protocols ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    protocol_ids: ids,
                    pending_ids: retainPendingIds(prev.pending_ids, "protocols", ids),
                  }))
                }
                required={protocolsRequired}
              />
            </StepCard>
          );

        case "slugs":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["slug_ids"]}
              actions={
                s?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="slugs"
                    resourceTypes={stepResources["slugs"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <Slugs
                slug_ids={formState.slug_ids}
                slug_resources={s?.slugs?.filter((item) => item.selected) ?? []}
                show_slugs={showSlugs}
                slugs={s?.slugs ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    slug_ids: ids,
                    pending_ids: retainPendingIds(prev.pending_ids, "slugs", ids),
                  }))
                }
                required={slugsRequired}
              />
            </StepCard>
          );

        case "items":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["item_ids", "items"]}
              actions={
                s?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="items"
                    resourceTypes={stepResources["items"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <Items
                item_ids={formState.item_ids}
                item_resources={(s?.items?.filter((item) => item.selected) ?? []).map((x) => ({
                  id: x.id ?? null,
                  name: x.name ?? null,
                  description: x.description ?? null,
                  encrypted: x.encrypted ?? null,
                  position: x.position ?? null,
                  generated: x.generated ?? null,
                }))}
                show_items={showItems}
                items={(s?.items ?? []).map((x) => ({
                  id: x.id ?? null,
                  name: x.name ?? null,
                  description: x.description ?? null,
                  encrypted: x.encrypted ?? null,
                  position: x.position ?? null,
                  generated: x.generated ?? null,
                  suggested: x.suggested ?? null,
                  pending: x.pending ?? null,
                }))}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    item_ids: ids,
                    pending_ids: retainPendingIds(prev.pending_ids, "items", ids),
                  }))
                }
              />
              <AuthItemCardGrid
                items={authItemCards}
                onItemsChange={handleItemsChange}
                readonly={disabled}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      disabled,
      isEditMode,
      formState,
      s,
      handleGenerateResources,
      isAutosaveEnabled,
      stepResources,
      canRegenerateForStepCard,
      isGeneratingForStepCard,
      handleDirectStepGenerate,
      authItemCards,
      handleItemsChange,
      retainPendingIds,
      nameRequired,
      descriptionRequired,
      protocolsRequired,
      slugsRequired,
      showProtocols,
      showSlugs,
      showItems,
    ],
  );

  const authSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
    }),
    [],
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`auth-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="auth"
        />
        <GenericForm
          nuqsParsers={authSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={(stepId) => {
            switch (stepId) {
              case "basic":
                return "Basic information reset";
              case "protocols":
                return "Protocols reset";
              case "slugs":
                return "Slugs reset";
              case "items":
                return "Auth items reset";
              default:
                return "Reset";
            }
          }}
          onReset={(stepId) => {
            switch (stepId) {
              case "basic":
                setFormState((prev) => ({
                  ...prev,
                  name_id: null,
                  description_id: null,
                  active_flag_id: null,
                  pending_ids: retainPendingIds(
                    retainPendingIds(
                      retainPendingIds(prev.pending_ids, "names", []),
                      "descriptions",
                      [],
                    ),
                    "flags",
                    [],
                  ),
                }));
                break;
              case "protocols":
                setFormState((prev) => ({
                  ...prev,
                  protocol_ids: [],
                  pending_ids: retainPendingIds(prev.pending_ids, "protocols", []),
                }));
                break;
              case "slugs":
                setFormState((prev) => ({
                  ...prev,
                  slug_ids: [],
                  pending_ids: retainPendingIds(prev.pending_ids, "slugs", []),
                }));
                break;
              case "items":
                setFormState((prev) => ({
                  ...prev,
                  item_ids: [],
                  items: [],
                  pending_ids: retainPendingIds(prev.pending_ids, "items", []),
                }));
                break;
              default:
                break;
            }
          }}
          onSubmit={handleSubmit}
          submitButton={{
            backUrl: "/system/auth",
            backLabel: "Back",
            createLabel: "Create Auth",
            updateLabel: "Update Auth",
          }}
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

export default React.memo(AuthComponent);
