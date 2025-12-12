/**
 * app/(main)/departments/d/page.tsx
 * Departments redirect page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Departments",
    description: "Manage academic departments and organizational units for teaching assistant training programs. Organize departments, configure department-specific settings, and coordinate L&D programs across different academic units.",
  };
}

export default function DepartmentPage() {
  return redirect("/departments/new");
}
