/**
 * ScenarioRubrics.tsx
 * Resource component for scenario rubric selection
 * Uses GenericPicker to select existing scenario rubric resources
 * Manages scenario_rubric_ids array and reports to parent
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

type CreateDraftScenarioRubricsIn = InputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;
type CreateDraftScenarioRubricsOut = OutputOf<
  "/api/v4/resources/scenario_rubrics",
  "post"
>;

export interface ScenarioRubricItem {
  id: string;
  name: string;
  description?: string;
}

export interface ScenarioRubricsProps {
  scenario_rubric_ids?: string[]; // Current scenario rubric resource IDs
  scenario_rubric_resources?: Array<{
    id: string | null;
    scenario_id: string | null;
    rubric_id: string | null;
    generated?: boolean | null;
  }>; // Selected scenario rubric resources
  show_scenario_rubrics?: boolean; // Whether to show this resource picker
  scenario_rubric_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  scenario_rubrics?: Array<{
    id: string | null;
    scenario_id: string | null;
    rubric_id: string | null;
    generated?: boolean | null;
  }>; // All available scenario rubrics from API
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update scenario_rubric_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createScenarioRubricsAction?:
    | ((
        input: CreateDraftScenarioRubricsIn
      ) => Promise<CreateDraftScenarioRubricsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function ScenarioRubrics({
  scenario_rubric_ids,
  scenario_rubric_resources,
  show_scenario_rubrics = false,
  scenario_rubric_suggestions,
  scenario_rubrics,
  disabled = false,
  onChange,
  label = "Scenario Rubrics",
  id = "scenario_rubrics",
  required = false,
  placeholder = "Select scenario rubrics...",
  description,
  group_id,
  agent_id,
  createScenarioRubricsAction,
  onGenerate,
  isGenerating = false,
}: ScenarioRubricsProps) {
  const ids = useMemo(() => scenario_rubric_ids ?? [], [scenario_rubric_ids]);
  const show = show_scenario_rubrics ?? false;
  const allScenarioRubrics = useMemo(
    () => scenario_rubrics ?? [],
    [scenario_rubrics]
  );
  const suggestionsList = useMemo(
    () => scenario_rubric_suggestions ?? [],
    [scenario_rubric_suggestions]
  );

  const createdScenarioRubricIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ids.forEach((id) => createdScenarioRubricIdsRef.current.add(id));
  }, [ids]);

  const scenarioRubricItems = useMemo(() => {
    return allScenarioRubrics
      .filter((r) => r.id && r.scenario_id && r.rubric_id)
      .map((r) => ({
        id: r.id!,
        name: `Scenario ${r.scenario_id?.slice(0, 8)}... / Rubric ${r.rubric_id?.slice(0, 8)}...`,
        description: `Scenario ID: ${r.scenario_id}, Rubric ID: ${r.rubric_id}`,
      }));
  }, [allScenarioRubrics]);

  const isSuggested = useCallback(
    (scenarioRubricId: string) => suggestionsList.includes(scenarioRubricId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      const newlySelected = selectedIds.filter(
        (id) =>
          !ids.includes(id) && !createdScenarioRubricIdsRef.current.has(id)
      );

      if (
        newlySelected.length > 0 &&
        createScenarioRubricsAction &&
        agent_id &&
        group_id
      ) {
        for (const scenarioRubricId of newlySelected) {
          try {
            const resource = allScenarioRubrics.find(
              (r) => r.id === scenarioRubricId
            );
            if (resource?.scenario_id && resource?.rubric_id) {
              await createScenarioRubricsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  scenario_id: resource.scenario_id,
                  rubric_id: resource.rubric_id,
                  mcp: false,
                },
              });
              createdScenarioRubricIdsRef.current.add(scenarioRubricId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create scenario rubric resource for ${scenarioRubricId}:`,
              error
            );
          }
        }
      }

      onChange(selectedIds);
    },
    [
      ids,
      onChange,
      createScenarioRubricsAction,
      agent_id,
      group_id,
      allScenarioRubrics,
    ]
  );

  const hasGenerated = useMemo(() => {
    return scenario_rubric_resources?.some((r) => r.generated) ?? false;
  }, [scenario_rubric_resources]);

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
                  <p>Generate scenario rubrics</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasGenerated && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Check className="h-4 w-4 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generated by AI</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      <GenericPicker<ScenarioRubricItem>
        items={scenarioRubricItems}
        selectedIds={ids}
        onSelect={handleSelect}
        placeholder={placeholder}
        disabled={disabled}
        isSuggested={isSuggested}
        className={cn("w-full")}
      />
    </div>
  );
}
