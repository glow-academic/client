/**
 * app/(main)/create/scenarios/s/page.tsx
 * Scenario page for the scenarios section. Redirects to scenarios page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { getSession } from "@/auth";
import { redirect } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Scenarios",
    description:
      "Manage problem-based learning scenarios for teaching assistant training. Create and organize realistic educational challenges and problem statements to practice pedagogical problem-solving and enhance instructional design skills.",
  };
}

export default function ScenariosPage() {
  return redirect("/create/scenarios");
}
