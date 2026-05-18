/**
 * ProfilePersonas.tsx
 * Resource component for managing profile persona assignments within cohorts.
 *
 * Canonical pattern: render one labeled section per profile, each containing a
 * single-select Personas-style SelectableGrid (gradient tile + SvgIcon). This
 * matches the persona presentation used everywhere else in the app and avoids
 * a bespoke Select dropdown that printed raw SVG markup as text.
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SvgIcon } from "@/components/common/SvgIcon";
import { Brain, Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG
    .toString(16)
    .padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
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

interface PersonaCard {
  persona_id: string;
  persona_name: string;
  persona_description: string;
  persona_icon: string;
  persona_color: string;
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
  onProfilePersonaValues?: (
    values: Array<{ profile_id: string; persona_id: string }>,
  ) => void;
  cohort_id?: string | null;
  profile_ids?: string[];
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
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

  const pendingItems = useMemo(
    () => allPersonas.filter((p) => p.pending && p.profile_id),
    [allPersonas],
  );
  const showDiff = pendingItems.length > 0;
  const pendingProfileIds = useMemo(
    () =>
      new Set(
        pendingItems.map((p) => p.profile_id).filter(Boolean) as string[],
      ),
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

  // Cards available globally (from personas catalog).
  const availablePersonas: PersonaCard[] = useMemo(() => {
    return (personas ?? [])
      .filter((p) => p.persona_id)
      .map((p) => ({
        persona_id: p.persona_id!,
        persona_name: p.name || "Unnamed",
        persona_description: p.description || "",
        persona_icon: p.icon || "",
        persona_color: p.color || "#64748b",
      }));
  }, [personas]);

  // Per-profile persona pool — falls back to the global catalog when the
  // server hasn't narrowed it. Enrich entries with display details from the
  // catalog (name/icon/color/description).
  const personasByProfile = useMemo(() => {
    const map = new Map<string, PersonaCard[]>();
    allPersonas.forEach((p) => {
      if (!p.profile_id || !p.persona_id) return;
      const existing = map.get(p.profile_id) || [];
      if (existing.some((e) => e.persona_id === p.persona_id)) return;
      const details = availablePersonas.find(
        (ap) => ap.persona_id === p.persona_id,
      );
      existing.push({
        persona_id: p.persona_id,
        persona_name: details?.persona_name || "Unnamed",
        persona_description: details?.persona_description || "",
        persona_icon: details?.persona_icon || "",
        persona_color: details?.persona_color || "#64748b",
      });
      map.set(p.profile_id, existing);
    });
    return map;
  }, [allPersonas, availablePersonas]);

  // Selection state — one persona per profile.
  const [selectedPersonaByProfile, setSelectedPersonaByProfile] = useState<
    Map<string, string>
  >(new Map());
  const isDirtyRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Hydrate from server while user hasn't edited yet.
  useEffect(() => {
    if (isDirtyRef.current) return;
    const next = new Map<string, string>();
    currentPersonas.forEach((p) => {
      if (p.profile_id && p.persona_id) {
        next.set(p.profile_id, p.persona_id);
      }
    });
    setSelectedPersonaByProfile((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(next.entries()).sort());
      return prevKey === nextKey ? prev : next;
    });
  }, [currentPersonas]);

  // Emit value array only after user interaction — initial sync and pure
  // re-renders would otherwise spam the draft save.
  const onProfilePersonaValuesRef = useRef(onProfilePersonaValues);
  onProfilePersonaValuesRef.current = onProfilePersonaValues;
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!isDirtyRef.current) return;
    if (!onProfilePersonaValuesRef.current) return;
    const values: Array<{ profile_id: string; persona_id: string }> = [];
    selectedPersonaByProfile.forEach((personaId, profileId) => {
      if (personaId) {
        values.push({ profile_id: profileId, persona_id: personaId });
      }
    });
    onProfilePersonaValuesRef.current(values);
  }, [selectedPersonaByProfile]);

  const emitParentArray = useCallback(
    (map: Map<string, string>) => {
      const personasArray = Array.from(map.entries())
        .filter(([, perid]) => !!perid)
        .map(([pid, perid]) => {
          const details = availablePersonas.find(
            (p) => p.persona_id === perid,
          );
          return {
            cohort_id: cohort_id || "",
            profile_id: pid,
            persona_id: perid,
            persona_name: details?.persona_name || undefined,
            persona_description: details?.persona_description || undefined,
            persona_icon: details?.persona_icon || undefined,
            persona_color: details?.persona_color || undefined,
            generated: false,
          } satisfies ProfilePersonaItem;
        });
      onChange(personasArray);
    },
    [availablePersonas, cohort_id, onChange],
  );

  // Toggle: clicking the currently selected persona clears that profile's
  // assignment; clicking a different one switches.
  const handlePersonaSelect = useCallback(
    (profileId: string, personaId: string) => {
      isDirtyRef.current = true;
      setSelectedPersonaByProfile((prev) => {
        const updated = new Map(prev);
        if (updated.get(profileId) === personaId) {
          updated.delete(profileId);
        } else {
          updated.set(profileId, personaId);
        }
        emitParentArray(updated);
        return updated;
      });
    },
    [emitParentArray],
  );

  const handleAccept = useCallback(() => {
    // Pending items are already reflected — next save persists them.
  }, []);

  const handleReject = useCallback(() => {
    isDirtyRef.current = true;
    setSelectedPersonaByProfile((prev) => {
      const updated = new Map(prev);
      pendingProfileIds.forEach((profileId) => {
        updated.delete(profileId);
      });
      emitParentArray(updated);
      return updated;
    });
  }, [pendingProfileIds, emitParentArray]);

  if (!show || profile_ids.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
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

      <div className="space-y-6">
        {profile_ids.map((profileId) => {
          const isPending = pendingProfileIds.has(profileId);
          const profileLabel =
            profileLabelMap.get(profileId) ?? "Untitled profile";
          const cards =
            personasByProfile.get(profileId) ?? availablePersonas;
          const selectedPersonaId =
            selectedPersonaByProfile.get(profileId) || null;

          if (cards.length === 0) {
            return (
              <div key={profileId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{profileLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-1">
                  No personas available.
                </p>
              </div>
            );
          }

          return (
            <div key={profileId} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{profileLabel}</span>
                {isPending && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
              </div>

              <SelectableGrid<PersonaCard>
                items={cards}
                selectedId={selectedPersonaId}
                onSelect={(personaId) =>
                  handlePersonaSelect(profileId, personaId)
                }
                getId={(item) => item.persona_id}
                horizontal={true}
                disabled={disabled}
                renderItem={(item, isSelected) => {
                  const cardPending = isPending && isSelected;
                  return (
                    <div
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        cardPending && "ring-2 ring-success bg-success/10",
                        isSelected &&
                          !cardPending &&
                          "ring-2 ring-primary bg-accent",
                      )}
                    >
                      {isSelected && !cardPending && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      {cardPending && (
                        <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                          Pending
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg shadow-lg flex-shrink-0"
                          style={{
                            background: generateGradientFromHex(
                              item.persona_color,
                            ),
                          }}
                        >
                          <SvgIcon
                            svg={item.persona_icon}
                            className="h-5 w-5 text-white"
                            fallback={
                              <Brain className="h-5 w-5 text-white" />
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {item.persona_name}
                          </h3>
                          {item.persona_description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.persona_description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
                emptyMessage="No personas found."
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
