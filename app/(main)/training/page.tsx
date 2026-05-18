/**
 * app/(main)/create/page.tsx
 * Create page. Redirects to new class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create",
    description:
      "Create new teaching resources for teaching assistant training. Design simulations, scenarios, personas, and other educational content to support simulation-based learning and pedagogical development.",
  };
}

export default function CreatePage() {
  return redirect("/training/scenarios");
}
