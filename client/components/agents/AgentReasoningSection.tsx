/**
 * AgentReasoningSection.tsx
 * Reasoning effort configuration section component for Agent
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
import { useMemo, useState } from "react";

type StepStatus = "pending" | "active" | "completed";

type ReasoningMappingItem = {
  id: string;
  name: string;
  description?: string;
};

export interface AgentReasoningSectionProps {
  // Data
  model_reasoning_level_id: string | null;
  reasoning: "none" | "minimal" | "low" | "medium" | "high";
  reasoningMapping: Record<string, ReasoningMappingItem>;
  reasoningOptions: Array<{
    id: string;
    reasoning_level: string;
  }>;

  // Callbacks
  onReasoningChange: (
    reasoningLevel: string | null,
    optionId: string | null,
  ) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function AgentReasoningSection({
  model_reasoning_level_id,
  reasoning,
  reasoningMapping,
  reasoningOptions,
  onReasoningChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: AgentReasoningSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Helper to get reasoning option ID from reasoning level value
  const getReasoningOptionId = (reasoningLevel: string): string | null => {
    const mapping = new Map<string, string>();
    reasoningOptions.forEach((opt) => {
      if (opt.id && opt.reasoning_level) {
        mapping.set(opt.reasoning_level, opt.id);
      }
    });
    return mapping.get(reasoningLevel) || null;
  };

  // Helper to get reasoning level value from option ID
  const getReasoningLevelFromId = (optionId: string): string => {
    const mapping = new Map<string, string>();
    reasoningOptions.forEach((opt) => {
      if (opt.id && opt.reasoning_level) {
        mapping.set(opt.id, opt.reasoning_level);
      }
    });
    return mapping.get(optionId) || "none";
  };

  const selectedReasoningLevel: string | null = model_reasoning_level_id
    ? getReasoningLevelFromId(model_reasoning_level_id)
    : reasoning || "none";

  const availableReasoningLevels =
    reasoningOptions &&
    Array.isArray(reasoningOptions) &&
    reasoningOptions.length > 0
      ? reasoningOptions.map((opt) => opt.reasoning_level)
      : ["none", "minimal", "low", "medium", "high"];

  // Filter reasoning levels based on search term
  const filteredReasoningLevels = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableReasoningLevels;
    }
    const searchLower = searchTerm.toLowerCase();
    return availableReasoningLevels.filter((level) => {
      const mappingItem = reasoningMapping[level];
      if (!mappingItem) return false;
      const searchText =
        `${mappingItem.name} ${mappingItem.description || ""}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [availableReasoningLevels, reasoningMapping, searchTerm]);

  const handleReasoningSelect = (reasoningLevel: string) => {
    if (isReadonly) return;
    // Toggle behavior: if already selected, unselect (pass null)
    const newLevel =
      selectedReasoningLevel === reasoningLevel ? null : reasoningLevel;
    const optionId = newLevel ? getReasoningOptionId(newLevel) : null;
    onReasoningChange(newLevel, optionId);
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
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
                  : "bg-muted",
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
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search reasoning effort..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Filtered reasoning levels grid */}
        <div className="grid grid-cols-4 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredReasoningLevels.map((level) => {
            const mappingItem = reasoningMapping[level];
            if (!mappingItem) return null;

            const isSelected =
              selectedReasoningLevel !== null &&
              selectedReasoningLevel === level;

            return (
              <button
                key={level}
                type="button"
                onClick={() => handleReasoningSelect(level)}
                disabled={isReadonly}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                  "hover:shadow-md hover:bg-accent/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isSelected && "ring-2 ring-primary bg-accent",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {mappingItem.name}
                    </div>
                    {mappingItem.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {mappingItem.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
