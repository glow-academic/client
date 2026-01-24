/**
 * ParameterFields.tsx
 * Resource component for general parameter field selection
 * Uses SelectableGrid for field selection with search/filter support
 * Manages parameter_field_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Label } from "@/components/ui/label";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftParameterFieldsIn = InputOf<"/api/v4/resources/parameter_fields", "post">;
type CreateDraftParameterFieldsOut = OutputOf<"/api/v4/resources/parameter_fields", "post">;

export interface ParameterFieldItem {
  id: string;
  name: string;
  description?: string;
}

export interface ParameterFieldsProps {
  field_ids?: string[];
  field_resources?: Array<{
    field_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  show_fields?: boolean;
  fields?: Array<{
    field_id: string | null;
    name: string | null;
    description?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createParameterFieldsAction?:
    | ((input: CreateDraftParameterFieldsIn) => Promise<CreateDraftParameterFieldsOut>)
    | undefined;
}

export function ParameterFields({
  field_ids,
  field_resources: _field_resources,
  show_fields = false,
  fields,
  disabled = false,
  onChange,
  label = "Parameter Fields",
  id = "parameter_fields",
  required = false,
  description,
  group_id,
  agent_id,
  createParameterFieldsAction,
}: ParameterFieldsProps) {
  const ids = useMemo(() => field_ids ?? [], [field_ids]);
  const show = show_fields ?? false;
  const allFieldsMemo = useMemo(() => fields ?? [], [fields]);

  const createdFieldIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ids.forEach((id) => createdFieldIdsRef.current.add(id));
  }, [ids]);

  const fieldItems = useMemo(() => {
    return allFieldsMemo
      .filter((f) => f.field_id && f.name)
      .map((f) => ({
        id: f.field_id!,
        name: f.name!,
        ...(f.description && { description: f.description }),
      }));
  }, [allFieldsMemo]);

  const handleSelect = useCallback(
    async (fieldId: string) => {
      const isSelected = ids.includes(fieldId);
      let newIds: string[];

      if (isSelected) {
        newIds = ids.filter((id) => id !== fieldId);
        createdFieldIdsRef.current.delete(fieldId);
      } else {
        newIds = [...ids, fieldId];

        if (
          !createdFieldIdsRef.current.has(fieldId) &&
          createParameterFieldsAction &&
          agent_id &&
          group_id
        ) {
          try {
            await createParameterFieldsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                field_id: fieldId,
                mcp: false,
              },
            });
            createdFieldIdsRef.current.add(fieldId);
          } catch (error) {
            console.error(
              `Failed to create parameter field resource for ${fieldId}:`,
              error
            );
          }
        }
      }

      onChange(newIds);
    },
    [ids, onChange, createParameterFieldsAction, agent_id, group_id]
  );

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="flex items-center gap-1">
          {label}
          {required && <span className="text-destructive">*</span>}
          {description && (
            <span className="text-xs text-muted-foreground ml-2">
              {description}
            </span>
          )}
        </Label>
      )}
      <SelectableGrid<ParameterFieldItem>
        items={fieldItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={handleSelect}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => (
          <div
            className={cn(
              "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
              "hover:shadow-md hover:bg-accent/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected && "ring-2 ring-primary bg-accent"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )}
        emptyMessage="No parameter fields found."
        disabled={disabled}
      />
    </div>
  );
}
