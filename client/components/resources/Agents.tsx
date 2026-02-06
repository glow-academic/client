/**
 * Agents.tsx
 * Resource component for agent selection
 * Uses GenericPicker to select existing agent artifacts
 * Manages agent_ids array and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftAgentsIn = InputOf<"/api/v4/resources/agents", "post">;
type CreateDraftAgentsOut = OutputOf<"/api/v4/resources/agents", "post">;

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
}

export interface AgentsProps {
  agent_ids?: string[]; // Current agent resource IDs (standardized prop name)
  agent_resources?: Array<{
    agent_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // Selected agent resources (each includes generated field)
  show_agents?: boolean; // Whether to show this resource picker
  agent_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  agents?: Array<{
    agent_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>; // All available agents from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update agent_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Agents({
  agent_ids,
  agent_resources,
  show_agents = false,
  agent_suggestions,
  agents,
  disabled = false,
  onChange,
  label = "Agents",
  id = "agents",
  required = false,
  placeholder = "Select agents...",
  description,
  group_id,
  link_tool_id,
  onGenerate,
  isGenerating = false,
}: AgentsProps) {
  const ids = useMemo(() => agent_ids ?? [], [agent_ids]);
  const show = show_agents ?? false;
  const allAgents = useMemo(() => agents ?? [], [agents]);
  const suggestionsList = useMemo(
    () => agent_suggestions ?? [],
    [agent_suggestions]
  );

  // Track which agent IDs have already had resources created
  const createdAgentIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdAgentIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdAgentIdsRef.current.add(id));
  }, [ids]);

  // Convert agents array to AgentItem format for GenericPicker
  const agentItems = useMemo(() => {
    return allAgents
      .filter((a) => a.agent_id && a.name) // Filter out nulls
      .map((a) => ({
        id: a.agent_id!,
        name: a.name!,
        ...(a.description ? { description: a.description } : {}),
      }));
  }, [allAgents]);

  // Check if an agent is suggested
  const isSuggested = useCallback(
    (agentId: string) => suggestionsList.includes(agentId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      // Update parent state
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any agent resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return agent_resources?.some((a) => a.generated) ?? false;
  }, [agent_resources]);

  // Don't render if show_agents is false (AFTER all hooks)
  if (!show) {
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
          {onGenerate && link_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
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
        </div>
      )}
      <GenericPicker<AgentItem>
        items={agentItems}
        itemIds={allAgents
          .map((a) => a.agent_id)
          .filter((id): id is string => id !== null)} // All agent IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
