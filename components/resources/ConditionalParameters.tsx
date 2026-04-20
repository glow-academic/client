"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ConditionalParametersResourceItem {
  parameter_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

interface ConditionalParameterItem {
  id: string;
  name: string;
  description?: string;
}

export interface ConditionalParametersProps {
  conditional_parameter_ids?: string[];
  conditional_parameter_resources?: ConditionalParametersResourceItem[];
  show_conditional_parameters?: boolean;
  conditional_parameters?: ConditionalParametersResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  required?: boolean;
}

export function ConditionalParameters({
  conditional_parameter_ids,
  conditional_parameter_resources: _conditional_parameter_resources,
  show_conditional_parameters = false,
  conditional_parameters,
  disabled = false,
  onChange,
  label = "Conditional Parameters",
  required = false,
}: ConditionalParametersProps) {
  const ids = useMemo(
    () => conditional_parameter_ids ?? [],
    [conditional_parameter_ids],
  );
  const show = show_conditional_parameters ?? false;
  const allItems = useMemo(
    () => conditional_parameters ?? [],
    [conditional_parameters],
  );

  const pendingItems = useMemo(
    () => allItems.filter((item) => item.pending && item.parameter_id),
    [allItems],
  );
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((item) => item.parameter_id).filter(Boolean) as string[]),
    [pendingItems],
  );
  const showDiff = pendingItems.length > 0;

  const items = useMemo<ConditionalParameterItem[]>(
    () =>
      allItems
        .filter((item) => item.parameter_id && item.name)
        .map((item) => ({
          id: item.parameter_id!,
          name: item.name!,
          ...(item.description ? { description: item.description } : {}),
        })),
    [allItems],
  );

  const isSuggested = useCallback(
    (itemId: string) => {
      const item = allItems.find((entry) => entry.parameter_id === itemId);
      return item?.suggested === true;
    },
    [allItems],
  );

  const handleAccept = useCallback(() => {
    // Pending items are already selected; the next draft save confirms them.
  }, []);

  const handleReject = useCallback(() => {
    onChange(ids.filter((id) => !pendingIds.has(id)));
  }, [ids, onChange, pendingIds]);

  if (!show) {
    return null;
  }

  return (
    <div className="min-w-0 w-full space-y-4">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
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

      <SelectableGrid<ConditionalParameterItem>
        items={items}
        selectedId={null}
        selectedIds={ids}
        onSelect={(itemId) => {
          const nextIds = ids.includes(itemId)
            ? ids.filter((id) => id !== itemId)
            : [...ids, itemId];
          onChange(nextIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex h-[88px] flex-col overflow-hidden rounded-xl border bg-card p-3 text-left text-card-foreground shadow-sm transition-all",
                "hover:bg-accent/50 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && !isPending && "bg-accent ring-2 ring-primary",
                isPending && "bg-success/10 ring-2 ring-success",
              )}
            >
              {isSelected && !isPending && (
                <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}

              {isPending && (
                <div className="absolute right-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-medium text-success bg-success/20">
                  Pending
                </div>
              )}

              {isSuggested(item.id) && !isSelected && !isPending && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute right-2 top-2 z-10 h-1.5 w-1.5 rounded-full bg-primary" />
                    </TooltipTrigger>
                    <TooltipContent side="top">Suggested</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <div className="flex flex-1 flex-col justify-center gap-1 overflow-hidden">
                <span className="truncate text-sm font-medium">{item.name}</span>
                {item.description && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </div>
            </div>
          );
        }}
        emptyMessage="No conditional parameters available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
