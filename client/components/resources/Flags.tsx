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
  flagResource?: {
    id: string;
    name: string;
    description: string;
    icon_id: string | null;
  } | null; // Resource data from server (composite type)
  flagId: string | null; // Current flag_id (for form state)
  onFlagIdChange: (flagId: string | null) => void; // Update flag_id in parent form state
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
  flagResource,
  flagId,
  onFlagIdChange,
  label = "Active",
  disabled = false,
  id = "active",
  helpText,
  icon,
  iconId,
  createFlagsAction,
}: FlagsProps) {
  // If flagResource exists, the flag is active (true), otherwise false
  const [internalValue, setInternalValue] = React.useState(
    flagResource !== null && flagResource !== undefined
  );
  const lastSavedValueRef = useRef<boolean>(
    flagResource !== null && flagResource !== undefined
  );
  const isInitialMountRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update internal value when flagResource changes
  React.useEffect(() => {
    const newValue = flagResource !== null && flagResource !== undefined;
    setInternalValue(newValue);
    lastSavedValueRef.current = newValue;
  }, [flagResource]);

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
