"use client";

import React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { MessageTimeline } from "@/components/common/ai/MessageTimeline";
import { TypeSelector } from "@/components/common/ai/TypeSelector";
import type { UseGenerationPanelReturn } from "@/hooks/use-generation-panel";
import type { TypeItem } from "@/components/common/ai/types";

interface GenerationPanelProps {
  panel: UseGenerationPanelReturn;
  artifactType: string | null;
  validArtifactTypes: TypeItem[];
  validResourceTypes: TypeItem[];
  validEntryTypes: TypeItem[];
}

export function GenerationPanel({
  panel,
  artifactType,
  validArtifactTypes,
  validResourceTypes,
  validEntryTypes,
}: GenerationPanelProps) {
  return (
    <SidebarProvider
      open={panel.panelOpen}
      onOpenChange={panel.setPanelOpen}
      className="!min-h-0 !w-auto flex-none"
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader className="p-0 border-b">
          <TypeSelector
            activeTab={panel.activeTab}
            onTabChange={panel.setActiveTab}
            artifactTypes={validArtifactTypes}
            resourceTypes={validResourceTypes}
            entryTypes={validEntryTypes}
            selectedArtifactTypes={panel.selectedArtifactTypes}
            selectedResourceTypes={panel.selectedResourceTypes}
            selectedEntryTypes={panel.selectedEntryTypes}
            onToggleArtifactType={panel.toggleArtifactType}
            onToggleResourceType={panel.toggleResourceType}
            onToggleEntryType={panel.toggleEntryType}
          />
        </SidebarHeader>

        <SidebarContent className="flex flex-col p-0">
          <MessageTimeline
            messages={panel.messages}
            totalCount={panel.totalMessageCount}
            isLoading={panel.isLoadingMessages}
            onLoadMore={panel.loadMoreMessages}
          />
        </SidebarContent>

        <SidebarFooter className="p-0">
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                value={panel.instructions}
                onChange={(e) => panel.setInstructions(e.target.value)}
                placeholder="Instructions (optional)..."
                className="min-h-[60px] flex-1 resize-none text-sm"
              />
              <Button size="icon" className="self-end">
                <Send className="h-4 w-4" />
                <span className="sr-only">Generate</span>
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
