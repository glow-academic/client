"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronsUpDown, FileText, Image, Loader2, Mic, Plus, Search, Send, ShieldAlert, ShieldCheck, Video, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useGenerationPanelContext } from "@/contexts/generation-panel-context";
import { useSocket } from "@/contexts/socket-context";
import { useArtifactGeneration } from "@/hooks/use-artifact-generation";
import { useGenerate } from "@/hooks/use-generate";
import type { GenerateMessage } from "@/hooks/use-generate";
import type { GroupMessagesIn, GroupMessagesOut, GroupSearchIn, GroupSearchOut } from "@/app/(main)/layout-server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupSearchItem {
  id: string;
  name: string;
  updatedAt: string;
}

/** Flattened historical message from /group/get skeleton */
interface HistoricalMessage {
  id: string;
  role: string;
  textIds: string[];
  audioIds: string[];
  imageIds: string[];
  videoIds: string[];
  fileIds: string[];
  callIds: string[];
  calls: { id: string; templateName: string | null }[];
}

interface GenerationPanelProps {
  panelOpen: boolean;
  onToggle: () => void;
  // Layout-level fallbacks (non-migrated pages)
  searchGroupsAction?: (input: GroupSearchIn) => Promise<GroupSearchOut>;
  getGroupMessagesAction?: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
  // Direct props (migrated pages — when artifactType is provided)
  artifactType?: string;
  groupId?: string | null;
  generateAction?: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  permissions?: Array<{ artifact: string; operation: string }>;
  getGroupHistory?: (groupId: string) => Promise<Record<string, unknown>>;
  searchGroups?: (query: string) => Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString();
}

