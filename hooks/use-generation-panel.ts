/**
 * useGenerationPanel
 *
 * Manages AI generation panel state:
 * - Messages fetching and pagination (via server action)
 * - Type selection (artifacts, resources, entries)
 * - Instructions text
 *
 * The group_id is injected by page context, not selected by the user.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useGroupIdOptional } from "@/contexts/group-context";
import type {
  GroupMessagesIn,
  GroupMessagesOut,
} from "@/app/(main)/layout-server";
import type { TypeItem } from "@/components/common/ai/types";

export type PanelTab = "artifacts" | "resources" | "entries";

export interface GroupMessage {
  message_id: string | null;
  run_id: string | null;
  role: string | null;
  message_created_at: string | null;
  text_upload_ids: string[] | null;
  audio_upload_ids: string[] | null;
  image_upload_ids: string[] | null;
  video_upload_ids: string[] | null;
  file_upload_ids: string[] | null;
  call_upload_ids: string[] | null;
}

const PANEL_COOKIE = "glow_ai_panel";

export interface UseGenerationPanelConfig {
  /** Group ID injected by the page context. Falls back to GroupContext if not provided. */
  groupId: string | null;
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
  /** Initial panel open state from SSR cookie */
  initialPanelOpen?: boolean;
  /** Valid type lists — selections default to all */
  validArtifactTypes?: TypeItem[];
  validResourceTypes?: TypeItem[];
  validEntryTypes?: TypeItem[];
}

export interface UseGenerationPanelReturn {
  // Panel visibility
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

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
}

const PAGE_SIZE = 50;

function typeItemKeys(items: TypeItem[]): string[] {
  return items.map((i) => `${i.name}:${i.operation}`);
}

/** Flatten messages from nested runs[].messages[] into a flat array. */
function flattenRunMessages(res: GroupMessagesOut): GroupMessage[] {
  const flat: GroupMessage[] = [];
  for (const runWithMessages of res.runs ?? []) {
    for (const msg of runWithMessages.messages ?? []) {
      flat.push({
        message_id: msg.id ? String(msg.id) : null,
        run_id: runWithMessages.run?.id ? String(runWithMessages.run.id) : null,
        role: msg.role ?? null,
        message_created_at: null,
        text_upload_ids: msg.text_upload_ids?.map(String) ?? null,
        audio_upload_ids: msg.audio_upload_ids?.map(String) ?? null,
        image_upload_ids: msg.image_upload_ids?.map(String) ?? null,
        video_upload_ids: msg.video_upload_ids?.map(String) ?? null,
        file_upload_ids: msg.file_upload_ids?.map(String) ?? null,
        call_upload_ids: msg.call_upload_ids?.map(String) ?? null,
      });
    }
  }
  return flat;
}

export function useGenerationPanel({
  groupId: groupIdProp,
  getGroupMessagesAction,
  initialPanelOpen,
  validArtifactTypes = [],
  validResourceTypes = [],
  validEntryTypes = [],
}: UseGenerationPanelConfig): UseGenerationPanelReturn {
  const groupContext = useGroupIdOptional();
  const groupId = groupIdProp ?? groupContext?.groupId ?? null;

  // Stable ref for server action to avoid re-triggering effects on new references
  const getGroupMessagesRef = useRef(getGroupMessagesAction);
  getGroupMessagesRef.current = getGroupMessagesAction;

  // Panel visibility — initialised from SSR cookie
  const [panelOpen, setPanelOpenRaw] = useState(initialPanelOpen ?? false);

  // Persist open/close to cookie so it survives route changes
  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenRaw(open);
    document.cookie = `${PANEL_COOKIE}=${open}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const togglePanel = useCallback(
    () => setPanelOpenRaw((prev) => {
      const next = !prev;
      document.cookie = `${PANEL_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    }),
    [],
  );

  // Messages state
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const offsetRef = useRef(0);

  // Fetch messages when group changes
  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setTotalMessageCount(0);
      setGroupName(null);
      offsetRef.current = 0;
      return;
    }

    let cancelled = false;
    setIsLoadingMessages(true);
    offsetRef.current = 0;

    getGroupMessagesRef.current({
      body: {
        group_id: groupId,
        message_limit: PAGE_SIZE,
        message_offset: 0,
      },
    })
      .then((res) => {
        if (cancelled) return;
        const flat = flattenRunMessages(res);
        setMessages(flat);
        setTotalMessageCount(res.total_message_count ?? 0);
        setGroupName(res.group_name ?? null);
        offsetRef.current = flat.length;
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
  }, [groupId]);

  // Load more (pagination)
  const loadMoreMessages = useCallback(() => {
    if (!groupId || isLoadingMessages) return;
    if (messages.length >= totalMessageCount) return;

    setIsLoadingMessages(true);
    getGroupMessagesRef.current({
      body: {
        group_id: groupId,
        message_limit: PAGE_SIZE,
        message_offset: offsetRef.current,
      },
    })
      .then((res) => {
        const newMessages = flattenRunMessages(res);
        setMessages((prev) => [...prev, ...newMessages]);
        offsetRef.current += newMessages.length;
      })
      .catch(() => {})
      .finally(() => setIsLoadingMessages(false));
  }, [
    groupId,
    isLoadingMessages,
    messages.length,
    totalMessageCount,
  ]);

  // Type selection — default to all types selected
  const [activeTab, setActiveTab] = useState<PanelTab>("resources");
  const [selectedArtifactTypes, setSelectedArtifactTypes] = useState<string[]>(
    () => typeItemKeys(validArtifactTypes),
  );
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(
    () => typeItemKeys(validResourceTypes),
  );
  const [selectedEntryTypes, setSelectedEntryTypes] = useState<string[]>(
    () => typeItemKeys(validEntryTypes),
  );

  // Sync selections when valid types change (e.g. page navigation)
  const prevArtifactRef = useRef(validArtifactTypes);
  const prevResourceRef = useRef(validResourceTypes);
  const prevEntryRef = useRef(validEntryTypes);

  useEffect(() => {
    if (prevArtifactRef.current !== validArtifactTypes) {
      prevArtifactRef.current = validArtifactTypes;
      setSelectedArtifactTypes(typeItemKeys(validArtifactTypes));
    }
    if (prevResourceRef.current !== validResourceTypes) {
      prevResourceRef.current = validResourceTypes;
      setSelectedResourceTypes(typeItemKeys(validResourceTypes));
    }
    if (prevEntryRef.current !== validEntryTypes) {
      prevEntryRef.current = validEntryTypes;
      setSelectedEntryTypes(typeItemKeys(validEntryTypes));
    }
  }, [validArtifactTypes, validResourceTypes, validEntryTypes]);

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
    panelOpen,
    setPanelOpen,
    togglePanel,
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
  };
}
