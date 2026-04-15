/**
 * ProfilePersonas.tsx
 * Resource component for managing profile persona assignments within cohorts
 * Manages profile_persona_ids array - which persona each profile talks to
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftProfilePersonasIn = {
  body: {
    cohort_id: string;
    profile_id: string;
    persona_id: string;
    mcp: boolean;
    tool_id?: string;
  };
};
type CreateDraftProfilePersonasOut = {
  id?: string | null;
};

export interface ProfilePersonasResourceItem {
  id?: string | null;
  profile_id?: string | null;
  persona_id?: string | null;
  pending?: boolean | null;
}

export interface ProfilePersonaItem {
  cohort_id: string;
  profile_id: string;
  persona_id: string;
  persona_name?: string | undefined;
  persona_description?: string | undefined;
  persona_icon?: string | undefined;
  persona_color?: string | undefined;
  generated?: boolean | undefined;
}

export interface ProfilePersonasProps {
  profile_persona_ids?: string[];
  profile_persona_resources?: ProfilePersonasResourceItem[];
  show_profile_personas?: boolean;
  profile_personas?: ProfilePersonasResourceItem[];
  profiles?: Array<{
    id?: string | null;
    profile_id?: string | null;
    name?: string | null;
    description?: string | null;
  }>;
  profile_resources?: Array<{
    id?: string | null;
    profile_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  personas?: Array<{
    persona_id?: string | null;
    name?: string | null;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
  }>;
  disabled?: boolean;
  onChange: (personas: ProfilePersonaItem[]) => void;
  /** Callback to emit persona values for unified draft */
  onProfilePersonaValues?: (values: Array<{ profile_id: string; persona_id: string }>) => void;
  cohort_id?: string | null;
  profile_ids?: string[];
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  create_tool_id?: string | null;
  createProfilePersonasAction?:
    | ((
        input: CreateDraftProfilePersonasIn,
      ) => Promise<CreateDraftProfilePersonasOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean;
  isAutosaveEnabled?: boolean;
  registerFlush?: (
    flush: () => Promise<{ profile_persona_ids: string[] } | void>,
  ) => void;
  aiProfilePersonaResources?:
    | Pick<ProfilePersonasResourceItem, "id" | "profile_id" | "persona_id">[]
    | null;
}

