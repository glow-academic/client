/**
 * app/(main)/create/simulations/s/page.tsx
 * Simulation page for the simulations section. Redirects to simulations page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Simulations",
  description: `Simulations in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function SimulationsPage() {
  return redirect("/create/simulations");
}
