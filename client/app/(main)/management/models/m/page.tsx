/**
 * app/(main)/management/models/m/page.tsx
 * Model edit page for the models section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Models",
  description:
    "Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ModelEditPage() {
  return redirect("/management/models");
}
