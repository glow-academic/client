/**
 * app/(main)/management/page.tsx
 * Management page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Management",
  description: `Manage cohorts, evals, logs, models, and staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ManagementPage() {
  return redirect("/management/staff");
}
