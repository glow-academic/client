/**
 * StaffRoleSection.tsx
 * Staff role selection section component
 */
"use client";

import { StaffRoleCardGrid } from "@/components/staff/StaffRoleCardGrid";

export interface StaffRoleSectionProps {
  // Data
  role: string;
  scopedRoles: string[];

  // Callbacks
  onRoleChange: (role: string) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffRoleSection({
  role,
  scopedRoles,
  onRoleChange,
  isReadonly,
  isSubmitting,
}: StaffRoleSectionProps) {
  return (
    <div className="space-y-4">
      <div data-testid="input-staff-role">
        <StaffRoleCardGrid
          selectedRoleId={role}
          scopedRoles={scopedRoles}
          onRoleChange={onRoleChange}
          readonly={isReadonly || isSubmitting}
        />
      </div>
    </div>
  );
}
