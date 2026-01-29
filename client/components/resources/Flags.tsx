/**
 * Flags.tsx
 * Server-driven flag resource component for boolean flag/switch fields
 * Displays multiple flags in a configurable grid layout with unified section header
 * Receives enriched flag configs directly from server (no client-side transformation needed)
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
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";
import { Loader2, Power, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface FlagConfig {
  key: string; // Unique key (e.g., "active")
  label: string; // Display label
  description?: string | null; // Help text from DB
  icon_id?: string | null; // Icon name
  flag_option_id?: string | null; // The artifact ID to use when enabling
  show: boolean; // Whether to display this flag
  required?: boolean; // Required indicator
  agent_id?: string | null; // Agent ID for resource creation
  generated?: boolean | null; // Whether AI generated
}

export interface FlagsProps {
  flags: FlagConfig[]; // Array of flag configurations from server
  flag_id?: string | null; // Current selection (form state)
  show_flags?: boolean; // Master visibility control
  columns?: 1 | 2 | 3 | 4; // Columns per row (default: 2)
  label?: string; // Section label
  disabled?: boolean;
  group_id?: string | null;
  agent_id?: string | null; // Default agent ID
  onChange: (flagId: string | null) => void;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Flags({
  flags,
  flag_id,
  show_flags = false,
  columns = 2,
  label,
  disabled = false,
  onChange,
  onGenerate,
  isGenerating = false,
}: FlagsProps) {
  // Filter flags to only show those with show: true
  const visibleFlags = useMemo(
    () => flags.filter((flag) => flag.show),
    [flags]
  );

  // Check if any flag has been generated
  const hasGenerated = useMemo(
    () => visibleFlags.some((flag) => flag.generated),
    [visibleFlags]
  );

  // Handle toggle for a specific flag
  const handleChange = useCallback(
    (flag: FlagConfig, checked: boolean) => {
      if (checked) {
        // Turn ON: use the flag option ID
        if (flag.flag_option_id) {
          onChange(flag.flag_option_id);
        }
      } else {
        // Turn OFF: clear the flag
        onChange(null);
      }
    },
    [onChange]
  );

  // Don't render if show_flags is false or no visible flags
  if (!show_flags || visibleFlags.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      {/* Section header with label and generate button */}
      {(label || onGenerate) && (
        <div className="flex items-center gap-2">
          {label && (
            <Label className="text-sm font-medium">{label}</Label>
          )}
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
      )}

      {/* Grid layout for flags */}
      <div
        className={cn(
          "grid gap-3 pt-1",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {visibleFlags.map((flag) => {
          // Resolve icon for this flag
          const IconComponent = flag.icon_id
            ? getPersonaIconComponent(flag.icon_id)
            : null;
          const resolvedIcon = IconComponent ? (
            <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
          );

          // Switch is ON if flag_id matches this flag's option ID
          const isChecked = flag_id === flag.flag_option_id;

          return (
            <div key={flag.key} className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`flag-${flag.key}`}
                  className="text-sm flex items-center gap-1"
                >
                  {resolvedIcon}
                  {flag.label}
                  {flag.required && <span className="text-destructive">*</span>}
                </Label>
                <Switch
                  id={`flag-${flag.key}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => handleChange(flag, checked)}
                  disabled={disabled || !flag.flag_option_id}
                />
              </div>
              {flag.description && (
                <p className="text-xs text-muted-foreground pl-5">
                  {flag.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
