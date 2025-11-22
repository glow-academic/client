/**
 * app/(main)/system/page.tsx
 * System page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System",
  description: `Manage agents, departments, feedback, logs, and health in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function SystemPage() {
  return redirect("/system/auth");
}
