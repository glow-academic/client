/**
 * app/(main)/training/simulations/s/page.tsx
 * Simulation page for the simulations section. Redirects to simulations page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Simulations",
    description:
      "Manage teaching practice simulations for graduate teaching assistant training. Create and organize realistic student interaction scenarios to practice pedagogical techniques, improve communication skills, and enhance teaching effectiveness through simulation-based learning.",
  };
}

export default function SimulationsPage() {
  return redirect("/training/simulations");
}
