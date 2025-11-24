"use client";

import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ScenarioSearchResult {
  id: string;
  name: string | null;
  problem_statement: string | null;
  persona_id: string | null;
  default_scenario: boolean;
  score: number;
}

export interface SearchExistingScenarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  onStagedScenarios?: (
    scenarios: Array<{
      scenarioId: string;
      name?: string;
      description?: string;
    }>
  ) => void;
  searchScenarioAction?: (input: {
    body: { query: string; limit: number };
  }) => Promise<ScenarioSearchResult[]>;
  existingScenarioIds?: string[]; // IDs already in simulation
}

export default function SearchExistingScenarioModal({
  open,
  onOpenChange,
  onDone,
  onStagedScenarios,
  searchScenarioAction,
  existingScenarioIds = [],
}: SearchExistingScenarioModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedScenarios, setSelectedScenarios] = useState<
    Map<string, ScenarioSearchResult>
  >(new Map());
  const [searchResults, setSearchResults] = useState<ScenarioSearchResult[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search when user types (debounced)
  const handleSearch = useCallback(
    async (query: string) => {
      if (!searchScenarioAction) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const normalizedQuery = query && query.trim() ? query.trim() : null;
        if (!normalizedQuery) {
          setSearchResults([]);
          setIsLoading(false);
          return;
        }
        const results = await searchScenarioAction({
          body: {
            query: normalizedQuery,
            limit: 200,
          },
        });
        // Filter out already existing scenarios
        const filtered = results.filter(
          (r) => !existingScenarioIds.includes(r.id)
        );
        setSearchResults(filtered);
      } catch {
        toast.error("Failed to search scenarios");
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchScenarioAction, existingScenarioIds]
  );

  // Handle search input change with debounce
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (value === "") {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    },
    [handleSearch]
  );

  // Reset state when modal closes or opens
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedScenarioIds(new Set());
      setSelectedScenarios(new Map());
      setSearchResults([]);
      setIsLoading(false);
    }
  }, [open]);

  // Toggle scenario selection
  const handleToggleScenario = useCallback((scenario: ScenarioSearchResult) => {
    const scenarioId = scenario.id;
    setSelectedScenarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(scenarioId)) {
        next.delete(scenarioId);
        setSelectedScenarios((prevScenarios) => {
          const nextScenarios = new Map(prevScenarios);
          nextScenarios.delete(scenarioId);
          return nextScenarios;
        });
      } else {
        next.add(scenarioId);
        setSelectedScenarios((prevScenarios) => {
          const nextScenarios = new Map(prevScenarios);
          nextScenarios.set(scenarioId, scenario);
          return nextScenarios;
        });
      }
      return next;
    });
  }, []);

  // Handle submitting all selected scenarios
  const handleSubmit = useCallback(async () => {
    if (selectedScenarioIds.size === 0) {
      toast.error("Please select at least one scenario.");
      return;
    }

    const selectedScenariosArray = Array.from(selectedScenarios.values());

    if (selectedScenariosArray.length === 0) {
      toast.error("No scenarios selected.");
      return;
    }

    try {
      const scenarioData = selectedScenariosArray.map((scenario) => {
        const result: {
          scenarioId: string;
          name?: string;
          description?: string;
        } = {
          scenarioId: scenario.id,
        };
        if (scenario.name) result.name = scenario.name;
        if (scenario.problem_statement)
          result.description = scenario.problem_statement;
        return result;
      });

      if (onStagedScenarios) {
        onStagedScenarios(scenarioData);
        toast.success(
          `${selectedScenariosArray.length} scenario(s) staged. They will be added when you click Update.`
        );
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stage scenarios.";
      toast.error(errorMessage);
    }
  }, [
    selectedScenarioIds,
    selectedScenarios,
    onStagedScenarios,
    onOpenChange,
    onDone,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Existing Scenarios</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or problem statement"
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading scenarios...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery && searchQuery.trim()
                  ? "No scenarios found matching your search"
                  : "Start typing to search for scenarios"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((scenario) => {
                    const isSelected = selectedScenarioIds.has(scenario.id);
                    return (
                      <TableRow
                        key={scenario.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleToggleScenario(scenario)}
                      >
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="w-[50px]"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              handleToggleScenario(scenario)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {scenario.name || "Unnamed Scenario"}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {scenario.problem_statement || "No description"}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(selectedScenarios.values()).map((scenario) => (
                <Badge
                  key={scenario.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <span>{scenario.name || "Unnamed Scenario"}</span>
                  <button
                    onClick={() => handleToggleScenario(scenario)}
                    className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                    aria-label={`Remove ${scenario.name || "scenario"}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {selectedScenarioIds.size > 0 && (
                <Button onClick={handleSubmit}>
                  Add {selectedScenarioIds.size} Scenario
                  {selectedScenarioIds.size !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
