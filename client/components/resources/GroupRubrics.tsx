/**
 * GroupRubrics.tsx
 * Resource component for assigning rubrics to a group
 * Uses SelectableGrid for multi-select rubrics per group
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface GroupRubricOption {
  rubric_id: string | null;
  name: string | null;
  description?: string | null;
  agent_role?: string | null;
  generated?: boolean | null;
}

export interface GroupRubricsProps {
  group_id: string;
  group_name?: string | null;
  group_description?: string | null;
  show_rubrics?: boolean;
  rubrics?: GroupRubricOption[];
  disabled?: boolean;
  required?: boolean;
  selected_rubric_ids?: string[];
  onChange: (groupId: string, rubricIds: string[]) => void;
}

export function GroupRubrics({
  group_id,
  group_name,
  group_description,
  show_rubrics = false,
  rubrics = [],
  disabled = false,
  required = false,
  selected_rubric_ids,
  onChange,
}: GroupRubricsProps) {
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
      onChange(group_id, nextSelection);
    },
    [onChange, group_id, selectedIds]
  );

  if (!show_rubrics) {
    return null;
  }

  return (
    <div className="space-y-2 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">
            Rubrics for {group_name ?? "group"}
          </Label>
          {required && <span className="text-destructive">*</span>}
          {selectedIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
          )}
        </div>
        {group_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {group_description}
          </p>
        )}
      </div>
      <SelectableGrid
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
