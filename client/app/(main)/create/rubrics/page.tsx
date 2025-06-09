/**
 * app/create/rubrics/page.tsx
 * Rubric list page - redirects to home with rubrics section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import React from "react";
import Rubrics from "@/components/create/rubrics/Rubrics";

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <Rubrics />
    </div>
  );
}
