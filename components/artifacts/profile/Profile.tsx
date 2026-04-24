"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Roles } from "@/components/resources/Roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useProfileAi } from "@/hooks/use-profile-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { cn } from "@/lib/utils";
import { Check, Mail, Trash2, X } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateProfileIn = InputOf<"/profile/create", "post">;
type CreateProfileOut = OutputOf<"/profile/create", "post">;
type UpdateProfileIn = InputOf<"/profile/update", "post">;
type UpdateProfileOut = OutputOf<"/profile/update", "post">;
type PatchProfileDraftIn = InputOf<"/profile/draft", "patch">;
type PatchProfileDraftOut = OutputOf<"/profile/draft", "patch">;

type ProfileData = OutputOf<"/profile/get", "post">;

type ProfileResourceType = "names" | "flags" | "departments" | "emails";

type ProfileFormState = {
  name_id: string | null;
  name: string | null;
  flag_ids: string[];
  department_ids: string[];
  email_ids: string[];
  new_emails: string[];
  // Which email (by resource id) is the profile's primary. On save
  // orderedEmailIds puts this id first so the server's index-0 = primary
  // convention picks it up.
  primary_email_id: string | null;
  role_id: string | null;
  pending_ids: string[];
};

type EmailPickerItem = {
  id: string;
  email: string;
  suggested?: boolean | null;
  pending?: boolean | null;
};

const VALID_RESOURCE_TYPES: ProfileResourceType[] = [
  "names",
  "flags",
  "departments",
  "emails",
];

const PROFILE_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
    type: "multi",
  },
  { key: "emails", formKey: "email_ids", flushKey: "email_ids", type: "multi" },
  { key: "roles", formKey: "role_id", flushKey: null, type: "single" },
];

export interface ProfileProps {
  profileId?: string;
  mode?: "create" | "edit";
  profileData?: ProfileData;
  createProfileAction?: (input: CreateProfileIn) => Promise<CreateProfileOut>;
  updateProfileAction?: (input: UpdateProfileIn) => Promise<UpdateProfileOut>;
  patchProfileDraftAction?: (
    input: PatchProfileDraftIn,
  ) => Promise<PatchProfileDraftOut>;
}

