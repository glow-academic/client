/**
 * Flags.tsx
 * Resource component for boolean flag/switch fields
 * Full UI component with Label + Switch
 * Creates flag resources when active=true and reports resource IDs to parent
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Power } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;

export interface FlagsProps {
  active_flag_id?: string | null; // Current flag_id (standardized prop name)
  flag_resource?: {
    id: string | null;
    name: string | null;
    description: string | null;
    icon_id: string | null;
    generated?: boolean | null;
  } | null; // Resource data from server (standardized prop name; includes generated field)
  show_flag?: boolean; // Whether to show this resource picker
  disabled?: boolean; // Based on can_edit flag
  onFlagIdChange: (flagId: string | null) => void; // Update flag_id in parent form state
  label?: string;
  id?: string;
  helpText?: string;
  icon?: React.ReactNode;
  iconId?: string; // Icon ID to use when creating flag resource (required when value=true)
  createFlagsAction?:
    | ((input: CreateDraftFlagsIn) => Promise<CreateDraftFlagsOut>)
    | undefined;
  // Legacy props for backward compatibility
  flagResource?: {
    id: string;
    name: string;
    description: string;
    icon_id: string | null;
    generated?: boolean | null;
  } | null;
  flagId?: string | null;
}

export function Flags({
  active_flag_id,
  flag_resource,
  show_flag = false,
  disabled = false,
  onFlagIdChange,
  label = "Active",
  id = "active",
  helpText,
  icon,
  iconId,
  createFlagsAction,
  // Legacy props for backward compatibility
  flagResource,
  flagId,
}: FlagsProps) {
  // Use standardized props with fallback to legacy props
  const resource = flag_resource ?? flagResource ?? null;
  const resourceId = active_flag_id ?? flagId ?? null;
  const show = show_flag ?? false;

  // If flag_resource exists, the flag is active (true), otherwise false
  const [internalValue, setInternalValue] = React.useState(
    resource !== null && resource !== undefined
  );
  const lastSavedValueRef = useRef<boolean>(
    resource !== null && resource !== undefined
  );
  const isInitialMountRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Use resourceId for validation/debugging
  useEffect(() => {
    if (resourceId && !resource?.id) {
      // Handle mismatch case - resourceId exists but resource doesn't match
      // This can happen during transitions
    }
  }, [resourceId, resource]);

  // Update internal value when flag_resource changes
  React.useEffect(() => {
    const newValue = resource !== null && resource !== undefined;
    setInternalValue(newValue);
    lastSavedValueRef.current = newValue;
  }, [resource]);

  // Debounced flag resource creation
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = internalValue;
      return;
    }

    // Skip if value hasn't changed
    if (internalValue === lastSavedValueRef.current) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (internalValue && createFlagsAction && iconId) {
          // Create flag resource when active=true
          const result = await createFlagsAction({
            body: {
              name: "active",
              description: "Active flag",
              icon_id: iconId,
            },
          });
          if (result.flag_id) {
            onFlagIdChange(result.flag_id);
          }
        } else if (!internalValue) {
          // Clear resource ID when active=false
          onFlagIdChange(null);
        }
        lastSavedValueRef.current = internalValue;
      } catch (error) {
        console.error("Failed to create flag resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [internalValue, createFlagsAction, iconId, onFlagIdChange]);

  const handleChange = useCallback((checked: boolean) => {
    setInternalValue(checked);
  }, []);

  // Don't render if show_flag is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm flex items-center gap-1.5">
            {icon || <Power className="h-3.5 w-3.5 text-muted-foreground" />}
            {label}
          </Label>
          <Switch
            id={id}
            checked={internalValue ?? false}
            onCheckedChange={handleChange}
            disabled={disabled}
          />
        </div>
        {helpText && (
          <p className="text-xs text-muted-foreground pl-5">{helpText}</p>
        )}
      </div>
    </div>
  );
}
