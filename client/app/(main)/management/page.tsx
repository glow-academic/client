/**
 * app/(main)/management/page.tsx
 * Management page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { redirect } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Management",
    description:
      "Administrative management hub for teaching assistant training platform. Manage learning cohorts, staff assignments, educational resources, evaluation configurations, and system settings for comprehensive L&D program administration.",
  };
}

export default function ManagementPage() {
  return redirect("/management/policies");
}
