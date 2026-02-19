/**
 * SimulationAvailability.tsx
 * Resource component for managing simulation availability windows within cohorts
 * Allows setting start and end times per selected simulation
 */

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { useResourceAi } from "@/hooks/use-resource-ai";
import { Calendar, Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftSimulationAvailabilityIn = InputOf<
  "/api/v4/resources/simulation_availability",
  "post"
>;
type CreateDraftSimulationAvailabilityOut = OutputOf<
  "/api/v4/resources/simulation_availability",
  "post"
>;

// Derive resource item type from the GET endpoint response
type SimulationAvailabilityGetResponse = OutputOf<
  "/api/v4/resources/simulation_availability/get",
  "post"
>;
export type SimulationAvailabilityResourceItem = NonNullable<
  SimulationAvailabilityGetResponse["items"]
>[number];

export interface SimulationAvailabilityProps {
  simulation_availability_ids?: string[];
  simulation_availability_resources?: SimulationAvailabilityResourceItem[];
  show_simulation_availability?: boolean;
  simulation_ids?: string[];
  simulations?: Array<{
    id?: string | null;
    simulation_id?: string | null;
    name?: string | null;
    description?: string | null;
  }>;
  simulation_resources?: Array<{
    id?: string | null;
    simulation_id?: string | null;
    name?: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  create_tool_id?: string | null;
  createSimulationAvailabilityAction?:
    | ((
        input: CreateDraftSimulationAvailabilityIn,
      ) => Promise<CreateDraftSimulationAvailabilityOut>)
    | undefined;
  onAvailabilityIdsChange?: (ids: string[]) => void;
  onGenerate?: () => void | Promise<void>;
  showAiGenerate?: boolean;
  isGenerating?: boolean;
  isAutosaveEnabled?: boolean;
  registerFlush?: (
    flush: () => Promise<{ simulation_availability_ids: string[] } | void>,
  ) => void;
  aiSimulationAvailabilityResources?:
    | Pick<
        SimulationAvailabilityResourceItem,
        "id" | "simulation_id" | "time" | "type"
      >[]
    | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function SimulationAvailability({
  simulation_availability_resources,
  show_simulation_availability = false,
  simulation_ids = [],
  simulations,
  simulation_resources,
  disabled = false,
  label = "Simulation Availability",
  id = "simulation_availability",
  required = false,
  description,
  group_id,
  create_tool_id,
  createSimulationAvailabilityAction,
  onAvailabilityIdsChange,
  onGenerate,
  showAiGenerate = false,
  isAutosaveEnabled = true,
  registerFlush,
  aiSimulationAvailabilityResources,
  onAccept: onAcceptProp,
  onReject: onRejectProp,
}: SimulationAvailabilityProps) {
  const show = show_simulation_availability ?? false;
  const availabilityResources = useMemo(
    () => simulation_availability_resources ?? [],
    [simulation_availability_resources],
  );

  // Socket-based AI suggestion handling
  type AiAvailabilitySuggestion = Pick<
    SimulationAvailabilityResourceItem,
    "id" | "simulation_id" | "time" | "type"
  >;
  const {
    isGenerating: aiIsGenerating,
    aiSuggestion,
    clear: clearAi,
  } = useResourceAi({
    resourceType: "simulation_availability",
    groupId: group_id,
  });

  const effectiveAiResources =
    aiSuggestion ?? aiSimulationAvailabilityResources ?? null;

  // Map simulation IDs to display names
  const simulationLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (simulations ?? []).forEach((sim) => {
      const simId = sim.simulation_id || sim.id;
      if (simId) {
        const name = sim.name?.trim() || sim.description?.trim() || null;
        if (name) map.set(simId, name);
      }
    });
    (simulation_resources ?? []).forEach((sim) => {
      const simId = sim.simulation_id || sim.id;
      if (simId) {
        const name = sim.name?.trim() || sim.description?.trim() || "";
        map.set(simId, name || "Untitled simulation");
      }
    });
    return map;
  }, [simulations, simulation_resources]);

  // Track availability times per simulation: Map<simulationId, { start?: string, end?: string }>
  const [availabilityBySimulation, setAvailabilityBySimulation] = useState<
    Map<string, { start?: string; end?: string }>
  >(new Map());

  // Track resource IDs per simulation+type: Map<`${simulationId}:${type}`, resourceId>
  const [availabilityIds, setAvailabilityIds] = useState<Map<string, string>>(
    new Map(),
  );
  const createdKeysRef = useRef<Set<string>>(new Set());

  const flushRef = useRef<
    (() => Promise<{ simulation_availability_ids: string[] } | void>) | null
  >(null);

  // Initialize state from resources
  useEffect(() => {
    const nextAvailability = new Map<
      string,
      { start?: string; end?: string }
    >();
    const nextIds = new Map<string, string>();

    availabilityResources.forEach((resource) => {
      if (resource.simulation_id && resource.type) {
        const simId = resource.simulation_id;
        const existing = nextAvailability.get(simId) ?? {};
        const timeValue = resource.time
          ? new Date(resource.time).toISOString().slice(0, 16)
          : undefined;

        if (resource.type === "start") {
          existing.start = timeValue;
        } else if (resource.type === "end") {
          existing.end = timeValue;
        }
        nextAvailability.set(simId, existing);

        if (resource.id) {
          nextIds.set(`${simId}:${resource.type}`, resource.id);
        }
      }
    });

    // Ensure all selected simulations have entries
    simulation_ids.forEach((simId) => {
      if (!nextAvailability.has(simId)) {
        nextAvailability.set(simId, {});
      }
    });

    setAvailabilityBySimulation((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(
        Array.from(nextAvailability.entries()).sort(),
      );
      return prevKey === nextKey ? prev : nextAvailability;
    });
    setAvailabilityIds((prev) => {
      const prevKey = JSON.stringify(Array.from(prev.entries()).sort());
      const nextKey = JSON.stringify(Array.from(nextIds.entries()).sort());
      return prevKey === nextKey ? prev : nextIds;
    });
  }, [simulation_ids, availabilityResources]);

  // Sync IDs to parent
  const onAvailabilityIdsChangeRef = useRef(onAvailabilityIdsChange);
  onAvailabilityIdsChangeRef.current = onAvailabilityIdsChange;
  const prevIdsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!onAvailabilityIdsChangeRef.current) return;
    const ids = Array.from(availabilityIds.values());
    const idsKey = ids.join(",");
    const prevKey = prevIdsRef.current.join(",");
    if (idsKey !== prevKey) {
      prevIdsRef.current = ids;
      onAvailabilityIdsChangeRef.current(ids);
    }
  }, [availabilityIds]);

  // Flush function for manual save mode
  flushRef.current = async (): Promise<{
    simulation_availability_ids: string[];
  } | void> => {
    const ids = Array.from(availabilityIds.values());
    return { simulation_availability_ids: ids };
  };

  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const createAvailability = useCallback(
    async (simulationId: string, time: string, type: "start" | "end") => {
      if (
        !isAutosaveEnabled ||
        !createSimulationAvailabilityAction ||
        !group_id
      ) {
        return;
      }
      const key = `${simulationId}:${type}:${time}`;
      if (createdKeysRef.current.has(key)) return;
      createdKeysRef.current.add(key);

      try {
        const result = await createSimulationAvailabilityAction({
          body: {
            group_id: group_id,
            simulation_id: simulationId,
            availability_time: new Date(time).toISOString(),
            type: type,
            mcp: false,
            tool_id: create_tool_id ?? undefined,
          },
        });

        if (!result?.id) return;

        setAvailabilityIds((prev) => {
          const next = new Map(prev);
          next.set(`${simulationId}:${type}`, result.id as string);
          return next;
        });
      } catch {
        // Resource creation errors handled by API
      }
    },
    [
      isAutosaveEnabled,
      createSimulationAvailabilityAction,
      create_tool_id,
      group_id,
    ],
  );

  const handleTimeChange = useCallback(
    (simulationId: string, type: "start" | "end", value: string) => {
      setAvailabilityBySimulation((prev) => {
        const next = new Map(prev);
        const existing = next.get(simulationId) ?? {};
        if (type === "start") {
          existing.start = value || undefined;
        } else {
          existing.end = value || undefined;
        }
        next.set(simulationId, { ...existing });
        return next;
      });

      if (value) {
        void createAvailability(simulationId, value, type);
      }
    },
    [createAvailability],
  );

  const hasGenerated = useMemo(() => {
    return availabilityResources.some((resource) => resource.generated);
  }, [availabilityResources]);

  const showDiff = !!effectiveAiResources?.length;

  const handleAccept = useCallback(() => {
    if (onAcceptProp) {
      onAcceptProp();
    } else if (effectiveAiResources?.length) {
      effectiveAiResources.forEach((r) => {
        if (r.simulation_id && r.time && r.type) {
          const timeValue = new Date(r.time).toISOString().slice(0, 16);
          handleTimeChange(
            r.simulation_id,
            r.type as "start" | "end",
            timeValue,
          );
        }
      });
      clearAi();
    }
  }, [effectiveAiResources, handleTimeChange, clearAi, onAcceptProp]);

  const handleReject = useCallback(() => {
    if (onRejectProp) {
      onRejectProp();
    } else {
      clearAi();
    }
  }, [clearAi, onRejectProp]);

  if (!show || simulation_ids.length === 0) {
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
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
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
      {/* AI suggestion preview */}
      {showDiff && effectiveAiResources && effectiveAiResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">
            AI Suggested Availability
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {effectiveAiResources.map((item, idx) => {
              const simLabel =
                simulationLabelMap.get(item.simulation_id || "") ??
                "Unknown simulation";
              const timeDisplay = item.time
                ? new Date(item.time).toLocaleString()
                : "Not set";
              return (
                <div
                  key={item.id || `${item.simulation_id}:${item.type}` || idx}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 border-success bg-success/10",
                    "text-sm",
                  )}
                >
                  <Calendar className="h-4 w-4 text-success" />
                  <span className="font-medium">{simLabel}:</span>
                  <span className="capitalize">{item.type}</span>
                  <span className="text-muted-foreground">{timeDisplay}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 pl-4">
        {simulation_ids.map((simulationId) => {
          const availability = availabilityBySimulation.get(simulationId) ?? {};
          const labelText =
            simulationLabelMap.get(simulationId) ??
            simulationId.slice(0, 8);

          return (
            <div
              key={simulationId}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:bg-accent/50",
              )}
            >
              <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3
                  className="font-medium text-sm leading-tight truncate"
                  title={labelText}
                >
                  {labelText}
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-10">
                      Start
                    </Label>
                    <Input
                      type="datetime-local"
                      value={availability.start ?? ""}
                      onChange={(e) =>
                        handleTimeChange(
                          simulationId,
                          "start",
                          e.target.value,
                        )
                      }
                      disabled={disabled}
                      className="h-8 w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-10">
                      End
                    </Label>
                    <Input
                      type="datetime-local"
                      value={availability.end ?? ""}
                      onChange={(e) =>
                        handleTimeChange(
                          simulationId,
                          "end",
                          e.target.value,
                        )
                      }
                      disabled={disabled}
                      className="h-8 w-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
