/**
 * app/chat/templates/t/[templateId]/page.tsx
 * Template editing page
 */
"use client";

import { useParams } from "next/navigation";
import Template from "@/components/Template";

export default function EditTemplatePage() {
  const params = useParams();
  const templateId = params.templateId as string;

  return (
    <div className="space-y-6">
      <Template mode="create" templateId={templateId} />
    </div>
  );
}
