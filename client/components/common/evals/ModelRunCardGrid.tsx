"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Play, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";

type EvalNewIn = InputOf<"/api/v4/evals/new", "post">;
type EvalNewOut = OutputOf<"/api/v4/evals/new", "post">;
type EvalDetailIn = InputOf<"/api/v4/evals/detail", "post">;
type EvalDetailOut = OutputOf<"/api/v4/evals/detail", "post">;

export interface ModelRunCardGridProps {
  profileId: string;
  selectedModelRunIds: string[];
  onSelect: (ids: string[]) => void;
  agentIds?: string[]; // Optional - no longer used for filtering, kept for backward compatibility
  readonly?: boolean;
  evalId?: string; // Optional - if provided, use /evals/detail, otherwise use /evals/new
}

export function ModelRunCardGrid({
  profileId,
  selectedModelRunIds,
  onSelect,
  agentIds,
  readonly = false,
  evalId,
}: ModelRunCardGridProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [modelRuns, setModelRuns] = React.useState<
    EvalNewOut["available_model_runs"] | EvalDetailOut["available_model_runs"]
  >([]);
  const [loading, setLoading] = React.useState(false);

  // Fetch model runs when filters change
  React.useEffect(() => {
    const fetchModelRuns = async () => {
      setLoading(true);
      try {
        // Use /evals/detail if evalId provided, otherwise /evals/new
        if (evalId) {
          const requestBody: EvalDetailIn["body"] = {
            evalId,
            available_model_runs_search: searchTerm || null,
            available_model_runs_agent_ids: null, // No longer filtering by agents
            available_model_runs_page: 1,
            available_model_runs_page_size: 50,
          };
          const response = await api.post("/evals/detail", {
            body: requestBody,
          });
          const typedResponse = response as EvalDetailOut;
          setModelRuns(typedResponse.available_model_runs || []);
        } else {
          const requestBody: EvalNewIn["body"] = {
            available_model_runs_search: searchTerm || null,
            available_model_runs_agent_ids: null, // No longer filtering by agents
            available_model_runs_page: 1,
            available_model_runs_page_size: 50,
          };
          const response = await api.post("/evals/new", {
            body: requestBody,
          });
          const typedResponse = response as EvalNewOut;
          setModelRuns(typedResponse.available_model_runs || []);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch model runs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModelRuns();
  }, [profileId, searchTerm, agentIds, evalId]);

  // Apply search filter and sort selected first
  const filteredModelRuns = React.useMemo(() => {
    // Search is handled server-side, but we can also filter client-side for selected items
    return modelRuns.sort((a, b) => {
      const aSelected = selectedModelRunIds.includes(a.model_run_id);
      const bSelected = selectedModelRunIds.includes(b.model_run_id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      // Both selected or both unselected - sort by created_at desc
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [modelRuns, selectedModelRunIds]);

  const handleSelect = (modelRunId: string) => {
    if (readonly) return;
    const isSelected = selectedModelRunIds.includes(modelRunId);
    const newIds = isSelected
      ? selectedModelRunIds.filter((id) => id !== modelRunId)
      : [...selectedModelRunIds, modelRunId];
    onSelect(newIds);
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search model runs..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={readonly}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
              {filteredModelRuns.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No model runs found. Try adjusting your search or filters.
                </div>
              ) : (
                filteredModelRuns.map((mr) => {
                  const isSelected = selectedModelRunIds.includes(
                    mr.model_run_id,
                  );

                  return (
                    <Tooltip key={mr.model_run_id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleSelect(mr.model_run_id)}
                          disabled={readonly}
                          className={cn(
                            "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                            "hover:shadow-md hover:bg-accent/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            "disabled:pointer-events-none disabled:opacity-50",
                            isSelected && "ring-2 ring-primary bg-accent",
                          )}
                        >
                          {/* Check icon - top right */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-3.5 w-3.5 text-primary-foreground" />
                            </div>
                          )}

                          <div className="flex items-start gap-3">
                            <Play className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-1 mb-2">
                                {mr.model_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {mr.model_name}
                                  </Badge>
                                )}
                                {mr.agent_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {mr.agent_name}
                                  </Badge>
                                )}
                                {mr.persona_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {mr.persona_name}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(mr.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      </TooltipTrigger>
                    </Tooltip>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
