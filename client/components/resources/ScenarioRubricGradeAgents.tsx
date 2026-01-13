/**
 * ScenarioRubricGradeAgents.tsx
 * Resource component for scenario rubric grade agent selection
 * Uses GenericPicker to select existing scenario rubric grade agent resources
 * Manages scenario_rubric_grade_agent_ids array and reports to parent
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

type CreateDraftScenarioRubricGradeAgentsIn = InputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
  "post"
>;
type CreateDraftScenarioRubricGradeAgentsOut = OutputOf<
  "/api/v4/resources/scenario_rubric_grade_agents",
  "post"
>;

export interface ScenarioRubricGradeAgentItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenarioRubricGradeAgentsProps {
  scenario_rubric_grade_agent_ids?: string[]; // Current scenario rubric grade agent resource IDs (standardized prop name)
  scenario_rubric_grade_agent_resources?: Array<{
    id: string | null;
    rubric_id: string | null;
    grade_agent_id: string | null;
    agent_id: string | null;
    generated?: boolean | null;
  }>; // Selected scenario rubric grade agent resources (each includes generated field)
  show_scenario_rubric_grade_agents?: boolean; // Whether to show this resource picker
  scenario_rubric_grade_agent_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenario_rubric_grade_agents?: Array<{
    id: string | null;
    rubric_id: string | null;
    grade_agent_id: string | null;
    agent_id: string | null;
    generated?: boolean | null;
  }>; // All available scenario rubric grade agents from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_rubric_grade_agent_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenarioRubricGradeAgentsAction?:
    | ((
        input: CreateDraftScenarioRubricGradeAgentsIn
      ) => Promise<CreateDraftScenarioRubricGradeAgentsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ScenarioRubricGradeAgents({
  scenario_rubric_grade_agent_ids,
  scenario_rubric_grade_agent_resources,
  show_scenario_rubric_grade_agents = false,
  scenario_rubric_grade_agent_suggestions,
  scenario_rubric_grade_agents,
  disabled = false,
  onChange,
  label = "Scenario Rubric Grade Agents",
  id = "scenario_rubric_grade_agents",
  required = false,
  placeholder = "Select scenario rubric grade agents...",
  description,
  group_id,
  agent_id,
  createScenarioRubricGradeAgentsAction,
  onGenerate,
  isGenerating = false,
}: ScenarioRubricGradeAgentsProps) {
  const ids = useMemo(
    () => scenario_rubric_grade_agent_ids ?? [],
    [scenario_rubric_grade_agent_ids]
  );
  const show = show_scenario_rubric_grade_agents ?? false;
  const allAgents = useMemo(
    () => scenario_rubric_grade_agents ?? [],
    [scenario_rubric_grade_agents]
  );
  const suggestionsList = useMemo(
    () => scenario_rubric_grade_agent_suggestions ?? [],
    [scenario_rubric_grade_agent_suggestions]
  );

  // Track which agent IDs have already had resources created
  const createdAgentIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdAgentIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdAgentIdsRef.current.add(id));
  }, [ids]);

  // Convert agents array to ScenarioRubricGradeAgentItem format for GenericPicker
  // Note: We'll need to look up rubric and agent names from IDs
  const agentItems = useMemo(() => {
    return allAgents
      .filter((a) => a.id && a.rubric_id && a.grade_agent_id) // Filter out nulls
      .map((a) => ({
        id: a.id!,
        name: `Rubric ${a.rubric_id?.substring(0, 8)}... / Agent ${a.grade_agent_id?.substring(0, 8)}...`, // Placeholder - should look up actual names
        description: `Rubric ID: ${a.rubric_id}, Grade Agent ID: ${a.grade_agent_id}`,
      }));
  }, [allAgents]);

  // Check if an agent is suggested
  const isSuggested = useCallback(
    (agentId: string) => suggestionsList.includes(agentId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdAgentIdsRef.current.has(id)
      );

      // Create resources for newly selected agents
      if (
        newlySelected.length > 0 &&
        createScenarioRubricGradeAgentsAction &&
        agent_id &&
        group_id
      ) {
        for (const agentResourceId of newlySelected) {
          try {
            // Find the agent resource to get rubric_id and grade_agent_id
            const agentResource = allAgents.find(
              (a) => a.id === agentResourceId
            );
            if (
              agentResource?.rubric_id &&
              agentResource?.grade_agent_id &&
              agentResource?.agent_id
            ) {
              await createScenarioRubricGradeAgentsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  rubric_id: agentResource.rubric_id,
                  grade_agent_id: agentResource.grade_agent_id,
                  agent_id_param: agentResource.agent_id,
                  mcp: false,
                },
              });
              createdAgentIdsRef.current.add(agentResourceId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create scenario rubric grade agent resource for ${agentResourceId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [
      ids,
      onChange,
      createScenarioRubricGradeAgentsAction,
      agent_id,
      group_id,
      allAgents,
    ]
  );

  // Check if any agent resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return (
      scenario_rubric_grade_agent_resources?.some((a) => a.generated) ?? false
    );
  }, [scenario_rubric_grade_agent_resources]);

  // Don't render if show_scenario_rubric_grade_agents is false (AFTER all hooks)
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
          {onGenerate && agent_id && (
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
      <GenericPicker<ScenarioRubricGradeAgentItem>
        items={agentItems}
        itemIds={allAgents
          .map((a) => a.id)
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
