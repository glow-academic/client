/**
 * useGenerationPanel
 *
 * Manages all AI generation panel state:
 * - Panel mode (panel vs fullscreen)
 * - Group selection (synced to URL via nuqs)
 * - Messages fetching and pagination (via server action)
 * - Type selection (artifacts, resources, entries)
 * - Instructions text
 * - Generate action delegation
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import type {
  GroupMessagesIn,
  GroupMessagesOut,
  SearchGroupsIn,
  SearchGroupsOut,
} from "@/app/(main)/layout-server";

export type PanelMode = "panel" | "fullscreen";
export type PanelTab = "artifacts" | "resources" | "entries";

export interface GroupMessage {
  message_id: string | null;
  run_id: string | null;
  role: string | null;
  message_created_at: string | null;
  contents: string[] | null;
}

export interface UseGenerationPanelConfig {
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
  searchGroupsAction: (input: SearchGroupsIn) => Promise<SearchGroupsOut>;
}

export interface UseGenerationPanelReturn {
  // Mode
  mode: PanelMode;
  setMode: (mode: PanelMode) => void;

  // Group selection (URL-synced)
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;

  // Messages
  messages: GroupMessage[];
  totalMessageCount: number;
  isLoadingMessages: boolean;
  loadMoreMessages: () => void;
  groupName: string | null;

  // Type selection
  activeTab: PanelTab;
  setActiveTab: (tab: PanelTab) => void;
  selectedArtifactTypes: string[];
  selectedResourceTypes: string[];
  selectedEntryTypes: string[];
  toggleArtifactType: (type: string) => void;
  toggleResourceType: (type: string) => void;
  toggleEntryType: (type: string) => void;

  // Instructions
  instructions: string;
  setInstructions: (val: string) => void;

  // Server actions (pass-through for components)
  searchGroupsAction: (input: SearchGroupsIn) => Promise<SearchGroupsOut>;
}

const PAGE_SIZE = 50;

export function useGenerationPanel({
  getGroupMessagesAction,
  searchGroupsAction,
}: UseGenerationPanelConfig): UseGenerationPanelReturn {
  // Mode
  const [mode, setMode] = useState<PanelMode>("panel");

  // Group ID synced to URL
  const [urlParams, setUrlParams] = useQueryStates(
    { groupId: parseAsString },
    { history: "replace", shallow: true },
  );
  const selectedGroupId = urlParams.groupId;

  const setSelectedGroupId = useCallback(
    (id: string | null) => {
      setUrlParams({ groupId: id });
    },
    [setUrlParams],
  );

  // Messages state
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const offsetRef = useRef(0);

  // Fetch messages when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setMessages([]);
      setTotalMessageCount(0);
      setGroupName(null);
      offsetRef.current = 0;
      return;
    }

    let cancelled = false;
    setIsLoadingMessages(true);
    offsetRef.current = 0;

    getGroupMessagesAction({
      body: {
        group_id: selectedGroupId,
        page_limit: PAGE_SIZE,
        page_offset: 0,
      },
    })
      .then((res) => {
        if (cancelled) return;
        setMessages(res.messages ?? []);
        setTotalMessageCount(res.total_message_count ?? 0);
        setGroupName(res.group_name ?? null);
        offsetRef.current = (res.messages ?? []).length;
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setTotalMessageCount(0);
        setGroupName(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, getGroupMessagesAction]);

  // Load more (pagination)
  const loadMoreMessages = useCallback(() => {
    if (!selectedGroupId || isLoadingMessages) return;
    if (messages.length >= totalMessageCount) return;

    setIsLoadingMessages(true);
    getGroupMessagesAction({
      body: {
        group_id: selectedGroupId,
        page_limit: PAGE_SIZE,
        page_offset: offsetRef.current,
      },
    })
      .then((res) => {
        const newMessages = res.messages ?? [];
        setMessages((prev) => [...prev, ...newMessages]);
        offsetRef.current += newMessages.length;
      })
      .catch(() => {})
      .finally(() => setIsLoadingMessages(false));
  }, [
    selectedGroupId,
    isLoadingMessages,
    messages.length,
    totalMessageCount,
    getGroupMessagesAction,
  ]);

  // Type selection
  const [activeTab, setActiveTab] = useState<PanelTab>("resources");
  const [selectedArtifactTypes, setSelectedArtifactTypes] = useState<string[]>(
    [],
  );
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(
    [],
  );
  const [selectedEntryTypes, setSelectedEntryTypes] = useState<string[]>([]);

  const toggleArtifactType = useCallback((type: string) => {
    setSelectedArtifactTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const toggleResourceType = useCallback((type: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const toggleEntryType = useCallback((type: string) => {
    setSelectedEntryTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  // Instructions
  const [instructions, setInstructions] = useState("");

  return {
    mode,
    setMode,
    selectedGroupId,
    setSelectedGroupId,
    messages,
    totalMessageCount,
    isLoadingMessages,
    loadMoreMessages,
    groupName,
    activeTab,
    setActiveTab,
    selectedArtifactTypes,
    selectedResourceTypes,
    selectedEntryTypes,
    toggleArtifactType,
    toggleResourceType,
    toggleEntryType,
    instructions,
    setInstructions,
    searchGroupsAction,
  };
}
