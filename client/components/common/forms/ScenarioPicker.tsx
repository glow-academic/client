/**
 * ScenarioPicker.tsx
 * Used to pick scenarios (for simulations) with parameter badges
 * Refactored to use mapping-based API pattern
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import {
  Check,
  ChevronsUpDown,
  FileText,
  Filter,
  Play,
  User,
  X,
} from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
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
import { useMutationObserver } from "@/hooks/use-mutation-observer";
import { cn } from "@/lib/utils";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type SimulationsListOut = OutputOf<"/api/v3/simulations/list", "post">;
type ScenarioMappingItem = SimulationsListOut["scenario_mapping"][string];
type PersonaMappingItem =
  SimulationsListOut["scenario_mapping"][string]["persona_mapping"][string];
type MappingItem = {
  name: string;
  description: string;
};
type ParameterItemMappingItem =
  SimulationsListOut["scenario_mapping"][string]["parameter_item_mapping"][string];

// Filter key constants
const NO_PERSONA_KEY = "__no_persona__";
const NO_DOCUMENTS_KEY = "__no_documents__";
const NO_PARAMS_KEY = "__no_params__";

export interface ScenarioPickerProps<
  T extends ScenarioMappingItem = ScenarioMappingItem,
> extends PopoverProps {
  scenarioMapping: Record<string, T>;
  validScenarioIds: string[];
  selectedScenarioIds: string[];
  onSelect: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  showOnlyActive?: boolean;
  showLabel?: boolean;
  buttonClassName?: string;
  isPracticeSimulation?: boolean;
  disabled?: boolean;
}

export function ScenarioPicker<
  T extends ScenarioMappingItem = ScenarioMappingItem,
>({
  scenarioMapping,
  validScenarioIds,
  selectedScenarioIds,
  onSelect,
  label = "Scenarios",
  placeholder = "Select scenarios...",
  description = "Select one or more scenarios to assign to the simulation.",
  hideSelectedChips = true,
  showLabel = true,
  buttonClassName,
  disabled = false,
  ...props
}: ScenarioPickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = React.useState(false);
  const [filterPersonaIds, setFilterPersonaIds] = React.useState<string[]>([]);
  const [filterDocumentIds, setFilterDocumentIds] = React.useState<string[]>(
    [],
  );
  const [filterParameterItemIds, setFilterParameterItemIds] = React.useState<
    string[]
  >([]);

  // Build scenarios from mapping (server already filters to root scenarios only)
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
      // TODO: Handle multiple personas
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

    // Sort by count desc, then name
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
          const doc = sc.document_mapping?.[docId];
          if (doc) {
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

    // Sort by count desc, then name
    options.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    if (hasNoDocuments) {
      options.push({
        id: NO_DOCUMENTS_KEY,
        name: "No Documents",
        description: "",
        count: baseScenarios.filter(
          (sc) => !sc.document_ids || sc.document_ids.length === 0,
        ).length,
      });
    }

    return options;
  }, [baseScenarios]);

  // Build frequency-ranked parameter item options across base scenarios
  const parameterItemOptions = React.useMemo(() => {
    const countMap = new Map<
      string,
      {
        name: string;
        parameterName: string;
        description: string;
        count: number;
      }
    >();
    let hasNoParams = false;

    baseScenarios.forEach((sc) => {
      if (!sc.parameter_item_ids || sc.parameter_item_ids.length === 0) {
        hasNoParams = true;
      } else {
        sc.parameter_item_ids.forEach((paramId) => {
          const param = sc.parameter_item_mapping?.[paramId];
          if (param) {
            const existing = countMap.get(paramId);
            countMap.set(paramId, {
              name: param.name,
              parameterName: param.parameter_name,
              description: param.description,
              count: (existing?.count || 0) + 1,
            });
          }
        });
      }
    });

    const options = Array.from(countMap.entries()).map(([id, data]) => ({
      id,
      label: `${data.parameterName}: ${data.name}`,
      ...data,
    }));

    // Sort by count desc, then label
    options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    if (hasNoParams) {
      options.push({
        id: NO_PARAMS_KEY,
        label: "No Parameter Items",
        name: "No Parameter Items",
        parameterName: "",
        description: "",
        count: baseScenarios.filter(
          (sc) => !sc.parameter_item_ids || sc.parameter_item_ids.length === 0,
        ).length,
      });
    }

    return options;
  }, [baseScenarios]);

  // Apply filters with AND logic across groups
  const filteredScenarios = React.useMemo(() => {
    return baseScenarios.filter((scenario) => {
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
  }, [
    baseScenarios,
    filterPersonaIds,
    filterDocumentIds,
    filterParameterItemIds,
  ]);

  const [peekedScenario, setPeekedScenario] = React.useState<
    ({ id: string } & T) | undefined
  >(filteredScenarios[0] as ({ id: string } & T) | undefined);

  const handleSelect = (scenarioId: string) => {
    const isSelected = selectedScenarioIds.includes(scenarioId);
    const newIds = isSelected
      ? selectedScenarioIds.filter((id) => id !== scenarioId)
      : [...selectedScenarioIds, scenarioId];
    onSelect(newIds);
    // Don't close popover in multi-select mode
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Remove individual item
  const handleRemoveItem = (scenarioId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedScenarioIds.filter((id) => id !== scenarioId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedScenarioIds.length === 0) {
      return placeholder;
    }
    if (selectedScenarioIds.length === 1) {
      const scenario = scenarioMapping[selectedScenarioIds[0]!];
      return scenario?.name || placeholder;
    }
    return `${selectedScenarioIds.length} scenarios selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Helper to render parameter badges in hover (keep for richer preview)
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
      const parameterItem = scenario.parameter_item_mapping?.[parameterItemId];
      if (parameterItem) {
        badges.push({
          parameterName: parameterItem.parameter_name,
          value: parameterItem.name,
          parameterId: parameterItem.parameter_id,
        });
      }
    });
    return badges;
  };

  return (
    <div className="grid gap-2">
      {showLabel && (
        <HoverCard openDelay={200}>
          <HoverCardTrigger asChild>
            <Label htmlFor="scenarios">{label}</Label>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            className="w-[260px] text-sm"
            side="left"
          >
            {description}
          </HoverCardContent>
        </HoverCard>
      )}

      {/* Show selected items */}
      {selectedScenarioIds.length > 0 && !hideSelectedChips && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedScenarioIds.map((id) => {
            const scenario = scenarioMapping[id];
            if (!scenario) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm"
              >
                <span>{scenario.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveItem(id, e)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${scenario.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select scenarios"
            className={cn("w-full justify-between", buttonClassName)}
            disabled={disabled}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedScenario?.name || "Scenario selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedScenario?.description || "No description available"}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {peekedScenario && (
                    <>
                      {getScenarioParameterBadges(peekedScenario).map(
                        (badge) => (
                          <TooltipProvider key={badge.parameterId}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs">
                                  {badge.value}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{badge.parameterName}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ),
                      )}
                    </>
                  )}
                </div>
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput
                  placeholder="Search scenarios..."
                  endAdornment={
                    <Popover
                      open={filterPopoverOpen}
                      onOpenChange={setFilterPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Filter by parameters"
                          title="Filter by parameters"
                          className={cn(
                            "relative hover:bg-accent overflow-visible h-8 w-8 p-0",
                            filterPersonaIds.length > 0 ||
                              filterDocumentIds.length > 0 ||
                              filterParameterItemIds.length > 0
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterPopoverOpen((prev) => !prev);
                          }}
                        >
                          <Filter className="h-4 w-4" />
                          {(filterPersonaIds.length > 0 ||
                            filterDocumentIds.length > 0 ||
                            filterParameterItemIds.length > 0) &&
                            !filterPopoverOpen && (
                              <span
                                className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background z-10"
                                aria-label="Active filters"
                              />
                            )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        title="Filter scenarios"
                        className="w-80 max-h-[500px] p-0"
                        align="end"
                        side="top"
                        sideOffset={8}
                      >
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
                                    const checked = filterPersonaIds.includes(
                                      opt.id,
                                    );
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
                                                if (prev.includes(opt.id))
                                                  return prev;
                                                return [...prev, opt.id];
                                              }
                                              return prev.filter(
                                                (x) => x !== opt.id,
                                              );
                                            });
                                          }}
                                        />
                                        <span className="truncate">
                                          {opt.name}
                                        </span>
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
                                    const checked = filterDocumentIds.includes(
                                      opt.id,
                                    );
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
                                                if (prev.includes(opt.id))
                                                  return prev;
                                                return [...prev, opt.id];
                                              }
                                              return prev.filter(
                                                (x) => x !== opt.id,
                                              );
                                            });
                                          }}
                                        />
                                        <span className="truncate">
                                          {opt.name}
                                        </span>
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
                                    const checked =
                                      filterParameterItemIds.includes(opt.id);
                                    return (
                                      <label
                                        key={opt.id}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(isChecked) => {
                                            setFilterParameterItemIds(
                                              (prev) => {
                                                if (isChecked) {
                                                  if (prev.includes(opt.id))
                                                    return prev;
                                                  return [...prev, opt.id];
                                                }
                                                return prev.filter(
                                                  (x) => x !== opt.id,
                                                );
                                              },
                                            );
                                          }}
                                        />
                                        <span className="truncate">
                                          {opt.label}
                                        </span>
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
                              {filterPersonaIds.length +
                                filterDocumentIds.length +
                                filterParameterItemIds.length}{" "}
                              selected
                            </div>
                            <div className="flex gap-2">
                              {(filterPersonaIds.length > 0 ||
                                filterDocumentIds.length > 0 ||
                                filterParameterItemIds.length > 0) && (
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
                  }
                />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedScenarioIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear All
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Scenarios">
                  {filteredScenarios.map((scenario) => (
                    <ScenarioItem
                      key={scenario.id}
                      scenario={scenario as { id: string } & T}
                      isSelected={selectedScenarioIds.includes(scenario.id)}
                      onPeek={(s) => setPeekedScenario(s)}
                      onSelect={() => handleSelect(scenario.id)}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ScenarioItemProps<T extends ScenarioMappingItem> {
  scenario: { id: string } & T;
  isSelected: boolean;
  onSelect: () => void;
  onPeek: (scenario: { id: string } & T) => void;
}

function ScenarioItem<T extends ScenarioMappingItem>({
  scenario,
  isSelected,
  onSelect,
  onPeek,
}: ScenarioItemProps<T>) {
  const ref = React.useRef<HTMLDivElement>(null);

  useMutationObserver(ref, (mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-selected" &&
        ref.current?.getAttribute("aria-selected") === "true"
      ) {
        onPeek(scenario);
      }
    });
  });

  return (
    <CommandItem
      key={scenario.id}
      onSelect={onSelect}
      ref={ref}
      className="group data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Play className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="truncate">{scenario.name}</div>
            <div className="mt-1 text-xs text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
              {scenario.description || "No description available"}
            </div>
          </div>
        </div>
        <Check
          className={cn(
            "ml-auto flex-shrink-0 group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </CommandItem>
  );
}
