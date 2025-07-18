/**
 * app/(main)/management/departments/d/page.tsx
 * Department edit page for the department section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description: `Manage departments in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function DepartmentEditPage() {
  return redirect("/management/departments");
}
