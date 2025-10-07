/**
 * app/(main)/system/departments/d/page.tsx
 * Agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description: `Departments in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function AgentPage() {
  return redirect("/system/agents/new");
}
