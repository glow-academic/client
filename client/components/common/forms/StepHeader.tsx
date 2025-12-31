/**
 * StepHeader.tsx
 * Reusable step badge/header component for form sections
 * Extracted common pattern used across all form sections
 */

"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepStatus = "pending" | "active" | "completed";

export interface StepHeaderProps {
  stepStatus: StepStatus;
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isOptional?: boolean;
  className?: string;
}

export function StepHeader({
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isOptional = false,
  className,
}: StepHeaderProps) {
  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
          stepStatus === "completed"
            ? "bg-green-500 text-white"
            : stepStatus === "active"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
        )}
      >
        {stepStatus === "completed" ? (
          <Check className="w-4 h-4" />
        ) : (
          <span>{stepNumber}</span>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold">{stepTitle}</h3>
        <p className="text-sm text-muted-foreground">{stepDescription}</p>
      </div>
      {isOptional && (
        <span className="text-xs text-muted-foreground">(Optional)</span>
      )}
    </div>
  );
}
