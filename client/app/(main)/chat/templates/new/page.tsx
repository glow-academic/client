/**
 * app/chat/templates/new/page.tsx
 * Template creation page
 */
"use client";

import Template from "@/components/Template";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <Template mode="create" />
    </div>
  );
}
