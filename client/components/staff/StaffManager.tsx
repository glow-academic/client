"use client";

import AddStaffToCohort from "./AddStaffToCohort";
import CreateStaff from "./CreateStaff";

export interface StaffManagerProps {
  cohortId?: string;
  onDone?: () => void;
}

/**
 * StaffManager V2 - Wrapper component that renders the appropriate
 * staff management component based on context.
 *
 * - If cohortId is provided: Renders AddStaffToCohort (add/search/create profiles for a cohort)
 * - If no cohortId: Renders CreateStaff (global staff creation)
 */
export default function StaffManager({
  cohortId = undefined,
  onDone,
}: StaffManagerProps) {
  if (cohortId) {
    return <AddStaffToCohort cohortId={cohortId} {...(onDone && { onDone })} />;
  }

  return <CreateStaff {...(onDone && { onDone })} />;
}
