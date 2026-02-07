/**
 * FlagsLegacy.tsx
 * Legacy resource component for boolean flag/switch fields
 * Full UI component with Label + Switch
 * Selects pre-defined flag from server (no resource creation needed)
 * Used by components that haven't migrated to server-driven Flags
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { cn } from "@/lib/utils";
import { Check, Loader2, Power, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface FlagItem {
  id: string | null;
  name: string | null;
  description: string | null;
  icon: string | null;
  generated?: boolean | null;
}

export interface FlagsProps {
  flag_id?: string | null; // Current flag_id (standardized prop name)
  flag_resource?: FlagItem | null; // Resource data for currently active flag
  flags?: FlagItem[] | null; // All available flag options from API
  show_flag?: boolean; // Whether to show this resource picker
  disabled?: boolean; // Based on can_edit flag
  onFlagIdChange: (flagId: string | null) => void; // Update flag_id in parent form state
  label?: string;
  id?: string;
  required?: boolean;
  helpText?: string;
  icon?: React.ReactNode;
  group_id?: string | null; // Group ID (for consistency with other components)
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  // AI diff view props
  aiFlagResources?: Array<{ id?: string | null; key?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  // Legacy props for backward compatibility
  flagResource?: FlagItem | null;
  flagId?: string | null;
}

export function Flags({
  flag_id,
  flag_resource,
  flags,
  show_flag = false,
  disabled = false,
  onFlagIdChange,
  label = "Active",
  id = "active",
  required = false,
  helpText,
  icon,
  onGenerate,
  isGenerating = false,
  showAiGenerate = false,
  aiFlagResources,
  onAccept,
  onReject,
  // Legacy props for backward compatibility
  flagResource,
  flagId,
}: FlagsProps) {
  // Use standardized props with fallback to legacy props
  const resource = flag_resource ?? flagResource ?? null;
  const currentId = flag_id ?? flagId ?? null;
  const show = show_flag ?? false;

  // Get the flag ID to use when toggling ON
  // Priority: current resource ID, then first flag from flags array
  const flagOptionId = useMemo(() => {
    if (resource?.id) return resource.id;
    if (flags && flags.length > 0 && flags[0]?.id) return flags[0].id;
    return null;
  }, [resource?.id, flags]);

  // Resolve icon from resource or first flag
  const resolvedIcon = useMemo(() => {
    if (icon) return icon;
    const iconName = resource?.icon ?? (flags && flags[0]?.icon);
    if (!iconName) return null;
    const IconComponent = getPersonaIconComponent(iconName);
    if (!IconComponent) return null;
    return <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />;
  }, [icon, resource?.icon, flags]);

  // Switch is ON if we have a flag_id selected
  const isChecked = currentId !== null && currentId !== undefined;

  // Handle toggle - use flagOptionId when turning ON, null when turning OFF
  const handleChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        // Turn ON: use the flag option ID
        if (flagOptionId) {
          onFlagIdChange(flagOptionId);
        }
      } else {
        // Turn OFF: clear the flag
        onFlagIdChange(null);
      }
    },
    [flagOptionId, onFlagIdChange]
  );

  // Check if generated (from resource or first flag)
  const hasGenerated = resource?.generated ?? (flags && flags[0]?.generated) ?? false;

  // AI suggestion state
  const showDiff = !!aiFlagResources?.length;
  const aiSuggestedFlagIds = useMemo(
    () =>
      new Set(
        aiFlagResources?.map((f) => f.id).filter(Boolean) as string[]
      ),
    [aiFlagResources]
  );

  // Accept AI suggestion - apply all AI-suggested flags
  const handleAccept = useCallback(() => {
    if (!aiFlagResources?.length) return;

    for (const aiFlag of aiFlagResources) {
      if (!aiFlag.id) continue;
      // In single mode, only apply the first flag suggestion
      onFlagIdChange(aiFlag.id);
      break;
    }
    onAccept?.();
  }, [aiFlagResources, onFlagIdChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Check if AI is suggesting this flag
  const isAiSuggested = showDiff && !!flagOptionId && aiSuggestedFlagIds.has(flagOptionId);
  const wouldChange = isAiSuggested && !isChecked; // AI wants to turn this ON

  // Don't render if show_flag is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <div
        className={cn(
          "space-y-1 p-2 rounded-lg transition-all",
          isAiSuggested && "ring-2 ring-success bg-success/10"
        )}
      >
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm flex items-center gap-1">
            {resolvedIcon || (
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {label}
            {required && <span className="text-destructive">*</span>}
            {isAiSuggested && (
              <span className="ml-2 text-xs text-success font-medium">
                → {wouldChange ? "ON" : "OFF"} (AI)
              </span>
            )}
          </Label>
          <Switch
            id={id}
            checked={isChecked}
            onCheckedChange={handleChange}
            disabled={disabled || !flagOptionId}
          />
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
        {helpText && (
          <p className="text-xs text-muted-foreground pl-5">{helpText}</p>
        )}
      </div>
    </div>
  );
}
