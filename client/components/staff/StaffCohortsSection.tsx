/**
 * StaffCohortsSection.tsx
 * Staff cohorts section component (multi-select, no primary)
 */
"use client";

import { StaffCohortCardGrid } from "@/components/staff/StaffCohortCardGrid";

export interface CohortItem {
  cohort_id: string;
  name: string;
  description: string;
}

export interface StaffCohortsSectionProps {
  // Data
  cohortIds: string[];
  validCohortIds: string[];
  cohorts: CohortItem[];  // Array of cohort objects (replaces cohortMapping)

  // Callbacks
  onCohortIdsChange: (ids: string[]) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffCohortsSection({
  cohortIds,
  validCohortIds,
  cohorts,
  onCohortIdsChange,
  isReadonly,
  isSubmitting,
}: StaffCohortsSectionProps) {
  return (
    <div className="space-y-4">
      <StaffCohortCardGrid
        cohortIds={cohortIds}
        validCohortIds={validCohortIds}
        cohorts={cohorts}
        onCohortIdsChange={onCohortIdsChange}
        readonly={isReadonly || isSubmitting}
      />
    </div>
  );
}
