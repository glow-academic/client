"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AuthItemCardGrid,
  type AuthItemCard,
} from "@/components/auth/AuthItemCardGrid";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import { Protocols } from "@/components/resources/Protocols";
import { Slugs } from "@/components/resources/Slugs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsString, type Parser } from "nuqs";

type SaveAuthIn = InputOf<"/api/v4/artifacts/auths/save", "post">;
type SaveAuthOut = OutputOf<"/api/v4/artifacts/auths/save", "post">;
type SaveAuthBody = NonNullable<SaveAuthIn["body"]>;
type PatchAuthDraftIn = InputOf<"/api/v4/artifacts/auths/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/api/v4/artifacts/auths/draft", "patch">;
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
type CreateDraftProtocolsIn = InputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftProtocolsOut = OutputOf<
  "/api/v4/resources/protocols",
  "post"
>;
type CreateDraftSlugsIn = InputOf<"/api/v4/resources/slugs", "post">;
type CreateDraftSlugsOut = OutputOf<"/api/v4/resources/slugs", "post">;
type AuthData = OutputOf<"/api/v4/artifacts/auths/get", "post">;

type AuthFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  protocol_ids: string[];
  slug_ids: string[];
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
  name_id?: string | null;
  description_id?: string | null;
};

type AuthResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "protocols"
  | "slugs"
  | "items";

const FLUSH_KEYS = ["names", "descriptions"] as const;

const VALID_RESOURCE_TYPES: AuthResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "protocols",
  "slugs",
  "items",
];

const AUTH_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "protocols",
    formKey: "protocol_ids",
    flushKey: null,
    type: "multi",
  },
  { key: "slugs", formKey: "slug_ids", flushKey: null, type: "multi" },
];

export interface AuthProps {
  authId?: string;
  authData?: AuthData;
  saveAuthAction?: (input: SaveAuthIn) => Promise<SaveAuthOut>;
  patchAuthDraftAction?: (input: PatchAuthDraftIn) => Promise<PatchAuthDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createProtocolsAction?: (
    input: CreateDraftProtocolsIn,
  ) => Promise<CreateDraftProtocolsOut>;
  createSlugsAction?: (
    input: CreateDraftSlugsIn,
  ) => Promise<CreateDraftSlugsOut>;
}

