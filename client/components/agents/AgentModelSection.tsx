/**
 * AgentModelSection.tsx
 * Model selection section component for Agent
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";
import * as React from "react";

type StepStatus = "pending" | "active" | "completed";

type ModelMappingItem = {
  id: string;
  name: string;
  description?: string;
};

export interface AgentModelSectionProps {
  // Data
  modelId: string;
  modelMapping: Record<string, ModelMappingItem>;
  validModelIds: string[];
  filteredValidModelIds: string[];

  // Callbacks
  onModelChange: (modelId: string) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  errors?: {
    modelId?: string;
  };
  role?: string | undefined;
}

export function AgentModelSection({
  modelId,
  modelMapping,
  validModelIds: _validModelIds,
  filteredValidModelIds,
  onModelChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  errors,
  role,
}: AgentModelSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Build models from mapping
  const baseModels = React.useMemo(() => {
    const models = filteredValidModelIds.map((id) => ({
      id,
      ...modelMapping[id],
    }));

    // Sort by name
    return models.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [filteredValidModelIds, modelMapping]);

  // Apply search filter, then sort selected first
  const filteredModels = React.useMemo(() => {
    let filtered = baseModels;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (model) =>
          model.name?.toLowerCase().includes(searchLower) ||
          model.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort: selected model first, then by name
    return filtered.sort((a, b) => {
      if (a.id === modelId) return -1;
      if (b.id === modelId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [baseModels, searchTerm, modelId]);

  const handleSelect = (selectedModelId: string) => {
    if (isReadonly) return;
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/c8b3b631-8d97-43e2-acb2-6df2c63b5121", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "AgentModelSection.tsx:99",
        message: "handleSelect called",
        data: {
          selectedModelId,
          currentModelId: modelId,
          willDeselect: selectedModelId === modelId,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    // Allow unselecting by clicking the same model again
    if (selectedModelId === modelId) {
      onModelChange("");
    } else {
      onModelChange(selectedModelId);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {filteredValidModelIds.length === 0 && role ? (
            <p className="text-xs text-muted-foreground">
              No models available for this agent type. Please select a different
              role or configure models with the required modalities.
            </p>
          ) : (
            <>
              {/* Search Bar */}
              <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
                <Search className="size-4 shrink-0 opacity-50" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isReadonly}
                />
              </div>

              {/* Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
                {filteredModels.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No models found. Try adjusting your search.
                  </div>
                ) : (
                  filteredModels.map((model) => {
                    const isSelected = model.id === modelId;

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelect(model.id)}
                        disabled={isReadonly}
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
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm leading-tight">
                              {model.name || "Unnamed Model"}
                            </h3>
                            {model.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {model.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {errors?.modelId && (
                <p className="text-sm text-destructive">{errors.modelId}</p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
