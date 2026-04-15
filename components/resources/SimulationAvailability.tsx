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
import { cn } from "@/lib/utils";
import { Calendar, Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftSimulationAvailabilityIn = {
  body: {
    simulation_id: string;
    availability_time: string;
    type: string;
    mcp: boolean;
    tool_id?: string;
  };
};
type CreateDraftSimulationAvailabilityOut = {
  id?: string | null;
};

export interface SimulationAvailabilityResourceItem {
  id?: string | null;
  simulation_id?: string | null;
  time?: string | null;
  type?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

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
  /** Callback to emit availability values for unified draft */
  onSimulationAvailabilityValues?: (values: Array<{ simulation_id: string; time: string; type: string }>) => void;
  onGenerate?: () => void | Promise<void>;
  isAutosaveEnabled?: boolean;
  registerFlush?: (
    flush: () => Promise<{ simulation_availability_ids: string[] } | void>,
  ) => void;
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
  onSimulationAvailabilityValues,
  onGenerate: _onGenerate,
  isAutosaveEnabled = true,
  registerFlush,
}: SimulationAvailabilityProps) {
  const show = show_simulation_availability ?? false;
  const availabilityResources = useMemo(
    () => simulation_availability_resources ?? [],
    [simulation_availability_resources],
  );

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return availabilityResources.filter((r) => r.pending && r.id);
  }, [availabilityResources]);
  const showDiff = pendingItems.length > 0;
  // Track which simulation IDs have pending resources
  const pendingSimulationKeys = useMemo(() => {
    const keys = new Set<string>();
    pendingItems.forEach((r) => {
      if (r.simulation_id && r.type) {
        keys.add(`${r.simulation_id}:${r.type}`);
      }
    });
    return keys;
  }, [pendingItems]);

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

  // Emit availability values for unified draft
  const onSimulationAvailabilityValuesRef = useRef(onSimulationAvailabilityValues);
  onSimulationAvailabilityValuesRef.current = onSimulationAvailabilityValues;
  useEffect(() => {
    if (!onSimulationAvailabilityValuesRef.current) return;
    const values: Array<{ simulation_id: string; time: string; type: string }> = [];
    availabilityBySimulation.forEach((availability, simulationId) => {
      if (availability.start) {
        values.push({ simulation_id: simulationId, time: new Date(availability.start).toISOString(), type: "start" });
      }
      if (availability.end) {
        values.push({ simulation_id: simulationId, time: new Date(availability.end).toISOString(), type: "end" });
      }
    });
    onSimulationAvailabilityValuesRef.current(values);
  }, [availabilityBySimulation]);

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

  // Accept pending — pending items are already in the resources, just confirm (no-op)
  const handleAccept = useCallback(() => {
    // Pending items are already included in availability resources.
    // The next draft save will persist them as active.
    // Nothing to change in form state.
  }, []);

  // Reject pending — remove pending availability resources from state
  const handleReject = useCallback(() => {
    // Remove pending items from availabilityIds
    const newIds = new Map(availabilityIds);
    pendingItems.forEach((r) => {
      if (r.simulation_id && r.type) {
        newIds.delete(`${r.simulation_id}:${r.type}`);
      }
    });
    setAvailabilityIds(newIds);

    // Remove pending time values from availabilityBySimulation
    setAvailabilityBySimulation((prev) => {
      const next = new Map(prev);
      pendingItems.forEach((r) => {
        if (r.simulation_id && r.type) {
          const existing = next.get(r.simulation_id);
          if (existing) {
            const updated = { ...existing };
            if (r.type === "start") {
              updated.start = undefined;
            } else if (r.type === "end") {
              updated.end = undefined;
            }
            next.set(r.simulation_id, updated);
          }
        }
      });
      return next;
    });

    // Notify parent of updated IDs
    if (onAvailabilityIdsChange) {
      const ids = Array.from(new Map(availabilityIds).entries())
        .filter(([key]) => !pendingItems.some((r) => r.simulation_id && r.type && `${r.simulation_id}:${r.type}` === key))
        .map(([, val]) => val);
      onAvailabilityIdsChange(ids);
    }
  }, [availabilityIds, pendingItems, onAvailabilityIdsChange]);

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
      <div className="grid grid-cols-1 gap-3 pl-4">
        {simulation_ids.map((simulationId) => {
          const availability = availabilityBySimulation.get(simulationId) ?? {};
          const labelText =
            simulationLabelMap.get(simulationId) ??
            simulationId.slice(0, 8);
          const isStartPending = pendingSimulationKeys.has(`${simulationId}:start`);
          const isEndPending = pendingSimulationKeys.has(`${simulationId}:end`);
          const isPending = isStartPending || isEndPending;

          return (
            <div
              key={simulationId}
              className={cn(
                "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md hover:bg-accent/50",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              {/* Pending badge - top right */}
              {isPending && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </div>
              )}

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
