/**
 * app/(main)/classes/c/page.tsx
 * Class page for the classes section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Classes",
  description: "Classes in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ClassPage() {
  return redirect("/classes/new");
}
