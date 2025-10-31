/**
 * app/(main)/management/departments/page.tsx
 * Departments list page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Departments from "@/components/system/departments/Departments";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description: `Departments in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <Departments />
    </div>
  );
}
