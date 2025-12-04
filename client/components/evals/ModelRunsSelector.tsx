/**
 * ModelRunsSelector.tsx
 * Component for selecting model_runs with filters
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type ModelRunsFilters = InputOf<"/api/v3/evals/model_runs", "post">;
type ModelRunsResponse = OutputOf<"/api/v3/evals/model_runs", "post">;

export interface ModelRunsSelectorProps {
  profileId: string;
  selectedModelRunIds: string[];
  onSelect: (modelRunIds: string[]) => void;
  modelMapping?: Record<string, { name: string; description: string }>;
  agentMapping?: Record<string, string>;
  personaMapping?: Record<string, string>;
  agentIds?: string[];
  eval?: boolean;
}

export function ModelRunsSelector({
  profileId,
  selectedModelRunIds,
  onSelect,
  modelMapping = {},
  agentMapping = {},
  personaMapping = {},
  agentIds,
  eval: evalFilter,
}: ModelRunsSelectorProps) {
  const [modelRuns, setModelRuns] = useState<ModelRunsResponse["model_runs"]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Partial<ModelRunsFilters["body"]>>({
    profileId,
    page: 1,
    pageSize: 50,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch model runs when filters change
  useEffect(() => {
    const fetchModelRuns = async () => {
      setLoading(true);
      try {
        const requestBody: ModelRunsFilters["body"] = {
          profileId,
          search: searchQuery || undefined,
          page: filters.page,
          pageSize: filters.pageSize,
          agentType:
            filters.agentType === "all" ? undefined : filters.agentType,
          modelIds: filters.modelIds,
          agentIds: agentIds || filters.agentIds,
          personaIds: filters.personaIds,
          startDate: filters.startDate,
          endDate: filters.endDate,
          eval: evalFilter,
        };
        const response = await api.post("/evals/model_runs", {
          body: requestBody,
        });
        setModelRuns(response.model_runs || []);
        setTotalPages(response.total_pages || 1);
      } catch (error) {
        console.error("Failed to fetch model runs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchModelRuns();
  }, [filters, profileId, searchQuery, agentIds, evalFilter]);

  const handleToggleModelRun = (modelRunId: string) => {
    if (selectedModelRunIds.includes(modelRunId)) {
      onSelect(selectedModelRunIds.filter((id) => id !== modelRunId));
    } else {
      onSelect([...selectedModelRunIds, modelRunId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedModelRunIds.length === modelRuns.length) {
      onSelect([]);
    } else {
      onSelect(modelRuns.map((mr) => mr.model_run_id));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Model Runs</CardTitle>
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex-1 min-w-[200px]">
            <Label>Search</Label>
            <Input
              placeholder="Search model runs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[150px]">
            <Label>Agent Type</Label>
            <Select
              value={filters.agentType || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  agentType: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="persona">Persona</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[150px]">
            <Label>Model</Label>
            <Select
              value={filters.modelIds?.[0] || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  modelIds: value === "all" ? undefined : [value],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All models" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {Object.entries(modelMapping).map(([id, model]) => (
                  <SelectItem key={id} value={id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-2">
          <Badge variant="outline">{selectedModelRunIds.length} selected</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : modelRuns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No model runs found
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedModelRunIds.length === modelRuns.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {modelRuns.map((mr) => (
                <div
                  key={mr.model_run_id}
                  className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                >
                  <Checkbox
                    checked={selectedModelRunIds.includes(mr.model_run_id)}
                    onCheckedChange={() =>
                      handleToggleModelRun(mr.model_run_id)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {mr.model_name && (
                        <Badge variant="outline">{mr.model_name}</Badge>
                      )}
                      {mr.agent_name && (
                        <Badge variant="outline">{mr.agent_name}</Badge>
                      )}
                      {mr.persona_name && (
                        <Badge variant="outline">{mr.persona_name}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(mr.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() =>
                    setFilters({ ...filters, page: (filters.page || 1) - 1 })
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {filters.page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filters.page === totalPages}
                  onClick={() =>
                    setFilters({ ...filters, page: (filters.page || 1) + 1 })
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
