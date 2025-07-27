/**
 * app/(main)/management/parameters/p/page.tsx
 * Parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parameters",
  description: `Parameters in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ParameterPage() {
  return redirect("/management/parameters/new");
}
