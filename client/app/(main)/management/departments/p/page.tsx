/**
 * app/(main)/management/staff/p/page.tsx
 * Staff edit page for the staff section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff",
  description: `Manage staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function StaffEditPage() {
  return redirect("/management/staff");
}
