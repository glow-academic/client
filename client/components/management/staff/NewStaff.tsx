"use client";
import StaffManager from "@/components/common/staff/StaffManager";

export interface NewStaffProps {
  onDone?: () => void;
}

export default function NewStaff({ onDone }: NewStaffProps) {
  return <StaffManager onDone={onDone ?? (() => {})} />;
}
