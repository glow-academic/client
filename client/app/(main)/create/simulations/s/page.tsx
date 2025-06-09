/**
 * app/(main)/create/simulations/s/page.tsx
 * Simulation page for the simulations section. Redirects to simulations page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { redirect } from "next/navigation";

export default function SimulationsPage() {
    return redirect("/create/simulations");
}