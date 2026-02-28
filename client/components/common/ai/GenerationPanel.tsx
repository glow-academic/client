"use client";

import React from "react";
import { Layers, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarRail
} from "@/components/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
              <div className="flex flex-col gap-1 self-end">
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon">
                          <Layers className="h-4 w-4" />
                          <span className="sr-only">Context</span>
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="left">Context</TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    side="top"
                    align="end"
                    className="w-72 max-h-80 overflow-y-auto p-0"
                  >
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
                  </PopoverContent>
                </Popover>
                <Button size="icon">
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Generate</span>
                </Button>
              </div>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