/** Flatten runs → messages from the /group/get response */
function flattenMessages(res: GroupMessagesOut | Record<string, unknown>): HistoricalMessage[] {
  const flat: HistoricalMessage[] = [];
  for (const runWithMessages of (res as Record<string, unknown>).runs as Array<Record<string, unknown>> ?? []) {
    const messages = runWithMessages.messages as Array<Record<string, unknown>> ?? [];
    for (const msg of messages) {
      flat.push({
        id: msg.id ? String(msg.id) : crypto.randomUUID(),
        role: (msg.role as string) ?? "assistant",
        textIds: ((msg.text_ids as string[]) ?? []).map(String),
        audioIds: ((msg.audio_ids as string[]) ?? []).map(String),
        imageIds: ((msg.image_ids as string[]) ?? []).map(String),
        videoIds: ((msg.video_ids as string[]) ?? []).map(String),
        fileIds: ((msg.file_ids as string[]) ?? []).map(String),
        callIds: ((msg.call_ids as string[]) ?? []).map(String),
        calls: ((msg.calls as Array<Record<string, unknown>>) ?? []).map((c) => ({
          id: String(c.id),
          templateName: (c.template_name as string) ?? (c.tool_name as string) ?? null,
        })),
      });
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationPanel({
  panelOpen, onToggle,
  searchGroupsAction, getGroupMessagesAction,
  artifactType, groupId: groupIdProp, generateAction, permissions,
  getGroupHistory, searchGroups,
}: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");
  const [dangerousMode, setDangerousMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDirectMode = !!artifactType;

  // Context fallback (non-migrated pages)
  const panelContext = useGenerationPanelContext();
  const { socket, isConnected } = useSocket();

  // Resolve effective values: direct prop → context → null
  const effectiveGroupId = groupIdProp ?? panelContext?.groupId ?? null;
  const effectiveOnGenerate = generateAction ? null : (panelContext?.onGenerate ?? null);
  const effectiveGroupCompletedEvent = isDirectMode
    ? `${artifactType}.group.completed`
    : (panelContext?.groupCompletedEvent ?? null);

  // Selected group — defaults to effective, can be changed via picker
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const activeGroupId = selectedGroupId ?? effectiveGroupId;

  // Listen for group completed event
  useEffect(() => {
    if (!socket || !isConnected || !effectiveGroupCompletedEvent) return;

    const s = socket as unknown as {
      on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
      off: (event: string, handler: (data: Record<string, unknown>) => void) => void;
    };

    const handleNameCompleted = (data: Record<string, unknown>) => {
      const name = data.name as string;
      if (name) {
        setSelectedGroupName(name);
      }
    };

    s.on(effectiveGroupCompletedEvent, handleNameCompleted);
    return () => { s.off(effectiveGroupCompletedEvent, handleNameCompleted); };
  }, [socket, isConnected, effectiveGroupCompletedEvent]);

  // AI generation — direct mode uses internal listener, context mode uses external
  const internalListener = useArtifactGeneration(
    isDirectMode ? artifactType! : null,
    activeGroupId,
  );
  const contextListener = panelContext?.generationListener ?? null;
  const { generate: runGenerateSocket, messages: fallbackMessages, isGenerating: fallbackIsGenerating, clearMessages: fallbackClearMessages } = useGenerate({
    permissions: [],
    resources: [],
    groupId: activeGroupId,
  });

  // Resolve live messages/state: direct → context → fallback
  const liveMessages = isDirectMode
    ? internalListener.messages.map((m) => ({
        role: m.role, text: m.text, type: m.type,
        toolName: m.toolName,
        toolStatus: m.toolStatus === "pending" ? undefined : m.toolStatus,
      } as GenerateMessage))
    : contextListener
      ? contextListener.messages.map((m) => ({
          role: m.role, text: m.text, type: m.type,
          toolName: m.toolName,
          toolStatus: m.toolStatus === "pending" ? undefined : m.toolStatus,
        } as GenerateMessage))
      : fallbackMessages;
  const isGenerating = isDirectMode
    ? internalListener.isGenerating
    : (contextListener ? contextListener.isGenerating : fallbackIsGenerating);
  const clearMessages = isDirectMode
    ? internalListener.clearMessages
    : (contextListener ? contextListener.clearMessages : fallbackClearMessages);

  // Historical messages from /group/get
  const [historicalMessages, setHistoricalMessages] = useState<HistoricalMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Text content cache: textUploadId → text string
  const [textContent, setTextContent] = useState<Record<string, string>>({});

  // Fetch historical messages when a group is active (selected or context)
  // Also refetch after generation completes to pick up new messages
  const prevIsGenerating = useRef(false);
  useEffect(() => {
    // Detect generation completion (was generating, now not)
    const justFinished = prevIsGenerating.current && !isGenerating;
    prevIsGenerating.current = isGenerating;

    const groupToFetch = selectedGroupId ?? effectiveGroupId;
    if (!groupToFetch) {
      setHistoricalMessages([]);
      setTextContent({});
      return;
    }

    // Only fetch on mount, group change, or generation completion
    if (!justFinished && historicalMessages.length > 0) return;

    // Clear live messages when refetching (they'll be in history now)
    if (justFinished) {
      clearMessages();
    }

    let cancelled = false;
    setIsLoadingHistory(true);

    // Use direct prop → context override → layout fallback
    const effectiveGetHistory = getGroupHistory ?? panelContext?.getGroupHistory;
    const fetchHistory = effectiveGetHistory
      ? effectiveGetHistory(groupToFetch)
      : getGroupMessagesAction?.({ body: { group_id: groupToFetch } }) ?? Promise.resolve({ runs: [] });

    fetchHistory
      .then(async (res) => {
        if (cancelled) return;
        const messages = flattenMessages(res);
        setHistoricalMessages(messages);

        // Collect all text upload IDs and fetch content in parallel
        const allTextIds = messages.flatMap((m) => m.textIds);
        if (allTextIds.length > 0) {
          const entries = await Promise.all(
            allTextIds.map(async (id) => {
              try {
                const r = await fetch(`/api/group/text/${id}`);
                if (!r.ok) return [id, ""] as const;
                return [id, await r.text()] as const;
              } catch {
                return [id, ""] as const;
              }
            }),
          );
          if (!cancelled) {
            setTextContent(Object.fromEntries(entries));
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHistoricalMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, effectiveGroupId, isGenerating, getGroupMessagesAction, getGroupHistory]);

  // Search state
  const [chatSearch, setChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<GroupSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch groups — direct prop → context override → layout fallback
  const effectiveSearchGroups = searchGroups ?? panelContext?.searchGroupsOverride ?? null;
  const fetchGroups = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const res = effectiveSearchGroups
          ? await effectiveSearchGroups(query.trim())
          : searchGroupsAction
            ? await searchGroupsAction({ body: { search: query.trim() || null } })
            : { items: [] };
        const mapped = (res.items ?? []).map((item: Record<string, unknown>) => ({
          id: String(item.group_id),
          name: (item.group_name as string) || "Untitled",
          updatedAt: formatRelativeTime((item.last_run_at ?? item.created_at) as unknown as string),
        }));
        mapped.sort((a, b) => {
          const aUntitled = a.name === "Untitled" ? 1 : 0;
          const bUntitled = b.name === "Untitled" ? 1 : 0;
          return aUntitled - bUntitled;
        });
        setSearchResults(mapped);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchGroupsAction, effectiveSearchGroups],
  );

  const handleDropdownOpen = useCallback(
    (open: boolean) => {
      if (open) fetchGroups(chatSearch);
    },
    [fetchGroups, chatSearch],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setChatSearch(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      setIsSearching(true);
      searchDebounceRef.current = setTimeout(() => fetchGroups(value), 500);
    },
    [fetchGroups],
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [instructions]);

  const handleSelectGroupWithClear = useCallback(
    (group: GroupSearchItem) => {
      setSelectedGroupId(group.id);
      setSelectedGroupName(group.name);
      setChatSearch("");
      setSearchResults([]);
      clearMessages();
    },
    [clearMessages],
  );

  const handleNewChatWithClear = useCallback(() => {
    setSelectedGroupId(null);
    setSelectedGroupName(null);
    setHistoricalMessages([]);
    setTextContent({});
    setChatSearch("");
    setSearchResults([]);
    setInstructions("");
    clearMessages();
    // Clear context group so next generation creates a fresh one (non-direct mode)
    if (!isDirectMode && panelContext) {
      panelContext.setGroupId(null);
    }
  }, [clearMessages, panelContext, isDirectMode]);

  const handleSend = useCallback(async () => {
    if (!instructions.trim()) return;
    const text = instructions.trim();
    setInstructions("");
    const socketId = (socket as unknown as { id?: string })?.id;

    if (isDirectMode && generateAction) {
      // Direct mode — call server action with full request body
      internalListener.setGenerating(true);
      await generateAction({
        body: {
          group_id: activeGroupId,
          permissions: permissions ?? [],
          resource_types: [],
          user_instructions: text ? [text] : [],
          dangerous: dangerousMode,
          sid: socketId,
        },
      });
    } else if (effectiveOnGenerate) {
      // Context mode — delegate to artifact page callback
      if (contextListener?.setGenerating) contextListener.setGenerating(true);
      await effectiveOnGenerate({ resource_types: [], instructions: text, dangerous: dangerousMode, sid: socketId });
    } else {
      runGenerateSocket(text);
    }
  }, [instructions, dangerousMode, generateAction, effectiveOnGenerate, runGenerateSocket, isDirectMode, activeGroupId, permissions, contextListener, internalListener, socket]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const displayName = selectedGroupName ?? "New Chat";
  const displaySubtext = selectedGroupId ? "Previous session" : "Current session";

  const hasMessages = historicalMessages.length > 0 || liveMessages.length > 0;

  // ---- Renderers ----

  const renderHistoricalMessage = (msg: HistoricalMessage, i: number) => {
    // Skip system/developer messages — they're prompt context, not conversation
    if (msg.role === "system" || msg.role === "developer") return null;

    const parts: React.ReactNode[] = [];
    const hasToolCalls = msg.calls.length > 0;

    // Tool calls
    for (const call of msg.calls) {
      parts.push(
        <div key={`call-${call.id}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{call.templateName || "tool_call"}</span>
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
          </div>
        </div>,
      );
    }

    // Text uploads — only render standalone text (skip if message has tool calls,
    // since those text_ids are just rendered tool output, not assistant text)
    if (!hasToolCalls) for (const textId of msg.textIds) {
      const content = textContent[textId];
      parts.push(
        <div key={`text-${textId}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent border"
          }`}>
            {content ? (
              <span className="whitespace-pre-wrap">{content}</span>
            ) : (
              <div className="flex items-center gap-1.5 text-xs opacity-70">
                <FileText className="h-3 w-3" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>,
      );
    }

    // Image uploads
    if (msg.imageIds.length > 0) {
      parts.push(
        <div key={`img-${msg.id}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-lg border bg-accent px-3 py-2">
            <Image className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {msg.imageIds.length} image{msg.imageIds.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>,
      );
    }

    // Audio uploads
    if (msg.audioIds.length > 0) {
      parts.push(
        <div key={`audio-${msg.id}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-lg border bg-accent px-3 py-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {msg.audioIds.length} audio{msg.audioIds.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>,
      );
    }

    // Video uploads
    if (msg.videoIds.length > 0) {
      parts.push(
        <div key={`video-${msg.id}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-lg border bg-accent px-3 py-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {msg.videoIds.length} video{msg.videoIds.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>,
      );
    }

    // File uploads
    if (msg.fileIds.length > 0) {
      parts.push(
        <div key={`file-${msg.id}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-lg border bg-accent px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {msg.fileIds.length} file{msg.fileIds.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>,
      );
    }

    // If message has nothing (no uploads, no calls), show empty role bubble
    if (parts.length === 0) {
      return null;
    }

    return <React.Fragment key={`hist-${i}`}>{parts}</React.Fragment>;
  };

  const renderLiveMessage = (msg: GenerateMessage, i: number) => {
    if (msg.type === "tool") {
      const isError = msg.toolStatus === "error";
      const isPending = !msg.toolStatus;
      return (
        <div key={`live-${i}`} className="flex justify-start">
          <div className="max-w-[85%] flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3 shrink-0" />
            <span className="flex-1 truncate">{msg.toolName}</span>
            {isPending ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            ) : isError ? (
              <XCircle className="h-3 w-3 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={`live-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent border"
        }`}>
          {msg.text}
        </div>
      </div>
    );
  };

  return (
    <SidebarProvider
      open={panelOpen}
      onOpenChange={onToggle}
      cookieName="glow_panel"
      className="!min-h-0 !w-auto flex-none"
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu onOpenChange={handleDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-medium truncate">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{displaySubtext}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 max-h-72 overflow-y-auto rounded-lg"
                  align="start"
                >
                  <div className="p-2">
                    <div className="relative">
                      <Label htmlFor="chat-picker-search" className="sr-only">Search chats</Label>
                      <SidebarInput
                        id="chat-picker-search"
                        placeholder="Search chats..."
                        value={chatSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-8"
                      />
                      <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
                    </div>
                  </div>
                  {isSearching && (
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!isSearching && searchResults.length > 0 &&
                    searchResults.map((group) => (
                      <DropdownMenuItem
                        key={group.id}
                        onClick={() => handleSelectGroupWithClear(group)}
                        className={activeGroupId === group.id ? "bg-accent" : ""}
                      >
                        <div className="flex flex-col gap-0.5 leading-none">
                          <span className="truncate">{group.name}</span>
                          <span className="text-xs text-muted-foreground">{group.updatedAt}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  {!isSearching && searchResults.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">No chats found</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          {selectedGroupId && (
            <Button
              variant="outline"
              size="sm"
              className="mx-2 mb-1 justify-start"
              onClick={handleNewChatWithClear}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          )}
        </SidebarHeader>

        <SidebarContent className="flex flex-col p-0">
          {isLoadingHistory ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasMessages ? (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pl-3 pr-3 py-3">
              {historicalMessages.map((msg, i) => renderHistoricalMessage(msg, i))}
              {liveMessages.map((msg, i) => renderLiveMessage(msg, i))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-accent border px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3">
              {[
                { label: "Generate a persona", instruction: "Create a new persona with a unique personality, communication style, and background." },
                { label: "Build a scenario", instruction: "Design a scenario with objectives, problem statement, and evaluation criteria." },
                { label: "Draft a rubric", instruction: "Create a rubric with clear criteria, point values, and performance levels." },
              ].map((suggestion) => (
                <button
                  key={suggestion.label}
                  onClick={() => setInstructions(suggestion.instruction)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </SidebarContent>

        <SidebarFooter className="p-0">
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Instructions..."
                rows={2}
                className="min-h-0 max-h-32 flex-1 resize-none overflow-y-auto text-sm"
              />
              <TooltipProvider>
                <div className="flex flex-col gap-1 self-end shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={dangerousMode ? "destructive" : "outline"}
                        className="h-9 w-9"
                        onClick={() => setDangerousMode((prev) => !prev)}
                      >
                        {dangerousMode ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{dangerousMode ? "Dangerous: executes immediately" : "Safe: review before accepting"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button
                          size="icon"
                          className="h-9 w-9"
                          onClick={handleSend}
                          disabled={isGenerating || !instructions.trim()}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