function ProfileComponent({
  profileId,
  mode = profileId ? "edit" : "create",
  profileData,
  createProfileAction,
  updateProfileAction,
  patchProfileDraftAction,
}: ProfileProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!profileId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());
  const [newEmailInput, setNewEmailInput] = useState("");

  const profileDataRef = useRef(profileData);
  useEffect(() => {
    profileDataRef.current = profileData;
  }, [profileData]);

  const stableProfileData = useMemo(() => {
    if (!profileData) return null;
    return {
      names: profileData.names,
      flags: profileData.flags,
      departments: profileData.departments,
      emails: profileData.emails,
      roles: profileData.roles,
      basic_show_ai_generate: profileData.basic_show_ai_generate ?? false,
      contact_show_ai_generate: profileData.contact_show_ai_generate ?? false,
      show_ai_generate: profileData.show_ai_generate ?? false,
      group_id: profileData.group_id,
    };
  }, [
    profileData?.names,
    profileData?.flags,
    profileData?.departments,
    profileData?.emails,
    profileData?.roles,
    profileData?.basic_show_ai_generate,
    profileData?.contact_show_ai_generate,
    profileData?.show_ai_generate,
    profileData?.group_id,
  ]);

  const getInitialFormState = useCallback((): ProfileFormState => {
    const data = profileDataRef.current;
    if (!data) {
      return {
        name_id: null,
        name: null,
        flag_ids: [],
        department_ids: [],
        email_ids: [],
        new_emails: [],
        primary_email_id: null,
        role_id: null,
        pending_ids: [],
      };
    }

    const selectedEmails =
      (data.emails?.filter((item) => item.selected) ?? []).filter(
        (item): item is typeof item & { id: string } => !!item.id,
      );
    const primaryFromServer =
      selectedEmails.find((item) => item.is_primary)?.id ??
      selectedEmails[0]?.id ??
      null;

    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      flag_ids: (data.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      department_ids:
        (data.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      email_ids: selectedEmails.map((item) => item.id),
      new_emails: [],
      primary_email_id: primaryFromServer,
      role_id: data.roles?.find((item) => item.selected)?.id ?? null,
      pending_ids: data.pending_ids?.filter((id): id is string => !!id) ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<ProfileFormState>(getInitialFormState);

  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextState)
        ? prev
        : { ...nextState, new_emails: [] },
    );
  }, [getInitialFormState]);

  const formStateRef = useRef<Record<string, unknown>>(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  const lastPatchedFormStateRef = useRef<Record<string, unknown> | null>(null);
  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  const emailLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    (profileData?.emails ?? []).forEach((item) => {
      if (item.id && item.email) {
        lookup.set(item.id, item.email);
      }
    });
    return lookup;
  }, [profileData?.emails]);

  const orderedEmailIds = useMemo(() => {
    const ids = [...formState.email_ids];
    const primary = formState.primary_email_id;
    if (!primary || !ids.includes(primary)) return ids;
    return [primary, ...ids.filter((id) => id !== primary)];
  }, [formState.email_ids, formState.primary_email_id]);

  useEffect(() => {
    if (!patchProfileDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchProfileDraftAction({
        body: payload,
      } as PatchProfileDraftIn);

      const formStateFromServer = result?.form_state;
      if (formStateFromServer) {
        setFormState((prev) => {
          const next: ProfileFormState = {
            ...prev,
            name_id: formStateFromServer.name_id ?? prev.name_id,
            // Clear value fields only once the server has resolved them to IDs
            // — keeping the value would cause infinite re-saves (value takes
            // precedence → new resource → new id → repeat).
            name: formStateFromServer.name_id ? null : prev.name,
            flag_ids: (formStateFromServer as any).flag_ids ?? prev.flag_ids,
            department_ids:
              formStateFromServer.department_ids ?? prev.department_ids,
            email_ids: formStateFromServer.email_ids ?? prev.email_ids,
            // Only clear new_emails once the server returned email_ids for
            // them. Unconditionally clearing would wipe an in-flight add.
            new_emails: (formStateFromServer.email_ids?.length ?? 0) > 0
              ? []
              : prev.new_emails,
            primary_email_index: (formStateFromServer.email_ids?.length ?? 0) > 0
              ? 0
              : prev.primary_email_index,
            role_id: formStateFromServer.role_id ?? prev.role_id,
            pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes.
          // If the server returned identical values, setting the flag would
          // let it stick and silently swallow the next user action. (Same fix
          // as Persona / Scenario / Simulation / Cohort / Document.)
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            prev.role_id !== next.role_id ||
            prev.primary_email_index !== next.primary_email_index ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.email_ids) !== JSON.stringify(next.email_ids) ||
            JSON.stringify(prev.new_emails) !== JSON.stringify(next.new_emails) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      return result;
    };
  }, [patchProfileDraftAction]);

  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        name: formState.name,
        flag_ids: formState.flag_ids,
        department_ids: formState.department_ids,
        email_ids: formState.email_ids,
        new_emails: formState.new_emails,
        primary_email_index: formState.primary_email_index,
        role_id: formState.role_id,
        pending_ids: formState.pending_ids,
      }),
    [formState],
  );

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const currentFormState = formStateRef.current as unknown as ProfileFormState;
      const payload: Record<string, unknown> = {
        draft_id: inputDraftId || null,
        input_draft_id: inputDraftId || null,
        ...buildDraftPayload(PROFILE_RESOURCES, {
          formState: {
            ...currentFormState,
            email_ids: orderedEmailIds,
          } as unknown as Record<string, unknown>,
          referenceState: lastPatchedFormStateRef.current,
          flushResults: flushResults ?? {},
        }),
        pending_ids:
          currentFormState.pending_ids.length > 0
            ? currentFormState.pending_ids
            : null,
      };

      if (currentFormState.name != null) {
        payload["name"] = currentFormState.name;
        delete payload["name_id"];
      }
      if (currentFormState.new_emails.length > 0) {
        payload["emails"] = currentFormState.new_emails;
      }

      return payload;
    },
    [orderedEmailIds],
  );

  const hasResourceIds =
    checkHasResourceIds(
      PROFILE_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) || formState.new_emails.length > 0;

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

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
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = {
        ...(formStateRef.current as Record<string, unknown>),
      };
    },
  });

  const { isGenerating, generate } = useProfileAi({});

  const handleGenerateResources = useCallback(
    async (resourceTypes: ProfileResourceType[], userInstructions?: string) => {
      let draftId = (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftId) {
        draftId = await flushAllAndSave();
      }
      if (!draftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        draft_id: draftId,
        artifact_id: profileId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [flushAllAndSave, formDataRef, generate, profileId],
  );

  const canRegenerate = useCallback(
    (resourceType: ProfileResourceType) => {
      if (!stableProfileData) return false;
      switch (resourceType) {
        case "names":
          return (
            stableProfileData.names?.find((item) => item.selected)?.generated ?? false
          );
        case "flags":
          return (
            stableProfileData.flags?.find((item) => item.selected)?.generated ?? false
          );
        case "departments":
          return (
            stableProfileData.departments?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
        case "emails":
          return (
            stableProfileData.emails?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
      }
    },
    [stableProfileData],
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ProfileResourceType),
    [canRegenerate],
  );
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as ProfileResourceType),
    [isGenerating],
  );

  const profileSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      roleSearch: parseAsString,
      roleShowSelected: parseAsBoolean,
    }),
    [],
  );

  const disabled = useMemo(() => profileData?.can_edit === false, [profileData?.can_edit]);

  const existingEmailItems = useMemo<EmailPickerItem[]>(
    () =>
      (profileData?.emails ?? [])
        .filter((item) => item.id && item.email)
        .map((item) => ({
          id: item.id!,
          email: item.email!,
          suggested: item.suggested,
          pending: item.pending,
        })),
    [profileData?.emails],
  );

  const selectedEmailItems = useMemo(
    () =>
      orderedEmailIds
        .map((emailId) => ({
          id: emailId,
          email: emailLookup.get(emailId) ?? "",
          suggested: existingEmailItems.find((item) => item.id === emailId)?.suggested,
          pending: existingEmailItems.find((item) => item.id === emailId)?.pending,
        }))
        .filter((item) => item.email),
    [emailLookup, existingEmailItems, orderedEmailIds],
  );

  const addCustomEmail = useCallback(() => {
    const trimmed = newEmailInput.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const alreadySelected = selectedEmailItems.some(
      (item) => item.email.toLowerCase() == lower,
    );
    const alreadyPending = formState.new_emails.some((email) => email.toLowerCase() === lower);
    if (alreadySelected || alreadyPending) {
      setNewEmailInput("");
      return;
    }
    setFormState((prev) => ({
      ...prev,
      new_emails: [...prev.new_emails, trimmed],
    }));
    setNewEmailInput("");
  }, [formState.new_emails, newEmailInput, selectedEmailItems]);

  const removeExistingEmail = useCallback((emailId: string) => {
    setFormState((prev) => {
      const nextEmailIds = prev.email_ids.filter((id) => id !== emailId);
      const nextPrimaryIndex =
        prev.primary_email_index >= nextEmailIds.length
          ? Math.max(0, nextEmailIds.length - 1)
          : prev.primary_email_index;
      return {
        ...prev,
        email_ids: nextEmailIds,
        primary_email_index: nextPrimaryIndex,
      };
    });
  }, []);

  const removePendingEmail = useCallback((email: string) => {
    setFormState((prev) => ({
      ...prev,
      new_emails: prev.new_emails.filter((value) => value !== email),
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      throw new Error("Profile not loaded");
    }

    if (formState.new_emails.length > 0) {
      await flushAllAndSave();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }

    const current = formStateRef.current as unknown as ProfileFormState;
    if (current.new_emails.length > 0) {
      toast.error("Please save the draft to resolve new emails before submitting.");
      throw new Error("Draft resolution required");
    }
    if (!current.name_id && !current.name?.trim()) {
      toast.error("Profile name is required");
      throw new Error("Profile name is required");
    }

    const orderedEmails =
      current.email_ids.length > 1
        ? [
            current.email_ids[current.primary_email_index]!,
            ...current.email_ids.filter(
              (_, index) => index !== current.primary_email_index,
            ),
          ].filter(Boolean)
        : current.email_ids;

    if (isEditMode && profileId) {
      if (!updateProfileAction) {
        toast.error("Update action not available");
        throw new Error("Update action not available");
      }
      await updateProfileAction({
        body: {
          profiles: [
            {
              profile_id: profileId,
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.flag_ids.length > 0 ? { flag_ids: current.flag_ids } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(orderedEmails.length > 0 ? { email_ids: orderedEmails } : {}),
              ...(current.role_id ? { role_id: current.role_id } : {}),
            },
          ],
        },
      } as UpdateProfileIn);
    } else {
      if (!createProfileAction) {
        toast.error("Create action not available");
        throw new Error("Create action not available");
      }
      await createProfileAction({
        body: {
          profiles: [
            {
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.flag_ids.length > 0 ? { flag_ids: current.flag_ids } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(orderedEmails.length > 0 ? { email_ids: orderedEmails } : {}),
              ...(current.role_id ? { role_id: current.role_id } : {}),
            },
          ],
        },
      } as CreateProfileIn);
    }

    toast.success(`Profile ${isEditMode ? "updated" : "created"} successfully`);
    router.push("/management/profiles");
  }, [
    createProfileAction,
    flushAllAndSave,
    formState.new_emails.length,
    isEditMode,
    profile?.id,
    profileId,
    router,
    updateProfileAction,
  ]);

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "contact":
          if (!hasName) return "pending";
          return formState.email_ids.length > 0 || formState.new_emails.length > 0
            ? "completed"
            : "active";
        case "roles":
          if (!hasName) return "pending";
          return formState.role_id ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState.email_ids.length, formState.name, formState.name_id, formState.new_emails.length, formState.role_id],
  );

  const stepResources = useMemo<Record<string, ProfileResourceType[]>>(
    () => ({
      basic: ["names", "flags", "departments"],
      contact: ["emails"],
      all: VALID_RESOURCE_TYPES,
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the profile name, departments, and active status.",
        resetFields: ["name_id", "flag_ids", "department_ids"],
      },
      {
        id: "contact",
        title: "Contact Information",
        description: "Select existing emails or add new ones through the draft.",
        resetFields: ["email_ids", "new_emails"],
      },
      {
        id: "roles",
        title: "Roles",
        description: "Assign the role for this profile.",
        resetFields: ["role_id", "roleSearch", "roleShowSelected"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "flag_ids",
      "department_ids",
      "email_ids",
      "new_emails",
      "role_id",
      "pending_ids",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "contact":
        return "Contact information reset";
      case "roles":
        return "Roles reset";
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
            name: null,
            flag_ids: [],
            department_ids: [],
          };
        case "contact":
          return {
            ...prev,
            email_ids: [],
            new_emails: [],
            primary_email_index: 0,
          };
        case "roles":
          return {
            ...prev,
            role_id: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/profiles",
      backLabel: "Back",
      createLabel: "Create Profile",
      updateLabel: "Update Profile",
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
      formData,
      setFormData,
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
                  name_resource={profileData?.names?.find((item) => item.selected) ?? null}
                  show_name={true}
                  names={profileData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  placeholder="e.g., Jane Doe"
                  defaultName="New Profile"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              actions={
                stepResources["basic"]?.length &&
                profileData?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Departments
                  department_ids={formState.department_ids}
                  department_resources={
                    profileData?.departments?.filter((item) => item.selected) ?? []
                  }
                  show_departments={true}
                  departments={profileData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  required={false}
                />

                <Flags
                  flags={profileData?.flags ?? []}
                  values={(() => {
                    const map: Record<string, boolean | null> = {};
                    const byId = new Map(
                      (profileData?.flags ?? [])
                        .filter((f: any) => f.id)
                        .map((f: any) => [f.id as string, f])
                    );
                    for (const id of formState.flag_ids) {
                      const row = byId.get(id) as any;
                      if (!row) continue;
                      const type = row.type ?? row.name;
                      if (type && row.value != null) map[type] = row.value;
                    }
                    return map;
                  })()}
                  show_flags={true}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={(type, next) => {
                    setFormState((prev) => {
                      const rows = (profileData?.flags ?? []).filter(
                        (f: any) => (f.type ?? f.name) === type
                      );
                      const rowIds = new Set(
                        rows.map((r: any) => r.id).filter((id: any): id is string => !!id)
                      );
                      const retained = prev.flag_ids.filter((id) => !rowIds.has(id));
                      const target =
                        next == null
                          ? null
                          : rows.find((r: any) => r.value === next)?.id ?? null;
                      return {
                        ...prev,
                        flag_ids: target ? [...retained, target] : retained,
                      };
                    });
                  }}
                />
              </div>
            </StepCard>
          );

        case "contact":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              actions={
                stepResources["contact"]?.length &&
                profileData?.contact_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="contact"
                    resourceTypes={stepResources["contact"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label className="flex items-center gap-1">
                    Emails
                  </Label>
                  <GenericPicker<EmailPickerItem>
                    items={existingEmailItems}
                    selectedIds={formState.email_ids}
                    onSelect={(ids) =>
                      setFormState((prev) => ({
                        ...prev,
                        email_ids: ids,
                        primary_email_index: Math.min(
                          prev.primary_email_index,
                          Math.max(0, ids.length - 1),
                        ),
                      }))
                    }
                    multiSelect={true}
                    getId={(item) => item.id}
                    getLabel={(item) => item.email}
                    getSearchText={(item) => item.email}
                    placeholder="Select previous emails"
                    disabled={disabled}
                    compact={true}
                    buttonClassName="h-8"
                    showLabel={false}
                    hideSelectedChips={true}
                  />
                </div>

                {selectedEmailItems.length > 0 && (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {selectedEmailItems.map((item, index) => {
                      const isPrimary = index === formState.primary_email_index;

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
                            isPrimary && !item.pending && "bg-accent ring-2 ring-primary",
                            item.pending && "bg-success/10 ring-2 ring-success",
                          )}
                        >
                          <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">{item.email}</span>
                              {item.pending && (
                                <span className="rounded bg-success/20 px-1.5 py-0.5 text-xs font-medium text-success">
                                  Pending
                                </span>
                              )}
                              {item.suggested && !item.pending && !isPrimary && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {isPrimary ? "Primary email" : "Click below to set primary"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setFormState((prev) => ({
                                  ...prev,
                                  primary_email_index: index,
                                }))
                              }
                              disabled={disabled}
                            >
                              {isPrimary ? "Primary" : "Set Primary"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeExistingEmail(item.id)}
                              disabled={disabled}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {isPrimary && !item.pending && (
                            <Check className="absolute right-3 top-3 h-4 w-4" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {formState.new_emails.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">New Emails</Label>
                    <div className="flex flex-wrap gap-2">
                      {formState.new_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-2 rounded-full border bg-success/10 px-3 py-1 text-sm"
                        >
                          <span>{email}</span>
                          <span className="text-xs text-success">Pending save</span>
                          <button
                            type="button"
                            onClick={() => removePendingEmail(email)}
                            disabled={disabled}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!disabled && (
                  <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={newEmailInput}
                        onChange={(event) => setNewEmailInput(event.target.value)}
                        placeholder="Add email@example.com"
                        className="h-8"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomEmail();
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={addCustomEmail}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </StepCard>
          );

        case "roles": {
          const roleSearch =
            (formData["roleSearch"] as string | null | undefined) ?? "";
          const roleShowSelected =
            (formData["roleShowSelected"] as boolean | null | undefined) ?? false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={roleSearch}
              onSearchChange={(term) => setFormData({ roleSearch: term || null })}
              searchPlaceholder="Search roles..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: roleShowSelected,
                  onChange: (value: boolean) =>
                    setFormData({ roleShowSelected: value || null }),
                },
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Roles
                role={formState.role_id}
                roles={profileData?.roles ?? []}
                show_roles={true}
                disabled={disabled}
                editable={false}
                onRoleChange={(roleId) =>
                  setFormState((prev) => ({ ...prev, role_id: roleId }))
                }
                label="Role"
                required={false}
                searchTerm={roleSearch}
                showSelectedFilter={roleShowSelected}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      addCustomEmail,
      canRegenerateForStepCard,
      disabled,
      existingEmailItems,
      formState.flag_ids,
      formState.department_ids,
      formState.email_ids,
      formState.name_id,
      formState.new_emails,
      formState.primary_email_index,
      formState.role_id,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      isEditMode,
      isGeneratingForStepCard,
      newEmailInput,
      profileData?.basic_show_ai_generate,
      profileData?.contact_show_ai_generate,
      profileData?.departments,
      profileData?.emails,
      profileData?.flags,
      profileData?.names,
      profileData?.roles,
      removeExistingEmail,
      removePendingEmail,
      selectedEmailItems,
      stepResources,
    ],
  );

  const handleFormDataChange = useCallback(
    (fd: Record<string, unknown>) => {
      onFormDataChange(fd);
    },
    [onFormDataChange],
  );

  return (
    <TooltipProvider>
      <div className="w-full space-y-8 p-6" data-page={`profile-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={profileData?.disabled_reason ?? null}
          entityType="profile"
        />

        <GenericForm
          nuqsParsers={profileSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={profileData}
          formFieldKeys={formFieldKeys}
          onReset={handleReset}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={handleFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />
      </div>
    </TooltipProvider>
  );
}

export default ProfileComponent;
