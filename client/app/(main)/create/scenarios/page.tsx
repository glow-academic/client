/**
 * app/scenarios/page.tsx
 * Scenario list page - redirects to home with scenarios section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import { Scenarios } from "@/components/scenarios/Scenarios";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scenarios",
  description: `Scenarios in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ScenariosPage() {
  return (
    <div className="space-y-6">
      <Scenarios />
    </div>
  );
}
