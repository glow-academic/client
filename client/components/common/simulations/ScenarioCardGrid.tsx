"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Filter,
  Search,
  User,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type SimulationsListOut = OutputOf<"/api/v3/simulations/list", "post">;
type ScenarioMappingItem = SimulationsListOut["scenario_mapping"][string];

// Filter key constants
const NO_PERSONA_KEY = "__no_persona__";
const NO_DOCUMENTS_KEY = "__no_documents__";
const NO_PARAMS_KEY = "__no_params__";

export interface ScenarioCardGridProps<
  T extends ScenarioMappingItem = ScenarioMappingItem,
> {
  scenarioMapping: Record<string, T>;
  validScenarioIds: string[];
  selectedScenarioIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  description?: string;
  readonly?: boolean;
}

export function ScenarioCardGrid<
  T extends ScenarioMappingItem = ScenarioMappingItem,
>({
  scenarioMapping,
  validScenarioIds,
  selectedScenarioIds,
  onSelect,
  label = "Scenarios",
  description = "Select scenarios to add to the simulation",
  readonly = false,
}: ScenarioCardGridProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterPersonaIds, setFilterPersonaIds] = React.useState<string[]>([]);
  const [filterDocumentIds, setFilterDocumentIds] = React.useState<string[]>(
    [],
  );
  const [filterParameterItemIds, setFilterParameterItemIds] = React.useState<
    string[]
  >([]);

  // Build scenarios from mapping
  const baseScenarios = React.useMemo(() => {
    const scenarios = validScenarioIds.map((id) => ({
      id,
      ...scenarioMapping[id],
    }));

    // Sort by name
    return scenarios.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [validScenarioIds, scenarioMapping]);

  // Build persona filter options
  const personaOptions = React.useMemo(() => {
    const personaMap = new Map<
      string,
      { name: string; color: string; icon: string; count: number }
    >();
    let hasNoPersona = false;

    baseScenarios.forEach((sc) => {
      if (!sc.persona_ids || sc.persona_ids.length === 0) {
        hasNoPersona = true;
      } else {
        const persona = Object.entries(sc.persona_mapping || {}).find(
          ([id]) => id === sc.persona_ids?.[0],
        )?.[1];
        if (persona) {
          const existing = personaMap.get(sc.persona_ids?.[0] || "");
          personaMap.set(sc.persona_ids?.[0] || "", {
            name: persona.name,
            color: persona.color,
            icon: persona.icon,
            count: (existing?.count || 0) + 1,
          });
        }
      }
    });

    const options = Array.from(personaMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    options.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    if (hasNoPersona) {
      options.push({
        id: NO_PERSONA_KEY,
        name: "No Persona",
        color: "#gray",
        icon: "user-x",
        count: baseScenarios.filter(
          (sc) => !sc.persona_ids || sc.persona_ids.length === 0,
        ).length,
      });
    }

    return options;
  }, [baseScenarios]);

  // Build document filter options
  const documentOptions = React.useMemo(() => {
    const documentMap = new Map<
      string,
      { name: string; description: string; count: number }
    >();
    let hasNoDocuments = false;

    baseScenarios.forEach((sc) => {
      if (!sc.document_ids || sc.document_ids.length === 0) {
        hasNoDocuments = true;
      } else {
        sc.document_ids.forEach((docId) => {
          const doc = sc.document_mapping?.[docId] as {
            name?: string;
            description?: string;
          } | undefined;
          if (doc && doc.name && doc.description) {
            const existing = documentMap.get(docId);
            documentMap.set(docId, {
              name: doc.name,
              description: doc.description,
              count: (existing?.count || 0) + 1,
            });
          }
        });
      }
    });

    const options = Array.from(documentMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    options.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    if (hasNoDocuments) {
      options.push({
        id: NO_DOCUMENTS_KEY,
        name: "No Documents",
        description: "Scenarios without documents",
        count: baseScenarios.filter(
          (sc) => !sc.document_ids || sc.document_ids.length === 0,
        ).length,
      });
    }

    return options;
  }, [baseScenarios]);

  // Build parameter item filter options
  const parameterItemOptions = React.useMemo(() => {
    const paramMap = new Map<
      string,
      { label: string; parameterName: string; count: number }
    >();
    let hasNoParams = false;

    baseScenarios.forEach((sc) => {
      if (!sc.parameter_item_ids || sc.parameter_item_ids.length === 0) {
        hasNoParams = true;
      } else {
        sc.parameter_item_ids.forEach((paramItemId) => {
          const paramItem = sc.parameter_item_mapping?.[paramItemId] as {
            parameter_name?: string;
            name?: string;
          } | undefined;
          if (paramItem && paramItem.parameter_name && paramItem.name) {
            const existing = paramMap.get(paramItemId);
            paramMap.set(paramItemId, {
              label: paramItem.name,
              parameterName: paramItem.parameter_name,
              count: (existing?.count || 0) + 1,
            });
          }
        });
      }
    });

    const options = Array.from(paramMap.entries()).map(([id, data]) => ({
      id,
      ...data,
    }));

    options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    if (hasNoParams) {
      options.push({
        id: NO_PARAMS_KEY,
        label: "No Parameters",
        parameterName: "None",
        count: baseScenarios.filter(
          (sc) => !sc.parameter_item_ids || sc.parameter_item_ids.length === 0,
        ).length,
      });
    }

    return options;
  }, [baseScenarios]);

  // Apply search and filters, then sort selected first
  const filteredScenarios = React.useMemo(() => {
    let filtered = baseScenarios;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (scenario) =>
          scenario.name?.toLowerCase().includes(searchLower) ||
          scenario.description?.toLowerCase().includes(searchLower),
      );
    }

    // Apply filters with AND logic across groups
    filtered = filtered.filter((scenario) => {
      // Persona filter (OR within group)
      if (filterPersonaIds.length > 0) {
        const hasNoPersona = filterPersonaIds.includes(NO_PERSONA_KEY);
        const matchesPersona =
          scenario.persona_ids &&
          scenario.persona_ids.length > 0 &&
          filterPersonaIds.includes(scenario.persona_ids?.[0] || "");
        if (!hasNoPersona && !matchesPersona) return false;
        if (
          hasNoPersona &&
          scenario.persona_ids &&
          scenario.persona_ids.length > 0 &&
          !matchesPersona
        )
          return false;
      }

      // Document filter (OR within group)
      if (filterDocumentIds.length > 0) {
        const hasNoDocuments = filterDocumentIds.includes(NO_DOCUMENTS_KEY);
        const matchesDocument = scenario.document_ids?.some((id) =>
          filterDocumentIds.includes(id),
        );
        if (!hasNoDocuments && !matchesDocument) return false;
        if (
          hasNoDocuments &&
          scenario.document_ids &&
          scenario.document_ids.length > 0 &&
          !matchesDocument
        )
          return false;
      }

      // Parameter item filter (OR within group)
      if (filterParameterItemIds.length > 0) {
        const hasNoParams = filterParameterItemIds.includes(NO_PARAMS_KEY);
        const matchesParam = scenario.parameter_item_ids?.some((id) =>
          filterParameterItemIds.includes(id),
        );
        if (!hasNoParams && !matchesParam) return false;
        if (
          hasNoParams &&
          scenario.parameter_item_ids &&
          scenario.parameter_item_ids.length > 0 &&
          !matchesParam
        )
          return false;
      }

      return true;
    });

    // Sort: selected scenarios first, then by name
    return filtered.sort((a, b) => {
      const aSelected = selectedScenarioIds.includes(a.id);
      const bSelected = selectedScenarioIds.includes(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [
    baseScenarios,
    searchTerm,
    filterPersonaIds,
    filterDocumentIds,
    filterParameterItemIds,
    selectedScenarioIds,
  ]);

  const handleSelect = (scenarioId: string) => {
    if (readonly) return;
    const isSelected = selectedScenarioIds.includes(scenarioId);
    const newIds = isSelected
      ? selectedScenarioIds.filter((id) => id !== scenarioId)
      : [...selectedScenarioIds, scenarioId];
    onSelect(newIds);
  };

  // Helper to render parameter badges
  const getScenarioParameterBadges = (scenario: { id: string } & T) => {
    if (
      !scenario.parameter_item_ids ||
      scenario.parameter_item_ids.length === 0
    ) {
      return [];
    }
    const badges: {
      parameterName: string;
      value: string;
      parameterId: string;
    }[] = [];
    scenario.parameter_item_ids.forEach((parameterItemId) => {
      const parameterItem = scenario.parameter_item_mapping?.[parameterItemId] as {
        parameter_name?: string;
        name?: string;
        parameter_id?: string;
      } | undefined;
      if (
        parameterItem &&
        parameterItem.parameter_name &&
        parameterItem.name &&
        parameterItem.parameter_id
      ) {
        badges.push({
          parameterName: parameterItem.parameter_name,
          value: parameterItem.name,
          parameterId: parameterItem.parameter_id,
        });
      }
    });
    return badges;
  };

  const activeFilterCount =
    filterPersonaIds.length +
    filterDocumentIds.length +
    filterParameterItemIds.length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search and Filter Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search scenarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
          <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Filter scenarios"
                className={cn(
                  "h-6 w-6 p-0 hover:bg-accent ml-auto",
                  activeFilterCount > 0 ? "text-primary" : "text-muted-foreground opacity-50",
                )}
                disabled={readonly}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterPopoverOpen((prev) => !prev);
                }}
              >
                <Filter className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && !filterPopoverOpen && (
                  <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-background" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-[500px] p-0" align="end" sideOffset={8}>
              <div className="max-h-[500px] flex flex-col">
                <ScrollArea className="flex-1 overflow-y-auto p-4 space-y-4 mb-2 max-h-[400px]">
                  {/* Personas Section */}
                  {personaOptions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-4 w-4" />
                        <span>Personas</span>
                      </div>
                      <div className="space-y-2 pl-6">
                        {personaOptions.map((opt) => {
                          const checked = filterPersonaIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  setFilterPersonaIds((prev) => {
                                    if (isChecked) {
                                      if (prev.includes(opt.id)) return prev;
                                      return [...prev, opt.id];
                                    }
                                    return prev.filter((x) => x !== opt.id);
                                  });
                                }}
                              />
                              <span className="truncate">{opt.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {opt.count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Documents Section */}
                  {documentOptions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4" />
                        <span>Documents</span>
                      </div>
                      <div className="space-y-2 pl-6">
                        {documentOptions.map((opt) => {
                          const checked = filterDocumentIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  setFilterDocumentIds((prev) => {
                                    if (isChecked) {
                                      if (prev.includes(opt.id)) return prev;
                                      return [...prev, opt.id];
                                    }
                                    return prev.filter((x) => x !== opt.id);
                                  });
                                }}
                              />
                              <span className="truncate">{opt.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {opt.count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Parameter Items Section */}
                  {parameterItemOptions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Filter className="h-4 w-4" />
                        <span>Parameter Items</span>
                      </div>
                      <div className="space-y-2 pl-6">
                        {parameterItemOptions.map((opt) => {
                          const checked = filterParameterItemIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  setFilterParameterItemIds((prev) => {
                                    if (isChecked) {
                                      if (prev.includes(opt.id)) return prev;
                                      return [...prev, opt.id];
                                    }
                                    return prev.filter((x) => x !== opt.id);
                                  });
                                }}
                              />
                              <span className="truncate">{opt.label}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {opt.count}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {personaOptions.length === 0 &&
                    documentOptions.length === 0 &&
                    parameterItemOptions.length === 0 && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No filters available
                      </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    {activeFilterCount} selected
                  </div>
                  <div className="flex gap-2">
                    {activeFilterCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilterPersonaIds([]);
                          setFilterDocumentIds([]);
                          setFilterParameterItemIds([]);
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setFilterPopoverOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto py-2 px-2">
          {filteredScenarios.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No scenarios found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredScenarios.map((scenario) => {
              const isSelected = selectedScenarioIds.includes(scenario.id);
              const badges = getScenarioParameterBadges(scenario);

              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => handleSelect(scenario.id)}
                  disabled={readonly}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent"
                  )}
                >
                  {/* Check icon - top right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight">
                        {scenario.name || "Unnamed Scenario"}
                      </h3>
                      {scenario.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {scenario.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {badges.slice(0, 3).map((badge, idx) => (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              {badge.value}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{badge.parameterName}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      {badges.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{badges.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

