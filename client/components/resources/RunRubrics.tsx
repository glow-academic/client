/**
 * RunRubrics.tsx
 * Resource component for assigning rubrics to a run
 * Uses SelectableGrid for multi-select rubrics per run
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface RunRubricOption {
  rubric_id: string | null;
  name: string | null;
  description?: string | null;
  agent_role?: string | null;
  generated?: boolean | null;
}

export interface RunRubricsProps {
  run_id: string;
  run_name?: string | null;
  run_description?: string | null;
  show_rubrics?: boolean;
  rubrics?: RunRubricOption[];
  disabled?: boolean;
  required?: boolean;
  selected_rubric_ids?: string[];
  onChange: (runId: string, rubricIds: string[]) => void;
}

export function RunRubrics({
  run_id,
  run_name,
  run_description,
  show_rubrics = false,
  rubrics = [],
  disabled = false,
  required = false,
  selected_rubric_ids,
  onChange,
}: RunRubricsProps) {
  const selectedIds = useMemo(() => selected_rubric_ids ?? [], [
    selected_rubric_ids,
  ]);

  const filteredRubrics = useMemo(
    () => rubrics.filter((rubric) => rubric.rubric_id && rubric.name),
    [rubrics]
  );

  const handleSelect = useCallback(
    (rubricId: string) => {
      const nextSelection = selectedIds.includes(rubricId)
        ? selectedIds.filter((id) => id !== rubricId)
        : [...selectedIds, rubricId];
      onChange(run_id, nextSelection);
    },
    [onChange, run_id, selectedIds]
  );

  if (!show_rubrics) {
    return null;
  }

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            Rubrics for {run_name ?? "run"}
          </Label>
          {required && <span className="text-destructive">*</span>}
          {selectedIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
          )}
        </div>
        {run_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {run_description}
          </p>
        )}
      </div>
      <SelectableGrid
        horizontal
        items={filteredRubrics}
        selectedId={null}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        getId={(item) => item.rubric_id ?? ""}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "w-full rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-muted/60 hover:border-muted-foreground/50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {item.name}
                  </span>
                  {item.agent_role && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {item.agent_role}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted"
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </div>
            </div>
          </div>
        )}
        emptyMessage="No rubrics available."
        disabled={disabled}
      />
    </div>
  );
}
