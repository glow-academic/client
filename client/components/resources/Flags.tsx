/**
 * Flags.tsx
 * Resource component for boolean flag/switch fields
 * Full UI component with Label + Switch
 */

"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Power } from "lucide-react";
import React from "react";

export interface FlagsProps {
  value: boolean;
  onChange: (value: boolean) => void;
  draftId: string | null;
  label?: string;
  disabled?: boolean;
  id?: string;
  helpText?: string;
  icon?: React.ReactNode;
}

export function Flags({
  value,
  onChange,
  draftId: _draftId, // Not used but kept for consistency
  label = "Active",
  disabled = false,
  id = "active",
  helpText,
  icon,
}: FlagsProps) {
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
            onCheckedChange={onChange}
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
