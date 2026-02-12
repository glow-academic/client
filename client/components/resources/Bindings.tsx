/**
 * Bindings.tsx
 * Resource component for binding entry selection
 * Simple picker for binding resources (entry_type enum values)
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

export interface BindingsProps {
  binding_id?: string | null;
  binding_resource?: {
    id?: string | null;
    entry?: string | null;
    generated?: boolean | null;
  } | null;
  show_bindings?: boolean;
  bindings?: Array<{
    id?: string | null;
    entry?: string | null;
    generated?: boolean | null;
  }>;
  disabled?: boolean;
  onChange: (bindingId: string | null) => void;
  label?: string;
  id?: string;
  required?: boolean;
  group_id?: string | null;
  link_tool_id?: string | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  aiBindingResource?: {
    id?: string | null;
    entry?: string | null;
  } | null;
  onAccept?: () => void;
  onReject?: () => void;
}

export function Bindings({
  binding_id,
  binding_resource,
  show_bindings = false,
  bindings,
  disabled = false,
  onChange,
  label = "Binding",
  id = "binding",
  required = false,
  showAiGenerate = false,
  onGenerate,
  isGenerating = false,
  aiBindingResource,
  onAccept,
  onReject,
}: BindingsProps) {
  const resourceId = binding_id ?? null;
  const show = show_bindings ?? false;
  const allBindings = useMemo(() => bindings ?? [], [bindings]);

  const showDiff = !!aiBindingResource?.entry;

  const handleSelect = useCallback(
    (selectedId: string) => {
      if (selectedId === resourceId) {
        onChange(null);
      } else {
        onChange(selectedId);
      }
    },
    [resourceId, onChange]
  );

  const handleAccept = useCallback(() => {
    if (!aiBindingResource?.id) return;
    onChange(aiBindingResource.id);
    onAccept?.();
  }, [aiBindingResource, onChange, onAccept]);

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
                {binding_resource?.generated ? "Regenerate" : "Generate"}
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
        {allBindings.map((binding) => (
          <Button
            key={binding.id ?? "unknown"}
            type="button"
            variant={binding.id === resourceId ? "default" : "outline"}
            size="sm"
            onClick={() => binding.id && handleSelect(binding.id)}
            disabled={disabled}
          >
            {binding.entry ?? "Unknown"}
          </Button>
        ))}
        {allBindings.length === 0 && (
          <p className="text-sm text-muted-foreground">No bindings available.</p>
        )}
      </div>
    </div>
  );
}
