/**
 * app/template/page.tsx
 * Template list page - redirects to home with templates section
 */
"use client";
import React from "react";
import { TemplatesContent } from "@/components/admin/templates-content";

export default function ChatTemplatesPage() {
  return (
    <div className="space-y-6">
      <TemplatesContent />
    </div>
  );
}
