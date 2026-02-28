"use client";

import { Maximize2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RightPanel, useRightPanel } from "@/components/ui/right-panel";
import { GroupSelector } from "@/components/common/ai/GroupSelector";
import { MessageTimeline } from "@/components/common/ai/MessageTimeline";
import { TypeSelector } from "@/components/common/ai/TypeSelector";
import { FullScreenAi } from "@/components/common/ai/FullScreenAi";
import {
  useGenerationPanel,
  type UseGenerationPanelConfig,
} from "@/hooks/use-generation-panel";
import type {
  GroupMessagesIn,
  GroupMessagesOut,
  SearchGroupsIn,
  SearchGroupsOut,
} from "@/app/(main)/layout-server";

interface GenerationPanelProps {
  artifactType: string | null;
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
  searchGroupsAction: (input: SearchGroupsIn) => Promise<SearchGroupsOut>;
}

// Placeholder type lists — will be driven by registry per artifact type
const DEFAULT_ARTIFACT_TYPES: string[] = [];
const DEFAULT_RESOURCE_TYPES: string[] = [];
const DEFAULT_ENTRY_TYPES: string[] = [];

export function GenerationPanel({
  artifactType,
  getGroupMessagesAction,
  searchGroupsAction,
}: GenerationPanelProps) {
  const { open } = useRightPanel();
  const panel = useGenerationPanel({
    getGroupMessagesAction,
    searchGroupsAction,
  });

  if (!open) return null;

  if (panel.mode === "fullscreen") {
    return (
      <FullScreenAi
        panel={panel}
        artifactType={artifactType}
        artifactTypes={DEFAULT_ARTIFACT_TYPES}
        resourceTypes={DEFAULT_RESOURCE_TYPES}
        entryTypes={DEFAULT_ENTRY_TYPES}
      />
    );
  }

  return (
    <RightPanel className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b p-3">
        <div className="flex-1">
          <GroupSelector
            selectedGroupId={panel.selectedGroupId}
            onSelect={panel.setSelectedGroupId}
            searchGroupsAction={panel.searchGroupsAction}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => panel.setMode("fullscreen")}
        >
          <Maximize2 className="h-4 w-4" />
          <span className="sr-only">Full screen</span>
        </Button>
      </div>

      {/* Message Timeline */}
      <MessageTimeline
        messages={panel.messages}
        totalCount={panel.totalMessageCount}
        isLoading={panel.isLoadingMessages}
        onLoadMore={panel.loadMoreMessages}
      />

      {/* Type Selector */}
      <TypeSelector
        activeTab={panel.activeTab}
        onTabChange={panel.setActiveTab}
        artifactTypes={DEFAULT_ARTIFACT_TYPES}
        resourceTypes={DEFAULT_RESOURCE_TYPES}
        entryTypes={DEFAULT_ENTRY_TYPES}
        selectedArtifactTypes={panel.selectedArtifactTypes}
        selectedResourceTypes={panel.selectedResourceTypes}
        selectedEntryTypes={panel.selectedEntryTypes}
        onToggleArtifactType={panel.toggleArtifactType}
        onToggleResourceType={panel.toggleResourceType}
        onToggleEntryType={panel.toggleEntryType}
      />

      {/* Input Bar */}
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
    </RightPanel>
  );
}
