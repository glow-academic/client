/**
 * Flags.tsx
 * Server-driven flag resource component for boolean flag/switch fields
 * Supports two modes:
 * 1. Single-flag mode: flag_id + onChange(flagId)
 * 2. Multi-flag mode: flag_ids + onChange(key, flagId)
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
import { getIconComponent } from "@/utils/icons";
import { Check, Power, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface FlagResourceItem {
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  pending?: boolean | null;
}

export interface FlagConfig {
  key: string; // Unique key (e.g., "active", "video_enabled")
  label: string; // Display label
  description?: string | null; // Help text from DB
  icon_id?: string | null; // Icon name
  flag_option_id?: string | null; // The artifact ID to use when enabling
  show?: boolean; // Whether to display this flag (defaults to true)
  required?: boolean; // Required indicator
  generated?: boolean | null; // Whether AI generated
  pending?: boolean | null; // Whether this flag is pending acceptance
}

// Common props for both modes
interface CommonFlagsProps {
  flags: FlagConfig[]; // Array of flag configurations from server
  show_flags?: boolean; // Master visibility control
  columns?: 1 | 2 | 3 | 4; // Columns per row (default: 2)
  label?: string; // Section label
  disabled?: boolean;
  group_id?: string | null;
  showAiGenerate?: boolean; // Whether to show AI generate button (computed server-side)
  onGenerate?: () => void | Promise<void>;
}

// Single-flag mode props - uses flag_id (optional) without flag_ids
export interface SingleFlagProps extends CommonFlagsProps {
  mode?: "single";
  flag_id?: string | null;
  flag_ids?: never;
  onChange: (flagId: string | null) => void;
}

// Multi-flag mode props - uses flag_ids (required) without flag_id
export interface MultiFlagProps extends CommonFlagsProps {
  mode?: "multi";
  flag_id?: never;
  flag_ids: Record<string, string | null>;
  onChange: (key: string, flagId: string | null) => void;
}

export type FlagsProps = SingleFlagProps | MultiFlagProps;

export function Flags(props: FlagsProps) {
  const {
    flags,
    show_flags = false,
    columns = 2,
    label,
    disabled = false,
    showAiGenerate = false,
    group_id,
    onChange,
    onGenerate,
  } = props;

  // Determine mode based on props
  const isMultiMode = "flag_ids" in props && props.flag_ids !== undefined;
  const flagIds = isMultiMode ? props.flag_ids : null;
  const singleFlagId = !isMultiMode ? props.flag_id : null;

  // Filter flags to only show those with show: true (default to true if not specified)
  const visibleFlags = useMemo(
    () => flags.filter((flag) => flag.show !== false),
    [flags]
  );

  // Detect pending items
  const hasPending = useMemo(
    () => visibleFlags.some((flag) => flag.pending),
    [visibleFlags]
  );

  // Check if any flag has been generated
  const hasGenerated = useMemo(
    () => visibleFlags.some((flag) => flag.generated),
    [visibleFlags]
  );

  // Pending state: flags with pending=true from soft draft connections
  const pendingFlags = useMemo(
    () => visibleFlags.filter((f) => f.pending),
    [visibleFlags]
  );
  const showDiff = pendingFlags.length > 0;
  const pendingFlagIds = useMemo(
    () => new Set(pendingFlags.map((f) => f.flag_option_id).filter(Boolean) as string[]),
    [pendingFlags]
  );

  // Get the checked state for a flag
  const isChecked = useCallback(
    (flag: FlagConfig): boolean => {
      if (isMultiMode && flagIds) {
        return flagIds[flag.key] === flag.flag_option_id;
      }
      return singleFlagId === flag.flag_option_id;
    },
    [isMultiMode, flagIds, singleFlagId]
  );

  // Handle toggle for a specific flag
  const handleChange = useCallback(
    (flag: FlagConfig, checked: boolean) => {
      const newValue = checked ? (flag.flag_option_id ?? null) : null;

      if (isMultiMode) {
        (onChange as (key: string, flagId: string | null) => void)(
          flag.key,
          newValue
        );
      } else {
        (onChange as (flagId: string | null) => void)(newValue);
      }
    },
    [isMultiMode, onChange]
  );

  // Accept pending — confirm pending flags in form state
  const handleAccept = useCallback(() => {
    // Pending flags are already reflected in form state — nothing to change
    // The next draft save will persist them as active
  }, []);

  // Reject pending — unset pending flags
  const handleReject = useCallback(() => {
    for (const flag of pendingFlags) {
      if (isMultiMode) {
        (onChange as (key: string, flagId: string | null) => void)(flag.key, null);
      } else {
        (onChange as (flagId: string | null) => void)(null);
      }
    }
  }, [pendingFlags, isMultiMode, onChange]);

  // Don't render if show_flags is false or no visible flags
  if (!show_flags || visibleFlags.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      {/* Section header with label and generate button */}
      {(label || onGenerate) && (
        <div className="flex items-center gap-2">
          {label && <Label className="text-sm font-medium">{label}</Label>}
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
                    disabled={disabled || showDiff}
                  >
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
            ? getIconComponent(flag.icon_id)
            : null;
          const resolvedIcon = IconComponent ? (
            <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
          );

          const checked = isChecked(flag);
          const isPending = flag.pending === true;

          return (
            <div
              key={flag.key}
              className={cn(
                "space-y-1 p-2 rounded-lg transition-all",
                isPending && "ring-2 ring-success bg-success/10",
              )}
            >
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`flag-${flag.key}`}
                  className="text-sm flex items-center gap-1"
                >
                  {resolvedIcon}
                  {flag.label}
                  {flag.required && (
                    <span className="text-destructive">*</span>
                  )}
                  {isPending && (
                    <span className="ml-2 text-xs text-success font-medium">
                      Pending
                    </span>
                  )}
                </Label>
                <Switch
                  id={`flag-${flag.key}`}
                  checked={checked}
                  onCheckedChange={(c) => handleChange(flag, c)}
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
