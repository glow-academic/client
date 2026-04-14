"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronsUpDown, FileText, Image, Loader2, Mic, Plus, Search, Send, ShieldAlert, ShieldCheck, Video, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  searchGroupsAction: (input: GroupSearchIn) => Promise<GroupSearchOut>;
  getGroupMessagesAction: (input: GroupMessagesIn) => Promise<GroupMessagesOut>;
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
function flattenMessages(res: GroupMessagesOut): HistoricalMessage[] {
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
          templateName: (c.template_name as string) ?? null,
        })),
      });
    }
  }
  return flat;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationPanel({ panelOpen, onToggle, searchGroupsAction, getGroupMessagesAction }: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");
  const [dangerousMode, setDangerousMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Group ID + generate callback from context (set by artifact pages)
  const panelContext = useGenerationPanelContext();
  const contextGroupId = panelContext?.groupId ?? null;
  const onGenerateProp = panelContext?.onGenerate ?? null;
  const { socket, isConnected } = useSocket();

  // Selected group — defaults to context, can be changed via picker
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const activeGroupId = selectedGroupId ?? contextGroupId;

  // Listen for group.name.completed to update the displayed name in real-time
  useEffect(() => {
    if (!socket || !isConnected) return;

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

    s.on("group.name.completed", handleNameCompleted);
    return () => { s.off("group.name.completed", handleNameCompleted); };
  }, [socket, isConnected]);

  // Historical messages from /group/get
  const [historicalMessages, setHistoricalMessages] = useState<HistoricalMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // Text content cache: textUploadId → text string
  const [textContent, setTextContent] = useState<Record<string, string>>({});

  // Fetch historical messages when a group is selected
  useEffect(() => {
    if (!selectedGroupId) {
      setHistoricalMessages([]);
      setTextContent({});
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);

    getGroupMessagesAction({
      body: { group_id: selectedGroupId },
    })
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
  }, [selectedGroupId, getGroupMessagesAction]);

  // Search state
  const [chatSearch, setChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<GroupSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch groups from server action
  const fetchGroups = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const res = await searchGroupsAction({
          body: { search: query.trim() || null },
        });
        const mapped = (res.items ?? []).map((item) => ({
          id: String(item.group_id),
          name: item.group_name || "Untitled",
          updatedAt: formatRelativeTime(item.last_run_at as unknown as string),
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
    [searchGroupsAction],
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

  // AI generation hook — event listening for streaming messages
  const { generate: runGenerateSocket, messages: liveMessages, isGenerating, clearMessages } = useGenerate({
    permissions: [],
    resources: [],
    groupId: activeGroupId,
  });

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
  }, [clearMessages]);

  const handleSend = useCallback(async () => {
    if (!instructions.trim()) return;
    const text = instructions.trim();
    setInstructions("");
    if (onGenerateProp) {
      // HTTP-based generation (artifact-specific endpoint)
      // dangerousMode=true bypasses soft (immediate execution)
      // dangerousMode=false uses soft (review first)
      await onGenerateProp({ resource_types: [], instructions: text, dangerous: dangerousMode });
    } else {
      // Fallback: socket-based generation
      runGenerateSocket(text);
    }
  }, [instructions, dangerousMode, onGenerateProp, runGenerateSocket]);

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
              <div className="flex flex-col gap-1 self-end shrink-0">
                <Button
                  size="icon"
                  variant={dangerousMode ? "destructive" : "outline"}
                  className="h-9 w-9"
                  onClick={() => setDangerousMode((prev) => !prev)}
                  title={dangerousMode ? "Dangerous mode: executes immediately" : "Safe mode: review before accepting"}
                >
                  {dangerousMode ? (
                    <ShieldAlert className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </Button>
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
              </div>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
