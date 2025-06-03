/**
 * app/template/t/[templateId]/page.tsx
 * Template editing page
 */
"use client";

import { useParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UnifiedSidebar } from "@/components/unified-sidebar";
import Template from "@/components/Template";

export default function EditTemplatePage() {
  const params = useParams();
  const templateId = params.templateId as string;

  return (
    <SidebarProvider>
      <UnifiedSidebar
        activeSection="templates"
        onSectionChange={() => {}} // No-op since we're on a dedicated page
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Edit Template</h1>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Template mode="create" templateId={templateId} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
