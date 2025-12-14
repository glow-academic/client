/**
 * StaffEmailsSection.tsx
 * Staff emails section component with primary email support
 */
"use client";

import { StaffEmailCardGrid } from "@/components/staff/StaffEmailCardGrid";

export interface StaffEmailsSectionProps {
  // Data
  emails: string[];
  primaryEmailIndex: number | undefined;

  // Callbacks
  onEmailsChange: (emails: string[]) => void;
  onPrimaryEmailIndexChange: (index: number | undefined) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffEmailsSection({
  emails,
  primaryEmailIndex,
  onEmailsChange,
  onPrimaryEmailIndexChange,
  isReadonly,
  isSubmitting,
}: StaffEmailsSectionProps) {
  return (
    <div className="space-y-4">
      <StaffEmailCardGrid
        emails={emails}
        primaryEmailIndex={primaryEmailIndex}
        onEmailsChange={onEmailsChange}
        onPrimaryEmailIndexChange={onPrimaryEmailIndexChange}
        readonly={isReadonly || isSubmitting}
      />
    </div>
  );
}
