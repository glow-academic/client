"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ShieldCheck kept for safe-mode toggle (TODO: re-enable)
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
import { useTransport } from "@/lib/transport";
import { useArtifactGeneration } from "@/hooks/use-artifact-generation";
import type { GenerateMessage } from "@/hooks/use-generate";

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
  /** Artifact type — used for both event namespacing and route prefix (e.g. "persona" → /persona/*) */
  artifactType: string;
  groupId: string | null;
  operations: string[];
  prompts?: Record<string, Array<{ title: string; content: string }>>;
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
  artifactType, groupId: groupIdProp, operations, prompts,
}: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");
  // TODO: re-enable safe mode toggle — forced to dangerous (immediate execute) for now
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dangerousMode, setDangerousMode] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transport = useTransport();

  // Flatten operation-keyed prompts into a single list for the caller's operations
  const allPrompts = useMemo(() => {
    if (!prompts) return [];
    const ops = new Set(operations);
    const flat: Array<{ title: string; content: string }> = [];
    for (const [op, items] of Object.entries(prompts)) {
      if (ops.has(op)) flat.push(...items);
    }
    // Also include prompts for operations not in the ops set (fill to 3)
    for (const [op, items] of Object.entries(prompts)) {
      if (!ops.has(op) && flat.length < 3) flat.push(...items);
    }
    return flat;
  }, [prompts, operations]);
  const [promptOffset, setPromptOffset] = useState(0);
  const visiblePrompts = useMemo(() => {
    if (allPrompts.length <= 3) return allPrompts;
    const result: typeof allPrompts = [];
    for (let i = 0; i < 3; i++) {
      result.push(allPrompts[(promptOffset + i) % allPrompts.length]);
    }
    return result;
  }, [allPrompts, promptOffset]);

  // Selected group — defaults to prop, can be changed via picker
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const activeGroupId = selectedGroupId ?? groupIdProp;

  // Listen for group completed event via transport
  useEffect(() => {
    return transport.on(`${artifactType}.group.completed`, (data) => {
      const name = data.name as string;
      if (name) setSelectedGroupName(name);
    });
  }, [transport, artifactType]);

  // AI generation — internal listener parameterized by artifactType
  const listener = useArtifactGeneration(artifactType, activeGroupId);

  const liveMessages = listener.messages.map((m) => ({
    role: m.role, text: m.text, type: m.type,
    toolName: m.toolName,
    toolStatus: m.toolStatus === "pending" ? undefined : m.toolStatus,
  } as GenerateMessage));
  const isGenerating = listener.isGenerating;
  const clearMessages = listener.clearMessages;

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

    const groupToFetch = selectedGroupId ?? groupIdProp;
    if (!groupToFetch) {
      setHistoricalMessages([]);
      setTextContent({});
      return;
    }

    // Clear stale state before fetching the new group's history.
    // `historicalMessages` + `textContent` are keyed to the previous group and
    // will otherwise bleed through until the new fetch resolves.
    if (!justFinished) {
      setHistoricalMessages([]);
      setTextContent({});
    }

    // Clear live messages when refetching (they'll be in history now)
    if (justFinished) {
      clearMessages();
    }

    let cancelled = false;
    setIsLoadingHistory(true);

    const fetchHistory = transport.send(`/${artifactType}/group`, { group_id: groupToFetch });

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
                const r = await fetch(`/api/system/text/${id}`);
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
  }, [selectedGroupId, groupIdProp, isGenerating, transport, artifactType]);

  // Search state
  const [chatSearch, setChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<GroupSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch groups via transport
  const fetchGroups = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const res = await transport.send(`/${artifactType}/generations`, { search: query.trim() || null });
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
    [transport, artifactType],
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
  }, [clearMessages]);

  const handleSend = useCallback(async () => {
    if (!instructions.trim()) return;
    const text = instructions.trim();
    setInstructions("");
    const socketId = (socket as unknown as { id?: string })?.id;

    listener.setGenerating(true);
    await transport.send(`/${artifactType}/generate`, {
      instructions: text ? [text] : [],
      config: {
        operations,
        dangerous: dangerousMode,
        group_id: activeGroupId,
      },
    });
  }, [instructions, dangerousMode, transport, artifactType, activeGroupId, operations, listener]);

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
              {visiblePrompts.map((prompt) => (
                <button
                  key={prompt.title}
                  onClick={() => {
                    setInstructions(prompt.content);
                    if (allPrompts.length > 3) setPromptOffset((o) => o + 1);
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {prompt.title}
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
                rows={1}
                className="min-h-0 max-h-32 flex-1 resize-none overflow-y-auto text-sm"
              />
              <TooltipProvider>
                <div className="flex flex-col gap-1 self-end shrink-0">
                  {/* Dangerous-mode toggle hidden — safe mode not wired up, dangerousMode is hard-coded true.
                      Restore this block when re-enabling the toggle:
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-9 w-9"
                        onClick={() => setDangerousMode((prev) => !prev)}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Dangerous: executes immediately</p>
                    </TooltipContent>
                  </Tooltip>
                  */}
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
