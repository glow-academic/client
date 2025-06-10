/**
 * app/(main)/management/evals/page.tsx
 * Eval list page - redirects to home with evals section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
"use client";
import React from "react";
import Evals from "@/components/management/evals/Evals";

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <Evals />
    </div>
  );
}
