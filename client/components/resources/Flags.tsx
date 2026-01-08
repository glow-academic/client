/**
 * Flags.tsx
 * Resource component for boolean flag/switch fields
 * Full UI component with Label + Switch
 * Creates flag resources when active=true and reports resource IDs to parent
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Power } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

export interface FlagsProps {
  value: boolean; // Current boolean value
  resourceId: string | null; // Current resource_id (for form state)
  onChange: (value: boolean) => void; // Update boolean value (for UI only)
  onResourceIdChange: (resourceId: string | null) => void; // Update resource_id in parent form state
  label?: string;
  disabled?: boolean;
  id?: string;
  helpText?: string;
  icon?: React.ReactNode;
  iconId?: string; // Icon ID to use when creating flag resource (required when value=true)
  createFlagsAction?:
    | ((input: {
        body: {
          name: string;
          description: string;
          icon_id: string;
        };
      }) => Promise<{ flag_id?: string | null }>)
    | undefined;
}

export function Flags({
  value,
  resourceId,
  onChange,
  onResourceIdChange,
  label = "Active",
  disabled = false,
  id = "active",
  helpText,
  icon,
  iconId,
  createFlagsAction,
}: FlagsProps) {
  const lastSavedValueRef = useRef<boolean>(value);
  const isInitialMountRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced flag resource creation
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastSavedValueRef.current = value;
      return;
    }

    // Skip if value hasn't changed
    if (value === lastSavedValueRef.current) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        if (value && createFlagsAction && iconId) {
          // Create flag resource when active=true
          const result = await createFlagsAction({
            body: {
              name: "active",
              description: "Active flag",
              icon_id: iconId,
            },
          });
          if (result.flag_id) {
            onResourceIdChange(result.flag_id);
          }
        } else if (!value) {
          // Clear resource ID when active=false
          onResourceIdChange(null);
        }
        lastSavedValueRef.current = value;
      } catch (error) {
        console.error("Failed to create flag resource:", error);
      }
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, createFlagsAction, iconId, onResourceIdChange]);

  const handleChange = useCallback(
    (checked: boolean) => {
      onChange(checked); // Update boolean value immediately for UI
    },
    [onChange]
  );

  return (
    <div className="space-y-2 pt-2">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Label
            htmlFor={id}
            className="text-sm flex items-center gap-1.5"
          >
            {icon || <Power className="h-3.5 w-3.5 text-muted-foreground" />}
            {label}
          </Label>
          <Switch
            id={id}
            checked={value ?? false}
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
