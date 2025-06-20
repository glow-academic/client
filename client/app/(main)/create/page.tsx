/**
 * app/(main)/create/page.tsx
 * Create page. Redirects to new class page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create",
  description: "Create new simulations in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function CreatePage() {
  return redirect("/create/scenarios");
}
