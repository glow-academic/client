"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { MessageTimeline } from "@/components/common/ai/MessageTimeline";
import { TypeSelector } from "@/components/common/ai/TypeSelector";
import { cn } from "@/lib/utils";
import type { UseGenerationPanelReturn } from "@/hooks/use-generation-panel";
import type { SearchGroupsIn } from "@/app/(main)/layout-server";

interface GroupItem {
  group_id?: string | null;
  trace_id?: string | null;
  group_name?: string | null;
}

interface FullScreenAiProps {
  panel: UseGenerationPanelReturn;
  artifactType: string | null;
  artifactTypes: string[];
  resourceTypes: string[];
  entryTypes: string[];
}

export function FullScreenAi({
  panel,
  artifactType,
  artifactTypes,
  resourceTypes,
  entryTypes,
}: FullScreenAiProps) {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchGroups = useCallback(
    async (search?: string) => {
      try {
        const res = await panel.searchGroupsAction({
          body: {
            search: search || null,
            limit_count: 50,
            offset_count: 0,
          },
        });
        setGroups((res.items as GroupItem[]) ?? []);
      } catch {
        setGroups([]);
      }
    },
    [panel.searchGroupsAction],
  );

  // Initial load
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups(searchTerm || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchGroups]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex">
      {/* Groups Sidebar */}
      <SidebarProvider defaultOpen={true}>
        <Sidebar side="left" collapsible="none" className="w-64 border-r">
          <SidebarHeader>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search groups..."
                className="pl-8 h-8"
              />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groups.map((g) => {
                    const id = g.group_id ?? "";
                    const label = g.group_name ?? g.trace_id ?? "Untitled";
                    const isActive = panel.selectedGroupId === id;

                    return (
                      <SidebarMenuItem key={id}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => panel.setSelectedGroupId(id)}
                        >
                          <span className="truncate">{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  {groups.length === 0 && (
                    <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                      No groups found
                    </p>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Top bar with close button */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h2 className="text-sm font-medium">
              {panel.groupName ?? "AI Generation"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => panel.setMode("panel")}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Exit full screen</span>
            </Button>
          </div>

          {/* Messages */}
          <MessageTimeline
            messages={panel.messages}
            totalCount={panel.totalMessageCount}
            isLoading={panel.isLoadingMessages}
            onLoadMore={panel.loadMoreMessages}
          />

          {/* Type Selector — all types unlocked in fullscreen */}
          <TypeSelector
            activeTab={panel.activeTab}
            onTabChange={panel.setActiveTab}
            artifactTypes={artifactTypes}
            resourceTypes={resourceTypes}
            entryTypes={entryTypes}
            selectedArtifactTypes={panel.selectedArtifactTypes}
            selectedResourceTypes={panel.selectedResourceTypes}
            selectedEntryTypes={panel.selectedEntryTypes}
            onToggleArtifactType={panel.toggleArtifactType}
            onToggleResourceType={panel.toggleResourceType}
            onToggleEntryType={panel.toggleEntryType}
          />

          {/* Input Bar */}
          <div className="border-t p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
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
        </div>
      </SidebarProvider>
    </div>
  );
}
