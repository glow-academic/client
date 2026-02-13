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
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftAgentsIn = InputOf<"/api/v4/resources/agents", "post">;
type CreateDraftAgentsOut = OutputOf<"/api/v4/resources/agents", "post">;

// Derive resource item type from the GET endpoint response
type AgentsGetResponse = OutputOf<"/api/v4/resources/agents/get", "post">;
export type AgentResourceItem = NonNullable<AgentsGetResponse["items"]>[number];

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
}

export interface AgentsProps {
  agent_ids?: string[]; // Current agent resource IDs (standardized prop name)
  agent_resources?: AgentResourceItem[]; // Selected agent resources (each includes generated field)
  show_agents?: boolean; // Whether to show this resource picker
  agent_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  agents?: AgentResourceItem[]; // All available agents from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update agent_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiAgentResources?: Array<Pick<AgentResourceItem, "id" | "name">> | null;
  onAccept?: () => void;
  onReject?: () => void;
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
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  // AI diff view props
  aiAgentResources,
  onAccept,
  onReject,
}: AgentsProps) {
  const ids = useMemo(() => agent_ids ?? [], [agent_ids]);
  const show = show_agents ?? false;
  const allAgents = useMemo(() => agents ?? [], [agents]);
  const suggestionsList = useMemo(
    () => agent_suggestions ?? [],
    [agent_suggestions]
  );

  // AI suggestion state
  const showDiff = !!aiAgentResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiAgentResources
          ?.map((a) => a.id)
          .filter(Boolean) as string[]
      ),
    [aiAgentResources]
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
      .filter((a) => a.id && a.name) // Filter out nulls
      .map((a) => ({
        id: a.id!,
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

  // Accept AI suggestion - add AI-suggested agents to selection
  const handleAccept = useCallback(() => {
    if (!aiAgentResources?.length) return;
    const newIds = aiAgentResources
      .map((a) => a.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiAgentResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

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
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
      <GenericPicker<AgentItem>
        items={agentItems}
        itemIds={allAgents
          .map((a) => a.id)
          .filter((id): id is string => id !== null)} // All agent IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div className={cn(
              "flex items-center justify-between w-full",
              isAiSuggested && !isSelected && "bg-success/10 -mx-2 px-2 -my-1 py-1 rounded ring-1 ring-success"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAiSuggested && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-success/20 text-success text-xs rounded shrink-0 font-medium">
                    AI Suggested
                  </span>
                )}
                {isSuggested(item.id) && !isSelected && !isAiSuggested && (
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
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