export function ProfilePersonas({
  profile_persona_ids: _profile_persona_ids,
  profile_persona_resources,
  show_profile_personas = false,
  profile_personas,
  profiles,
  profile_resources,
  personas,
  disabled = false,
  onChange,
  onProfilePersonaValues,
  cohort_id,
  profile_ids = [],
  label = "Profile Personas",
  id = "profile_personas",
  required = false,
  description,
  group_id,
  create_tool_id,
  createProfilePersonasAction,
  onGenerate: _onGenerate,
  showAiGenerate: _showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiProfilePersonaResources: _aiProfilePersonaResources,
}: ProfilePersonasProps) {
  const show = show_profile_personas ?? false;
  const allPersonas = useMemo(
    () => profile_personas ?? [],
    [profile_personas],
  );
  const currentPersonas = useMemo(
    () => profile_persona_resources ?? [],
    [profile_persona_resources],
  );

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allPersonas.filter((p) => p.pending && p.profile_id);
  }, [allPersonas]);
  const showDiff = pendingItems.length > 0;
  const pendingProfileIds = useMemo(
    () => new Set(pendingItems.map((p) => p.profile_id).filter(Boolean) as string[]),
    [pendingItems],
  );

  const profileLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (profiles ?? []).forEach((profile) => {
      const pid = profile.profile_id || profile.id;
      if (pid) {
        const name = profile.name?.trim() || null;
        const desc = profile.description?.trim() || null;
        if (name || desc) {
          map.set(pid, name || desc || "Untitled profile");
        }
      }
    });
    (profile_resources ?? []).forEach((profile) => {
      const pid = profile.profile_id || profile.id;
      if (pid) {
        const name = profile.name?.trim() || null;
        const desc = profile.description?.trim() || null;
        map.set(pid, name || desc || "Untitled profile");
      }
    });
    return map;
  }, [profiles, profile_resources]);

  // Build available personas list from the personas prop
  const availablePersonas = useMemo(() => {
    return (personas ?? [])
      .filter((p) => p.persona_id)
      .map((p) => ({
        persona_id: p.persona_id!,
        persona_name: p.name || "Unnamed",
        persona_icon: p.icon || "",
        persona_color: p.color || "",
      }));
  }, [personas]);

  // Build persona lookup from allPersonas (profile_personas resources)
  const personasByProfile = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        persona_id: string;
        persona_name: string;
        persona_icon: string;
        persona_color: string;
      }>
    >();
    allPersonas.forEach((p) => {
      if (p.profile_id && p.persona_id) {
        const existing = map.get(p.profile_id) || [];
        if (!existing.some((e) => e.persona_id === p.persona_id)) {
          // Look up persona details from available personas
          const details = availablePersonas.find(
            (ap) => ap.persona_id === p.persona_id,
          );
          existing.push({
            persona_id: p.persona_id,
            persona_name: details?.persona_name || "Unnamed",
            persona_icon: details?.persona_icon || "",
            persona_color: details?.persona_color || "",
          });
        }
        map.set(p.profile_id, existing);
      }
    });
    return map;
  }, [allPersonas, availablePersonas]);

  // Track persona resource ID by profile
  const [personaIdsByProfile, setPersonaIdsByProfile] = useState<
    Map<string, string>
  >(new Map());
  const personaIdsByProfileRef = useRef<Map<string, string>>(new Map());
  personaIdsByProfileRef.current = personaIdsByProfile;

  // Track selected persona_id (artifact) by profile
  const [selectedPersonaByProfile, setSelectedPersonaByProfile] = useState<
    Map<string, string>
  >(new Map());

  // Ref for flush function
  const flushRef = useRef<
    (() => Promise<{ profile_persona_ids: string[] } | void>) | null
  >(null);

  // Initialize from server resources
  useEffect(() => {
    const nextIds = new Map<string, string>();
    const nextPersonas = new Map<string, string>();
    currentPersonas.forEach((p) => {
      const profileId = p.profile_id;
      const resourceId = p.id;
      const personaId = p.persona_id;
      if (profileId && resourceId) {
        nextIds.set(profileId, resourceId);
      }
      if (profileId && personaId) {
        nextPersonas.set(profileId, personaId);
      }
    });
    setPersonaIdsByProfile((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
    setSelectedPersonaByProfile((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextPersonas.entries()).sort());
      return prevKey === nextKey ? prev : nextPersonas;
    });
  }, [currentPersonas]);

  // Emit persona values for unified draft
  const onProfilePersonaValuesRef = useRef(onProfilePersonaValues);
  onProfilePersonaValuesRef.current = onProfilePersonaValues;
  useEffect(() => {
    if (!onProfilePersonaValuesRef.current) return;
    const values: Array<{ profile_id: string; persona_id: string }> = [];
    selectedPersonaByProfile.forEach((personaId, profileId) => {
      if (personaId) {
        values.push({ profile_id: profileId, persona_id: personaId });
      }
    });
    onProfilePersonaValuesRef.current(values);
  }, [selectedPersonaByProfile]);

  // Update flush function
  flushRef.current = async (): Promise<{
    profile_persona_ids: string[];
  } | void> => {
    const ids = profile_ids
      .map((profileId) => personaIdsByProfile.get(profileId))
      .filter((value): value is string => Boolean(value));
    return { profile_persona_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const handlePersonaChange = useCallback(
    (profileId: string, personaId: string) => {
      const updated = new Map(selectedPersonaByProfile);
      updated.set(profileId, personaId);
      setSelectedPersonaByProfile(updated);

      // Convert to array format for parent
      const personasArray = Array.from(updated.entries()).map(([pid, perid]) => {
        const details = availablePersonas.find(
          (p) => p.persona_id === perid,
        );
        return {
          cohort_id: cohort_id || "",
          profile_id: pid,
          persona_id: perid,
          persona_name: details?.persona_name || undefined,
          persona_description: undefined,
          persona_icon: details?.persona_icon || undefined,
          persona_color: details?.persona_color || undefined,
          generated: false,
        } satisfies ProfilePersonaItem;
      });

      onChange(personasArray);

      const shouldCreateResource =
        isAutosaveEnabled &&
        createProfilePersonasAction &&
        create_tool_id &&
        group_id &&
        cohort_id;
      if (!shouldCreateResource) {
        return;
      }

      void (async () => {
        try {
          const result = await createProfilePersonasAction({
            body: {
              cohort_id: cohort_id,
              profile_id: profileId,
              persona_id: personaId,
              mcp: false,
              tool_id: create_tool_id ?? undefined,
            },
          });

          if (!result?.id) {
            return;
          }

          setPersonaIdsByProfile((prev) => {
            const next = new Map(prev);
            next.set(profileId, result.id as string);
            return next;
          });
        } catch {
          // Resource creation errors are handled by API; keep UI state intact.
        }
      })();
    },
    [
      selectedPersonaByProfile,
      cohort_id,
      onChange,
      isAutosaveEnabled,
      createProfilePersonasAction,
      create_tool_id,
      group_id,
      availablePersonas,
    ],
  );

  // Accept pending — keep pending persona assignments in selection (no-op)
  const handleAccept = useCallback(() => {
    // Pending items are already reflected in the selections
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending persona assignments from selection
  const handleReject = useCallback(() => {
    const updated = new Map(selectedPersonaByProfile);
    pendingProfileIds.forEach((profileId) => {
      updated.delete(profileId);
    });
    setSelectedPersonaByProfile(updated);

    // Convert to array format for parent
    const personasArray = Array.from(updated.entries()).map(([pid, perid]) => {
      const details = availablePersonas.find(
        (p) => p.persona_id === perid,
      );
      return {
        cohort_id: cohort_id || "",
        profile_id: pid,
        persona_id: perid,
        persona_name: details?.persona_name || undefined,
        persona_description: undefined,
        persona_icon: details?.persona_icon || undefined,
        persona_color: details?.persona_color || undefined,
        generated: false,
      } satisfies ProfilePersonaItem;
    });

    onChange(personasArray);
  }, [selectedPersonaByProfile, pendingProfileIds, availablePersonas, cohort_id, onChange]);

  // Don't render if show_profile_personas is false or no profiles
  if (!show || profile_ids.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}
      <div className="pl-4 space-y-3">
        {profile_ids.map((profileId) => {
          const isPending = pendingProfileIds.has(profileId);
          const profileLabel =
            profileLabelMap.get(profileId) ?? "Untitled profile";
          // Use per-profile personas if available, otherwise use all available personas
          const profileAvailablePersonas =
            personasByProfile.get(profileId) || availablePersonas;
          const selectedPersonaId =
            selectedPersonaByProfile.get(profileId) || "";

          if (profileAvailablePersonas.length === 0) {
            return null;
          }

          return (
            <div
              key={profileId}
              className={cn(
                "flex items-center gap-3",
                isPending &&
                  "ring-2 ring-success bg-success/10 rounded-lg p-2",
              )}
            >
              <span
                className="text-sm font-medium min-w-[140px] truncate"
                title={profileLabel}
              >
                {profileLabel}
              </span>
              {isPending && (
                <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </span>
              )}
              <Select
                value={selectedPersonaId}
                onValueChange={(value) =>
                  handlePersonaChange(profileId, value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select persona..." />
                </SelectTrigger>
                <SelectContent>
                  {profileAvailablePersonas.map((persona) => (
                    <SelectItem
                      key={persona.persona_id}
                      value={persona.persona_id}
                    >
                      <div className="flex items-center gap-2">
                        {persona.persona_icon && (
                          <span>{persona.persona_icon}</span>
                        )}
                        <span>{persona.persona_name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
