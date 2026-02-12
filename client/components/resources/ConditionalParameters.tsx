/**
 * ConditionalParameters.tsx
 * Resource component for conditional parameter selection
 * Links parameters to conditions via parameter_id
 */

"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ConditionalParametersProps {
  conditional_parameter_ids?: string[];
  conditional_parameter_resources?: Array<{
    id?: string | null;
    parameter_id?: string | null;
    generated?: boolean | null;
  }>;
  show_conditional_parameters?: boolean;
  conditional_parameters?: Array<{
    id?: string | null;
    parameter_id?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  group_id?: string | null;
  link_tool_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  aiConditionalParameterResources?: Array<{
    id?: string | null;
    parameter_id?: string | null;
  }> | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ConditionalParameters({
  conditional_parameter_ids,
  conditional_parameter_resources,
  show_conditional_parameters = false,
  conditional_parameters,
  disabled = false,
  onChange,
  label = "Conditional Parameters",
  id = "conditional-parameters",
  required = false,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiConditionalParameterResources,
  onAccept,
  onReject,
}: ConditionalParametersProps) {
  const ids = useMemo(
    () => conditional_parameter_ids ?? [],
    [conditional_parameter_ids]
  );
  const show = show_conditional_parameters ?? false;
  const allItems = useMemo(
    () => conditional_parameters ?? [],
    [conditional_parameters]
  );

  const showDiff = !!aiConditionalParameterResources?.length;

  const hasGenerated = useMemo(() => {
    return conditional_parameter_resources?.some((r) => r.generated) ?? false;
  }, [conditional_parameter_resources]);

  const handleToggle = useCallback(
    (itemId: string) => {
      if (ids.includes(itemId)) {
        onChange(ids.filter((id) => id !== itemId));
      } else {
        onChange([...ids, itemId]);
      }
    },
    [ids, onChange]
  );

  const handleAccept = useCallback(() => {
    if (!aiConditionalParameterResources?.length) return;
    const newIds = aiConditionalParameterResources
      .map((r) => r.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiConditionalParameterResources, ids, onChange, onAccept]);

  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
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
      <div className="flex flex-wrap gap-2">
        {allItems.map((item) => (
          <Button
            key={item.id ?? "unknown"}
            type="button"
            variant={item.id && ids.includes(item.id) ? "default" : "outline"}
            size="sm"
            onClick={() => item.id && handleToggle(item.id)}
            disabled={disabled}
          >
            {item.parameter_id ? `Param ${String(item.parameter_id).slice(0, 8)}...` : "Unknown"}
          </Button>
        ))}
        {allItems.length === 0 && (
          <p className="text-sm text-muted-foreground">No conditional parameters available.</p>
        )}
      </div>
    </div>
  );
}
