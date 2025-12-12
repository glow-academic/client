/**
 * app/(main)/management/staff/p/page.tsx
 * Staff edit page for the staff section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Staff",
    description:
      "Manage teaching staff and role assignments for teaching assistant training programs. Organize staff members, assign roles and permissions, and coordinate learning cohort participation for effective L&D program administration.",
  };
}

export default function StaffEditPage() {
  return redirect("/management/staff");
}