function AuthComponent({
  authId,
  authData,
  saveAuthAction,
  patchAuthDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createProtocolsAction,
  createSlugsAction,
}: AuthProps) {
  const router = useRouter();
  const isEditMode = !!authId;
  const s = authData;

  const [formState, setFormState] = useState<AuthFormState>({
    name_id: null,
    description_id: null,
    active_flag_id: null,
    protocol_ids: [],
    slug_ids: [],
    items: [],
  });

  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { isAutosaveEnabled } = useSaveContext();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    return {
      aiUpdates: {} as Record<string, unknown>,
      formStateUpdater: (prev: Record<string, unknown>) => {
        const updates: Record<string, unknown> = {};
        const nameRes = data["name_resource"] as { id?: string | null } | null;
        const descRes = data["description_resource"] as
          | { id?: string | null }
          | null;
        const flagRes = data["flag_resource"] as
          | { id?: string | null; flag_option_id?: string | null }
          | null;
        const protocolRes = data["protocol_resources"] as
          | Array<{ id?: string | null }>
          | null;
        const slugRes = data["slug_resources"] as Array<{ id?: string | null }> | null;
        const itemRes = data["item_resources"] as
          | Array<{
              id?: string | null;
              name?: string | null;
              description?: string | null;
              encrypted?: boolean | null;
              position?: number | null;
            }>
          | null;

        if (nameRes?.id) updates["name_id"] = nameRes.id;
        if (descRes?.id) updates["description_id"] = descRes.id;
        if (flagRes?.id || flagRes?.flag_option_id) {
          updates["active_flag_id"] = flagRes.id ?? flagRes.flag_option_id;
        }
        if (protocolRes?.length) {
          const nextIds = protocolRes
            .map((x) => x.id)
            .filter((x): x is string => !!x);
          const prevIds = (prev["protocol_ids"] as string[]) ?? [];
          updates["protocol_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }
        if (slugRes?.length) {
          const nextIds = slugRes.map((x) => x.id).filter((x): x is string => !!x);
          const prevIds = (prev["slug_ids"] as string[]) ?? [];
          updates["slug_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }
        if (itemRes?.length) {
          const prevItems =
            (prev["items"] as Array<{
              name: string;
              description: string;
              encrypted: boolean;
              position: number;
              active: boolean;
              key_id: string | null;
            }>) ?? [];
          const nextItems = itemRes
            .filter((x) => !!x.id || !!x.name)
            .map((x, index) => ({
              name: x.name ?? "",
              description: x.description ?? "",
              encrypted: x.encrypted ?? true,
              position: x.position ?? prevItems.length + index + 1,
              active: true,
              key_id: null,
            }));
          updates["items"] = [...prevItems, ...nextItems];
        }

        return { ...prev, ...updates };
      },
    };
  }, []);

  const { setGeneratingResources, isGenerating } = useAiGeneration<
    AuthResourceType,
    Record<string, unknown>
  >({
    socket,
    isConnected,
    artifactType: "auth",
    groupId: s?.group_id,
    eventPrefix: "auth_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormState as React.Dispatch<
      React.SetStateAction<Record<string, unknown>>
    >,
  });

  const getInitialFormState = useCallback((): AuthFormState => {
    if (!s) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        protocol_ids: [],
        slug_ids: [],
        items: [],
      };
    }

    return {
      name_id: s.names?.resource?.id ?? null,
      description_id: s.descriptions?.resource?.id ?? null,
      active_flag_id: s.flags?.current?.[0]?.flag_option_id ?? null,
      protocol_ids:
        s.protocols?.current?.map((x) => x.id).filter((x): x is string => !!x) ??
        [],
      slug_ids: s.slugs?.current?.map((x) => x.id).filter((x): x is string => !!x) ?? [],
      items:
        s.items?.current?.map((item, index) => ({
          name: item.name ?? "",
          description: item.description ?? "",
          encrypted: item.encrypted ?? true,
          position: item.position ?? index + 1,
          active: item.active ?? true,
          key_id: item.key_id ?? null,
        })) ?? [],
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

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);
  const draftVersion = s?.draft_version ?? null;

  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  useEffect(() => {
    if (!patchAuthDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) =>
      patchAuthDraftAction({ body: payload } as PatchAuthDraftIn);
  }, [patchAuthDraftAction]);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const hasResourceIds = checkHasResourceIds(
    AUTH_RESOURCES,
    formState as unknown as Record<string, unknown>,
  ) || formState.items.length > 0;

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => ({
      input_draft_id: inputDraftId || null,
      group_id: s?.group_id ?? null,
      ...buildResourceActions(AUTH_RESOURCES, {
        formState: formStateRef.current,
        referenceState: lastPatchedFormStateRef.current,
        flushResults: flushResults ?? {},
        entityData: s as Record<string, unknown> | null,
      }),
      items: {
        items:
          ((formStateRef.current["items"] as AuthFormState["items"]) ?? []).length > 0
            ? ((formStateRef.current["items"] as AuthFormState["items"]) ?? [])
            : null,
        create_tool_id: s?.items?.create_tool_id ?? null,
        link_tool_id: s?.items?.link_tool_id ?? null,
      },
      expected_version: expectedVersion,
    }),
    [s],
  );

  const { setUrlFormDataRef, onFormDataChange, flushAllAndSave, formDataRef } =
    useDraftLifecycle({
      formStateKey,
      patchActionRef,
      isAutosaveEnabled,
      buildPatchPayload,
      setSelectedDraftId,
      serverDraftVersion: draftVersion,
      hasResourceIds,
      flushRegistryRef,
      formStateRef,
      onPatchSuccess: () => {
        lastPatchedFormStateRef.current = { ...formStateRef.current };
      },
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: AuthResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      socket.emit("auth_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        auth_id: authId || null,
      });
    },
    [
      socket,
      isConnected,
      authId,
      setGeneratingResources,
      formDataRef,
      flushAllAndSave,
    ],
  );

  const canRegenerate = useCallback(
    (rt: AuthResourceType): boolean => {
      if (!s) return false;
      switch (rt) {
        case "names":
          return s.names?.resource?.generated ?? false;
        case "descriptions":
          return s.descriptions?.resource?.generated ?? false;
        case "flags":
          return s.flags?.current?.some((f) => f.generated) ?? false;
        case "protocols":
          return s.protocols?.current?.some((x) => x.generated) ?? false;
        case "slugs":
          return s.slugs?.current?.some((x) => x.generated) ?? false;
        case "items":
          return s.items?.current?.some((x) => x.generated) ?? false;
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
  const resourceLabels: Partial<Record<AuthResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      protocols: "Protocols",
      slugs: "Slugs",
      items: "Items",
    }),
    [],
  );
  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<AuthResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: (selected, instructions) =>
        handleGenerateResources(selected, instructions),
      isGenerating,
    });

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);

  useEffect(() => {
    const authName = s?.names?.resource?.name;
    if (authName && authId && isEditMode) {
      setEntityMetadata({
        entityId: authId,
        entityName: authName,
        entityType: "auth",
      });
    }
    return () => clearEntityMetadata();
  }, [
    s?.names?.resource?.name,
    authId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: Record<string, unknown> = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effectiveFormState = computeEffectiveFormState(
        AUTH_RESOURCES,
        formStateRef.current,
        flushResults,
      ) as unknown as AuthFormState;

      if (s?.names?.required && !effectiveFormState.name_id) {
        throw new Error("Auth name is required");
      }
      if (s?.descriptions?.required && !effectiveFormState.description_id) {
        throw new Error("Description is required");
      }
      if (s?.protocols?.required && effectiveFormState.protocol_ids.length === 0) {
        throw new Error("Protocols are required");
      }
      if (s?.slugs?.required && effectiveFormState.slug_ids.length === 0) {
        throw new Error("Slugs are required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }
      if (!s?.group_id) {
        throw new Error("Missing group_id");
      }
      if (!saveAuthAction) {
        throw new Error("Save action not available");
      }

      const initialState = getInitialFormState() as unknown as Record<
        string,
        unknown
      >;
      const saveActions = buildResourceActions(AUTH_RESOURCES, {
        formState: effectiveFormState as unknown as Record<string, unknown>,
        referenceState: initialState,
        flushResults,
        entityData: s as Record<string, unknown> | null,
      }) as Pick<
        SaveAuthBody,
        "names" | "descriptions" | "flags" | "protocols" | "slugs"
      >;

      await saveAuthAction({
        body: {
          input_auth_id: isEditMode ? authId ?? null : null,
          group_id: s.group_id,
          ...saveActions,
          items: {
            items:
              effectiveFormState.items.length > 0
                ? effectiveFormState.items
                : null,
            create_tool_id: s.items?.create_tool_id ?? null,
            link_tool_id: s.items?.link_tool_id ?? null,
          },
        },
      });

      toast.success(`Auth ${isEditMode ? "updated" : "created"} successfully!`);
      router.push("/system/auth");
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      s,
      profile?.id,
      saveAuthAction,
      getInitialFormState,
      isEditMode,
      authId,
      router,
    ],
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasProtocols = formState.protocol_ids.length > 0;
      const hasSlugs = formState.slug_ids.length > 0;
      const hasItems = formState.items.length > 0;

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
        resetFields: ["items"],
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
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={() => handleGenerateResources(["names"])}
                  isGenerating={isGenerating("names")}
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
                  create_tool_id={s?.names?.create_tool_id ?? null}
                  link_tool_id={s?.names?.link_tool_id ?? null}
                  createNamesAction={createNamesAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
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
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={s?.descriptions?.suggestions ?? []}
                  descriptions={s?.descriptions?.resources ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({ ...prev, description_id: descriptionId }))
                  }
                  onGenerate={() => handleGenerateResources(["descriptions"])}
                  isGenerating={isGenerating("descriptions")}
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  required={s?.descriptions?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                  create_tool_id={s?.descriptions?.create_tool_id ?? null}
                  link_tool_id={s?.descriptions?.link_tool_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                />

                <Flags
                  flag_id={formState.active_flag_id}
                  flag_resource={
                    s?.flags?.current?.[0]
                      ? {
                          id: s.flags.current[0].flag_option_id ?? null,
                          name: s.flags.current[0].label ?? null,
                          description: s.flags.current[0].description ?? null,
                          icon: s.flags.current[0].icon_id ?? null,
                          generated: s.flags.current[0].generated ?? null,
                        }
                      : null
                  }
                  flags={(s?.flags?.resources ?? []).map((f) => ({
                    id: f.flag_option_id ?? null,
                    name: f.label ?? null,
                    description: f.description ?? null,
                    icon: f.icon_id ?? null,
                    generated: f.generated ?? null,
                  }))}
                  show_flag={s?.flags?.show ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
                  }
                  onGenerate={() => handleGenerateResources(["flags"])}
                  isGenerating={isGenerating("flags")}
                  required={s?.flags?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}
                  link_tool_id={s?.flags?.link_tool_id ?? null}
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
                s?.protocols?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="protocols"
                    resourceTypes={stepResources["protocols"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <Protocols
                protocol_ids={formState.protocol_ids}
                protocol_resources={s?.protocols?.current ?? []}
                show_protocols={s?.protocols?.show ?? false}
                protocol_suggestions={s?.protocols?.suggestions ?? []}
                protocols={s?.protocols?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, protocol_ids: ids }))
                }
                onGenerate={() => handleGenerateResources(["protocols"])}
                isGenerating={isGenerating("protocols")}
                required={s?.protocols?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.protocols?.show_ai_generate ?? false}
                create_tool_id={s?.protocols?.create_tool_id ?? null}
                link_tool_id={s?.protocols?.link_tool_id ?? null}
                createProtocolsAction={createProtocolsAction}
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
                s?.slugs?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="slugs"
                    resourceTypes={stepResources["slugs"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
              <Slugs
                slug_ids={formState.slug_ids}
                slug_resources={s?.slugs?.current ?? []}
                show_slugs={s?.slugs?.show ?? false}
                slug_suggestions={s?.slugs?.suggestions ?? []}
                slugs={s?.slugs?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, slug_ids: ids }))
                }
                onGenerate={() => handleGenerateResources(["slugs"])}
                isGenerating={isGenerating("slugs")}
                required={s?.slugs?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.slugs?.show_ai_generate ?? false}
                create_tool_id={s?.slugs?.create_tool_id ?? null}
                link_tool_id={s?.slugs?.link_tool_id ?? null}
                createSlugsAction={createSlugsAction}
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
              resetFields={["items"]}
              actions={
                s?.items?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="items"
                    resourceTypes={stepResources["items"] ?? []}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
            >
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
      isGenerating,
      createNamesAction,
      createDescriptionsAction,
      createProtocolsAction,
      createSlugsAction,
      isAutosaveEnabled,
      registerFlushCallbacks,
      stepResources,
      canRegenerateForStepCard,
      isGeneratingForStepCard,
      handleOpenStepCardModal,
      authItemCards,
      handleItemsChange,
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
                }));
                break;
              case "protocols":
                setFormState((prev) => ({ ...prev, protocol_ids: [] }));
                break;
              case "slugs":
                setFormState((prev) => ({ ...prev, slug_ids: [] }));
                break;
              case "items":
                setFormState((prev) => ({ ...prev, items: [] }));
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
        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}

export default React.memo(AuthComponent);
