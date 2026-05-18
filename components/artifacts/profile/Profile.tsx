"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
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
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { cn } from "@/lib/utils";
import { Check, Mail, Plus, Trash2, X } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateProfileIn = InputOf<"/profile/create", "post">;
type CreateProfileOut = OutputOf<"/profile/create", "post">;
type UpdateProfileIn = InputOf<"/profile/update", "post">;
type UpdateProfileOut = OutputOf<"/profile/update", "post">;
type PatchProfileDraftIn = InputOf<"/profile/draft", "post">;
type PatchProfileDraftOut = OutputOf<"/profile/draft", "post">;

type ProfileData = OutputOf<"/profile/get", "post">;

type ProfileResourceType = "names" | "flags" | "departments" | "emails" | "roles";

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
  // Inline-create payload for a brand-new role. id=null asks the server to
  // create a roles_resource row with the supplied permissions/limits, then
  // thread the new role_id back. When set, takes precedence over role_id.
  role_draft: {
    id: string | null;
    name: string;
    description: string | null;
    icon_id: string | null;
    color_id: string | null;
    level: number;
    permission_ids: string[];
    request_limits: Array<{
      id: string | null;
      limit: number;
      interval: string;
    }>;
  } | null;
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
  "roles",
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

/**
 * Ghost-autocomplete email input. Mirrors the pattern in ReorderableList:
 * value sits in a real <Input>, an absolute-positioned `<span>` overlay
 * shows the matching suggestion suffix dimmed; pressing Tab accepts.
 */
