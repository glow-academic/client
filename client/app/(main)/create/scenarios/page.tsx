/**
 * app/scenarios/page.tsx
 * Scenario list page - redirects to home with scenarios section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import { Scenarios } from "@/components/create/scenarios/Scenarios";

export default function ScenariosPage() {
  return (
    <div className="space-y-6">
      <Scenarios />
    </div>
  );
}
