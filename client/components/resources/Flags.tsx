/**
 * Flags.tsx
 * Resource component for boolean flag/switch fields
 * Full UI component with Label + Switch
 * Selects pre-defined flag from server (no resource creation needed)
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
import { Loader2, Power, Sparkles } from "lucide-react";
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
  agent_id?: string | null; // Agent ID (for consistency with other components)
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
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

  // Don't render if show_flag is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm flex items-center gap-1">
            {resolvedIcon || (
              <Power className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          <Switch
            id={id}
            checked={isChecked}
            onCheckedChange={handleChange}
            disabled={disabled || !flagOptionId}
          />
          {onGenerate && (
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
        {helpText && (
          <p className="text-xs text-muted-foreground pl-5">{helpText}</p>
        )}
      </div>
    </div>
  );
}
