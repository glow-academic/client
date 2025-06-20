/**
 * app/(main)/management/models/new/page.tsx
 * New model page for the models section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewModel from "@/components/management/models/NewModel";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Models",
  description: "Create new AI models in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewModelPage() {
  return (
    <div className="space-y-6">
      <NewModel />
    </div>
  );
}