function GhostEmailInput({
  value,
  onChange,
  onSubmit,
  suggestions,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  suggestions: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  const ghostMatch = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed || !suggestions.length) return null;
    const lower = trimmed.toLowerCase();
    return (
      suggestions.find((s) => {
        const sLower = s.toLowerCase();
        return sLower.startsWith(lower) && sLower !== lower;
      }) ?? null
    );
  }, [suggestions, value]);
  const ghostSuffix = ghostMatch ? ghostMatch.slice(value.length) : "";

  return (
    <div className="relative flex-1">
      <Input
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab" && ghostSuffix) {
            e.preventDefault();
            onChange(ghostMatch!);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="h-8"
        disabled={disabled}
      />
      {ghostSuffix && !disabled && (
        <span
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none flex items-center px-3 text-sm"
        >
          <span className="invisible">{value}</span>
          <span className="text-muted-foreground/50">{ghostSuffix}</span>
        </span>
      )}
    </div>
  );
}

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
  // Per-section ghost-autocomplete inputs for the contact step. Each
  // section (Primary, Other) has its own draft string + Add button.
  const [primaryEmailInput, setPrimaryEmailInput] = useState("");
  const [otherEmailInput, setOtherEmailInput] = useState("");

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
        role_draft: null,
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
      role_draft: null,
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
            // Keep whichever id the user already marked primary if it's
            // still in the server's email_ids; else fall back to the first
            // entry (preserves the legacy index-0-primary convention).
            primary_email_id: (() => {
              const serverIds = formStateFromServer.email_ids ?? null;
              if (!serverIds || serverIds.length === 0)
                return prev.primary_email_id;
              if (prev.primary_email_id && serverIds.includes(prev.primary_email_id))
                return prev.primary_email_id;
              return serverIds[0] ?? null;
            })(),
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
            prev.primary_email_id !== next.primary_email_id ||
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
        primary_email_id: formState.primary_email_id,
        role_id: formState.role_id,
        pending_ids: formState.pending_ids,
      }),
    [formState],
  );

  // Append-only: always send full current state as a complete snapshot.
  // Values take precedence over IDs for creatables (server resolves value→id,
  // echoes id back, local state clears the value on next merge).
  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as ProfileFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) {
      payload["name"] = current.name;
    } else if (current.name_id) {
      payload["name_id"] = current.name_id;
    }

    // role_draft (inline-create) takes precedence over role_id. Server
    // resolves the draft, encrypts/creates request_limits, creates the role,
    // and threads the new role_id back via the echoed DraftFormState.
    if (current.role_draft) {
      payload["role_draft"] = current.role_draft;
    } else if (current.role_id) {
      payload["role_id"] = current.role_id;
    }

    if (current.flag_ids.length > 0) {
      payload["flag_ids"] = current.flag_ids;
    }
    if (current.department_ids.length > 0) {
      payload["department_ids"] = current.department_ids;
    }

    // Email IDs: ordered so the primary lands at index 0 (legacy server
    // convention). new_emails ships alongside existing IDs — the server
    // creates resources for the strings and merges them into email_ids.
    const orderedIds = (() => {
      const ids = [...current.email_ids];
      const primary = current.primary_email_id;
      if (!primary || !ids.includes(primary)) return ids;
      return [primary, ...ids.filter((id) => id !== primary)];
    })();
    if (orderedIds.length > 0) {
      payload["email_ids"] = orderedIds;
    }
    if (current.new_emails.length > 0) {
      payload["emails"] = current.new_emails;
    }

    if (current.pending_ids.length > 0) {
      payload["pending_ids"] = current.pending_ids;
    }

    return payload;
  }, []);

  // Autosave gate: IDs OR any value/pending field present. Without the value
  // check, typing a name before the picker resolves an ID would never trigger
  // a save.
  const hasResourceIds =
    checkHasResourceIds(
      PROFILE_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    formState.new_emails.length > 0 ||
    formState.pending_ids.length > 0;

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors persona — see Persona.tsx for full rationale. ``formStateKey``
  // already includes ``pending_ids`` so changes here trigger autosave.
  type SingleField = "name_id";
  type MultiField = "flag_ids" | "department_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: pendingId,
        ...(field === "name_id" ? { name: null } : {}),
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleRejectPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((id) => !removeSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

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
        case "roles":
          return (
            (stableProfileData as any).roles?.some(
              (item: any) => item.generated,
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

  // Add Primary Email from the ghost input. If the typed value matches an
  // existing saved email, link by id (set primary_email_id + ensure in
  // email_ids). Otherwise push to new_emails — the server's index-0 = primary
  // convention promotes it on save when no other primary is set.
  const addPrimaryEmail = useCallback(() => {
    const trimmed = primaryEmailInput.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const existing = existingEmailItems.find(
      (item) => item.email.toLowerCase() === lower,
    );
    if (existing) {
      setFormState((prev) => ({
        ...prev,
        primary_email_id: existing.id,
        email_ids: prev.email_ids.includes(existing.id)
          ? prev.email_ids
          : [...prev.email_ids, existing.id],
      }));
    } else if (
      !formState.new_emails.some((e) => e.toLowerCase() === lower)
    ) {
      setFormState((prev) => ({
        ...prev,
        new_emails: [trimmed, ...prev.new_emails],
      }));
    }
    setPrimaryEmailInput("");
  }, [existingEmailItems, formState.new_emails, primaryEmailInput]);

  // Add Other Email from the ghost input. Existing match → ensure in
  // email_ids (don't disturb primary). New value → push to new_emails.
  const addOtherEmail = useCallback(() => {
    const trimmed = otherEmailInput.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const existing = existingEmailItems.find(
      (item) => item.email.toLowerCase() === lower,
    );
    if (existing) {
      setFormState((prev) =>
        prev.email_ids.includes(existing.id)
          ? prev
          : { ...prev, email_ids: [...prev.email_ids, existing.id] },
      );
    } else if (
      !formState.new_emails.some((e) => e.toLowerCase() === lower) &&
      !selectedEmailItems.some((it) => it.email.toLowerCase() === lower)
    ) {
      setFormState((prev) => ({
        ...prev,
        new_emails: [...prev.new_emails, trimmed],
      }));
    }
    setOtherEmailInput("");
  }, [
    existingEmailItems,
    formState.new_emails,
    otherEmailInput,
    selectedEmailItems,
  ]);

  const removeExistingEmail = useCallback((emailId: string) => {
    setFormState((prev) => {
      const nextEmailIds = prev.email_ids.filter((id) => id !== emailId);
      // If the removed email was the primary, pick the first remaining
      // email as the new primary (falls back to null if none).
      const nextPrimary =
        prev.primary_email_id === emailId
          ? nextEmailIds[0] ?? null
          : prev.primary_email_id;
      return {
        ...prev,
        email_ids: nextEmailIds,
        primary_email_id: nextPrimary,
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
      current.primary_email_id && current.email_ids.includes(current.primary_email_id)
        ? [
            current.primary_email_id,
            ...current.email_ids.filter((id) => id !== current.primary_email_id),
          ]
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
      roles: ["roles"],
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
            primary_email_id: null,
          };
        case "roles":
          return {
            ...prev,
            role_id: null,
            role_draft: null,
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
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  placeholder="e.g., Jane Doe"
                  defaultName="New Profile"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name_id", "flag_ids", "department_ids"]}
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
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("department_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("department_ids", pendingIds)
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
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("flag_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("flag_ids", pendingIds)
                  }
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
              resetFields={["email_ids", "new_emails"]}
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
              <div className="space-y-6">
                {/* Primary Email — input-only with ghost autocomplete from
                    existing emails. Add button (top-right) submits the typed
                    value: existing match → set primary_email_id; new value →
                    push to new_emails (becomes primary at index 0 on save). */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-4">
                    <Label className="flex items-center gap-1">
                      Primary Email
                    </Label>
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <GhostEmailInput
                        value={primaryEmailInput}
                        onChange={setPrimaryEmailInput}
                        onSubmit={addPrimaryEmail}
                        suggestions={existingEmailItems
                          .filter(
                            (it) => it.id !== formState.primary_email_id,
                          )
                          .map((it) => it.email)}
                        placeholder="Type primary email"
                        disabled={disabled}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={addPrimaryEmail}
                        disabled={disabled || !primaryEmailInput.trim()}
                      >
                        Add <Plus className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                  {formState.primary_email_id && (
                    <div
                      className={cn(
                        "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm",
                        "bg-accent ring-2 ring-primary",
                      )}
                    >
                      <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate text-sm font-medium">
                          {emailLookup.get(formState.primary_email_id) ??
                            formState.primary_email_id}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Primary email
                        </p>
                      </div>
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Other Emails — input-only with ghost autocomplete. Add
                    appends to email_ids (existing match) or new_emails. */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-4">
                    <Label className="flex items-center gap-1">
                      Other Emails
                    </Label>
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <GhostEmailInput
                        value={otherEmailInput}
                        onChange={setOtherEmailInput}
                        onSubmit={addOtherEmail}
                        suggestions={existingEmailItems
                          .filter(
                            (it) =>
                              !formState.email_ids.includes(it.id) &&
                              it.id !== formState.primary_email_id,
                          )
                          .map((it) => it.email)}
                        placeholder="Type additional email"
                        disabled={disabled}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={addOtherEmail}
                        disabled={disabled || !otherEmailInput.trim()}
                      >
                        Add <Plus className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                  {selectedEmailItems.filter(
                    (item) => item.id !== formState.primary_email_id,
                  ).length > 0 && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {selectedEmailItems
                        .filter(
                          (item) => item.id !== formState.primary_email_id,
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
                              item.pending && "bg-success/10 ring-2 ring-success",
                            )}
                          >
                            <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {item.email}
                                </span>
                                {item.pending && (
                                  <span className="rounded bg-success/20 px-1.5 py-0.5 text-xs font-medium text-success">
                                    Pending
                                  </span>
                                )}
                                {item.suggested && !item.pending && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    primary_email_id: item.id,
                                  }))
                                }
                                disabled={disabled}
                              >
                                Set Primary
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
                          </div>
                        ))}
                    </div>
                  )}
                </div>

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

                {/* Bottom inline-add row removed: each section now has its
                    own ghost-autocomplete input + Add button in the header. */}
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
              resetFields={["role_id", "roleSearch", "roleShowSelected"]}
              actions={
                stepResources["roles"]?.length &&
                profileData?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="roles"
                    resourceTypes={stepResources["roles"]}
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
              <Roles
                role={formState.role_id}
                roles={profileData?.roles ?? []}
                show_roles={true}
                disabled={disabled}
                editable={true}
                onRoleChange={(roleId) =>
                  setFormState((prev) => ({
                    ...prev,
                    role_id: roleId,
                    // Picking a different existing role discards any
                    // unsubmitted inline-create draft.
                    role_draft: roleId === "custom" ? prev.role_draft : null,
                  }))
                }
                {...(() => {
                  type PermissionRow = {
                    id?: string | null;
                    artifact?: string | null;
                    operation?: string | null;
                    name?: string | null;
                    description?: string | null;
                  };
                  type LimitRow = {
                    id?: string | null;
                    limit?: number | null;
                    interval?: string | null;
                  };
                  const pd = profileData as
                    | {
                        permissions?: PermissionRow[] | null;
                        request_limits?: LimitRow[] | null;
                      }
                    | null
                    | undefined;
                  const permissions = (pd?.permissions ?? [])
                    .filter((p) => p.id && p.artifact && p.operation)
                    .map((p) => ({
                      id: p.id as string,
                      artifact: p.artifact as string,
                      operation: p.operation as string,
                      name: p.name ?? null,
                      description: p.description ?? null,
                    }));
                  const request_limits_catalog = (pd?.request_limits ?? [])
                    .filter((rl) => rl.id)
                    .map((rl) => ({
                      id: rl.id as string,
                      limit: rl.limit ?? 0,
                      interval: rl.interval ?? "1 day",
                    }));
                  return {
                    ...(permissions.length > 0 ? { permissions } : {}),
                    ...(request_limits_catalog.length > 0
                      ? { request_limits_catalog }
                      : {}),
                  };
                })()}
                onCreateRoleDraft={(d) =>
                  setFormState((prev) => ({
                    ...prev,
                    // role_id stays "custom" sentinel locally; the server
                    // will rewrite it once role_draft resolves on save.
                    role_draft: {
                      id: null,
                      name: d.name,
                      description: d.description || null,
                      icon_id: null,
                      color_id: null,
                      level: d.level,
                      permission_ids: d.permission_ids,
                      request_limits: d.request_limits,
                    },
                  }))
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
      addPrimaryEmail,
      addOtherEmail,
      primaryEmailInput,
      otherEmailInput,
      canRegenerateForStepCard,
      disabled,
      existingEmailItems,
      formState.flag_ids,
      formState.department_ids,
      formState.email_ids,
      formState.name_id,
      formState.new_emails,
      formState.primary_email_id,
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
