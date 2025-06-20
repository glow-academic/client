/**
 * app/(main)/management/models/page.tsx
 * Models list page - redirects to home with models section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Models from "@/components/management/models/Models";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Models",
  description: "Manage AI models in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <Models />
    </div>
  );
}
