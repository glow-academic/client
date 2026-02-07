/**
 * ScenarioPersonas.tsx
 * Resource component for managing scenario persona assignments within simulations
 * Manages scenario_persona_ids array - which persona each scenario talks to
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
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftScenarioPersonasIn = InputOf<
  "/api/v4/resources/scenario_personas",
  "post"
>;
type CreateDraftScenarioPersonasOut = OutputOf<
  "/api/v4/resources/scenario_personas",
  "post"
>;

export interface ScenarioPersonaItem {
  simulation_id: string;
  scenario_id: string;
  persona_id: string;
  persona_name?: string | undefined;
  persona_description?: string | undefined;
  persona_icon?: string | undefined;
  persona_color?: string | undefined;
  generated?: boolean | undefined;
}

export interface ScenarioPersonasProps {
  scenario_persona_ids?: string[];
  scenario_persona_resources?: Array<{
    id?: string | null;
    simulation_id?: string | null;
    scenario_id?: string | null;
    persona_id?: string | null;
    persona_name?: string | null;
    persona_description?: string | null;
    persona_icon?: string | null;
    persona_color?: string | null;
    generated?: boolean | null;
  }>;
  show_scenario_personas?: boolean;
  scenario_persona_suggestions?: string[];
  scenario_personas?: Array<{
    id?: string | null;
    simulation_id?: string | null;
    scenario_id?: string | null;
    persona_id?: string | null;
    persona_name?: string | null;
    persona_description?: string | null;
    persona_icon?: string | null;
    persona_color?: string | null;
    generated?: boolean | null;
  }>;
  scenarios?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null;
    description?: string | null;
  }>;
  scenario_resources?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    name?: string | null;
    title?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (personas: ScenarioPersonaItem[]) => void;
  simulation_id?: string | null;
  scenario_ids?: string[];
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createScenarioPersonasAction?:
    | ((
        input: CreateDraftScenarioPersonasIn
      ) => Promise<CreateDraftScenarioPersonasOut>)
    | undefined;
  onPersonaIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  isAutosaveEnabled?: boolean;
  registerFlush?: (
    flush: () => Promise<{ scenario_persona_ids: string[] } | void>
  ) => void;
  // AI diff view props
  aiScenarioPersonaResources?: Array<{
    id?: string | null;
    scenario_id?: string | null;
    persona_id?: string | null;
    persona_name?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ScenarioPersonas({
  scenario_persona_ids: _scenario_persona_ids,
  scenario_persona_resources,
  show_scenario_personas = false,
  scenario_persona_suggestions: _scenario_persona_suggestions,
  scenario_personas,
  scenarios,
  scenario_resources,
  disabled = false,
  onChange,
  simulation_id,
  scenario_ids = [],
  label = "Scenario Personas",
  id = "scenario_personas",
  required = false,
  description,
  group_id,
  create_tool_id,
  link_tool_id,
  createScenarioPersonasAction,
  onPersonaIdsChange,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  // AI diff view props
  aiScenarioPersonaResources,
  onAccept,
  onReject,
}: ScenarioPersonasProps) {
  const show = show_scenario_personas ?? false;
  const allPersonas = useMemo(() => scenario_personas ?? [], [scenario_personas]);
  const currentPersonas = useMemo(
    () => scenario_persona_resources ?? [],
    [scenario_persona_resources]
  );

  const scenarioLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((scenario) => {
      const sid = scenario.scenario_id || scenario.id;
      if (sid) {
        const name = (scenario.title || scenario.name)?.trim() || null;
        const desc = scenario.description?.trim() || null;
        if (name || desc) {
          map.set(sid, name || desc || "Untitled scenario");
        }
      }
    });
    (scenario_resources ?? []).forEach((scenario) => {
      const sid = scenario.scenario_id || scenario.id;
      if (sid) {
        const name = (scenario.title || scenario.name)?.trim() || null;
        const desc = scenario.description?.trim() || null;
        map.set(sid, name || desc || "Untitled scenario");
      }
    });
    return map;
  }, [scenarios, scenario_resources]);

  // Map resource ID → artifact ID for API calls
  const artifactIdMap = useMemo(() => {
    const map = new Map<string, string>();
    (scenarios ?? []).forEach((s) => {
      if (s.id && s.scenario_id) {
        map.set(s.id, s.scenario_id);
      } else if (s.scenario_id) {
        map.set(s.scenario_id, s.scenario_id);
      }
    });
    (scenario_resources ?? []).forEach((s) => {
      if (s.id && s.scenario_id) {
        map.set(s.id, s.scenario_id);
      } else if (s.scenario_id) {
        map.set(s.scenario_id, s.scenario_id);
      }
    });
    return map;
  }, [scenarios, scenario_resources]);

  // Build available personas per scenario from allPersonas
  const personasByScenario = useMemo(() => {
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
      if (p.scenario_id && p.persona_id) {
        const existing = map.get(p.scenario_id) || [];
        // Dedupe by persona_id
        if (!existing.some((e) => e.persona_id === p.persona_id)) {
          existing.push({
            persona_id: p.persona_id,
            persona_name: p.persona_name || "Unnamed",
            persona_icon: p.persona_icon || "",
            persona_color: p.persona_color || "",
          });
        }
        map.set(p.scenario_id, existing);
      }
    });
    return map;
  }, [allPersonas]);

  // Track persona resource ID by scenario
  const [personaIdsByScenario, setPersonaIdsByScenario] = useState<
    Map<string, string>
  >(new Map());
  const personaIdsByScenarioRef = useRef<Map<string, string>>(new Map());
  personaIdsByScenarioRef.current = personaIdsByScenario;

  // Track selected persona_id (artifact) by scenario
  const [selectedPersonaByScenario, setSelectedPersonaByScenario] = useState<
    Map<string, string>
  >(new Map());

  // Ref for flush function
  const flushRef = useRef<
    (() => Promise<{ scenario_persona_ids: string[] } | void>) | null
  >(null);

  // Initialize from server resources
  useEffect(() => {
    const nextIds = new Map<string, string>();
    const nextPersonas = new Map<string, string>();
    currentPersonas.forEach((p) => {
      const scenarioId = p.scenario_id;
      const resourceId = p.id;
      const personaId = p.persona_id;
      if (scenarioId && resourceId) {
        nextIds.set(scenarioId, resourceId);
      }
      if (scenarioId && personaId) {
        nextPersonas.set(scenarioId, personaId);
      }
    });
    setPersonaIdsByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
    setSelectedPersonaByScenario((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextPersonas.entries()).sort());
      return prevKey === nextKey ? prev : nextPersonas;
    });
  }, [currentPersonas]);

  // Sync to parent via onPersonaIdsChange
  const onPersonaIdsChangeRef = useRef(onPersonaIdsChange);
  onPersonaIdsChangeRef.current = onPersonaIdsChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!onPersonaIdsChangeRef.current) return;
    const ids = scenario_ids
      .map((scenarioId) => personaIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onPersonaIdsChangeRef.current(ids);
    }
  }, [personaIdsByScenario, scenario_ids]);

  // Update flush function
  flushRef.current = async (): Promise<{
    scenario_persona_ids: string[];
  } | void> => {
    const ids = scenario_ids
      .map((scenarioId) => personaIdsByScenario.get(scenarioId))
      .filter((value): value is string => Boolean(value));
    return { scenario_persona_ids: ids };
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const handlePersonaChange = useCallback(
    (scenarioId: string, personaId: string) => {
      const updated = new Map(selectedPersonaByScenario);
      updated.set(scenarioId, personaId);
      setSelectedPersonaByScenario(updated);

      // Convert to array format for parent
      const personasArray = Array.from(
        updated.entries()
      ).map(([sid, pid]) => {
        const details = allPersonas.find(
          (p) => p.scenario_id === sid && p.persona_id === pid
        );
        return {
          simulation_id: simulation_id || "",
          scenario_id: sid,
          persona_id: pid,
          persona_name: details?.persona_name || undefined,
          persona_description: details?.persona_description || undefined,
          persona_icon: details?.persona_icon || undefined,
          persona_color: details?.persona_color || undefined,
          generated: false,
        } satisfies ScenarioPersonaItem;
      });

      onChange(personasArray);

      const shouldCreateResource =
        isAutosaveEnabled &&
        createScenarioPersonasAction &&
        create_tool_id &&
        group_id &&
        simulation_id;
      if (!shouldCreateResource) {
        return;
      }

      const artifactScenarioId = artifactIdMap.get(scenarioId) ?? scenarioId;

      void (async () => {
        try {
          const result = await createScenarioPersonasAction({
            body: {
              group_id: group_id,
              simulation_id: simulation_id,
              scenario_id: artifactScenarioId,
              persona_id: personaId,
              mcp: false,
            },
          });

          if (!result?.id) {
            return;
          }

          setPersonaIdsByScenario((prev) => {
            const next = new Map(prev);
            next.set(scenarioId, result.id as string);
            return next;
          });
        } catch {
          // Resource creation errors are handled by API; keep UI state intact.
        }
      })();
    },
    [
      selectedPersonaByScenario,
      simulation_id,
      onChange,
      isAutosaveEnabled,
      createScenarioPersonasAction,
      create_tool_id,
      group_id,
      allPersonas,
      artifactIdMap,
    ]
  );

  // AI suggestion state
  const showDiff = !!aiScenarioPersonaResources?.length;

  // Set of AI-suggested scenario IDs for styling
  const aiSuggestedScenarioIds = useMemo(
    () =>
      new Set(
        aiScenarioPersonaResources
          ?.map((r) => r.scenario_id)
          .filter(Boolean) as string[]
      ),
    [aiScenarioPersonaResources]
  );

  // Accept AI suggestion - apply AI-suggested persona assignments
  const handleAccept = useCallback(() => {
    if (!aiScenarioPersonaResources?.length) return;
    aiScenarioPersonaResources.forEach((r) => {
      if (r.scenario_id && r.persona_id) {
        handlePersonaChange(r.scenario_id, r.persona_id);
      }
    });
    onAccept?.();
  }, [aiScenarioPersonaResources, handlePersonaChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_scenario_personas is false or no scenarios
  if (!show || scenario_ids.length === 0) {
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
          {onGenerate && showAiGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate Persona Assignments</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
      {/* AI-suggested persona assignments preview */}
      {showDiff && aiScenarioPersonaResources && aiScenarioPersonaResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Persona Assignments</p>
          <div className="space-y-2">
            {aiScenarioPersonaResources.map((item, idx) => {
              const scenarioLabel = scenarioLabelMap.get(item.scenario_id || "") ?? "Unknown scenario";
              const personaLabel = item.persona_name || "Unknown persona";
              return (
                <div
                  key={item.id || `${item.scenario_id}-${item.persona_id}` || idx}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 border-success bg-success/10",
                    "text-sm"
                  )}
                >
                  <span className="font-medium">{scenarioLabel}:</span>
                  <span>{personaLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="pl-4 space-y-3">
        {scenario_ids.map((scenarioId) => {
          const isAiSuggested = aiSuggestedScenarioIds.has(scenarioId);
          const scenarioLabel =
            scenarioLabelMap.get(scenarioId) ?? "Untitled scenario";
          const availablePersonas = personasByScenario.get(scenarioId) || [];
          const selectedPersonaId =
            selectedPersonaByScenario.get(scenarioId) || "";

          if (availablePersonas.length === 0) {
            return null;
          }

          return (
            <div
              key={scenarioId}
              className={cn(
                "flex items-center gap-3",
                isAiSuggested && "ring-2 ring-success bg-success/5 rounded-lg p-2"
              )}
            >
              <span
                className="text-sm font-medium min-w-[140px] truncate"
                title={scenarioLabel}
              >
                {scenarioLabel}
              </span>
              <Select
                value={selectedPersonaId}
                onValueChange={(value) =>
                  handlePersonaChange(scenarioId, value)
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select persona..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePersonas.map((persona) => (
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
