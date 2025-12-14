/**
 * StaffCohortsSection.tsx
 * Staff cohorts section component (multi-select, no primary)
 */
"use client";

import { StaffCohortCardGrid } from "@/components/staff/StaffCohortCardGrid";

export interface CohortMappingItem {
  name: string;
  description: string;
}

export interface StaffCohortsSectionProps {
  // Data
  cohortIds: string[];
  validCohortIds: string[];
  cohortMapping: Record<string, CohortMappingItem>;

  // Callbacks
  onCohortIdsChange: (ids: string[]) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffCohortsSection({
  cohortIds,
  validCohortIds,
  cohortMapping,
  onCohortIdsChange,
  isReadonly,
  isSubmitting,
}: StaffCohortsSectionProps) {
  return (
    <div className="space-y-4">
      <StaffCohortCardGrid
        cohortIds={cohortIds}
        validCohortIds={validCohortIds}
        cohortMapping={cohortMapping}
        onCohortIdsChange={onCohortIdsChange}
        readonly={isReadonly || isSubmitting}
      />
    </div>
  );
}
