"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronsUpDown, FileText, Image, Loader2, Mic, Search, Send, ShieldAlert, ShieldCheck, SquarePen, Video, Wrench, X, XCircle } from "lucide-react";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { useTransport } from "@/lib/transport";
import type { GenerationMessage as GenerateMessage } from "@/hooks/use-artifact-generation";
import { useSharedGenerationListener } from "@/hooks/use-artifact-generation-context";
import { useQueryState, parseAsString } from "nuqs";

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

/** Server action shape — pages define `"use server"` async fns and pass
 *  them in. The runtime call still hits the API, but goes via the Next.js
 *  server boundary, where ``getAuthHeaders()`` injects the Authorization
 *  header. Calling ``api.post`` from a client component runs in the browser
 *  with no auth header → 401. Server actions are the canonical fix.
 */
type GroupAction = (
  input: { body: { group_id?: string } },
) => Promise<Record<string, unknown>>;
type GenerationsAction = (
  input: { body: { search?: string | null } },
) => Promise<Record<string, unknown>>;
type GenerateAction = (
  input: {
    body: {
      instructions?: string[];
      config?: Record<string, unknown>;
    };
  },
) => Promise<Record<string, unknown>>;

interface GenerationPanelProps {
  /** Artifact type — used for both event namespacing and route prefix (e.g. "persona" → /persona/*) */
  artifactType: string;
  groupId: string | null;
  /** SSR-fetched display name for `groupId`. Source of truth for the
   *  header label so it survives remounts/refreshes (local picker
   *  state alone would reset). `null` when the group has no name on
   *  the server — panel falls back to "New Chat". */
  groupName?: string | null;
  /** SSR-fetched group response — used to seed ``historicalMessages``
   *  synchronously on mount, eliminating the duplicate client-side
   *  ``getGroupAction`` refetch that otherwise causes a hydration
   *  flicker. Pass the page's `groupResult` directly. */
  initialGroupHistory?: Record<string, unknown> | null;
  operations: string[];
  prompts?: Record<string, Array<{ title: string; content: string }>>;
  /** Server action: POST /{artifactType}/group — fetch run history for a group.
   *  Optional during migration; when omitted falls back to transport.send
   *  (which 401s in the browser — that's the bug we're rolling out the fix for). */
  getGroupAction?: GroupAction;
  /** Server action: POST /{artifactType}/generations — search prior groups. */
  searchGenerationsAction?: GenerationsAction;
  /** Server action: POST /{artifactType}/generate — kick off a generation run. */
  runGenerateAction?: GenerateAction;
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
  artifactType, groupId: groupIdProp, groupName: groupNameProp,
  initialGroupHistory, operations, prompts,
  getGroupAction, searchGenerationsAction, runGenerateAction,
}: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");
  // Dangerous mode (auto-execute) is persisted per-artifact in localStorage so
  // each artifact's panel remembers the last preference. Default = true to
  // match the prior hardcoded behavior.
  const dangerousStorageKey = `glow.generationPanel.dangerous.${artifactType}`;
  const [dangerousMode, setDangerousModeState] = useState<boolean>(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(dangerousStorageKey);
    if (stored != null) setDangerousModeState(stored === "1");
  }, [dangerousStorageKey]);
  const setDangerousMode = useCallback(
    (value: boolean) => {
      setDangerousModeState(value);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(dangerousStorageKey, value ? "1" : "0");
      }
    },
    [dangerousStorageKey],
  );
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

  // AI generation listener — shared with the page's form (e.g. Persona.tsx)
  // via GenerationListenerProvider so the same `(artifactType, groupId)`
  // pair only registers ONE set of transport subscriptions across the
  // whole tree. FullPageLayout mounts the provider whenever `panelProps`
  // is present; this component is only rendered inside that branch.
  const listener = useSharedGenerationListener();

  // Selected group — URL-backed via nuqs, owned by the
  // GenerationListenerProvider so both the panel and the form share
  // one writer. The page's SSR loader reads the same `?groupId=` and
  // pre-fetches the picked group, so there's no post-hydration
  // refetch flicker. Pre-latched BEFORE generate (in handleSend
  // below) so a refresh mid-flight lands on the same group.
  const selectedGroupId = listener.selectedGroupId;
  const setSelectedGroupId = listener.latchGroupId;
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(
    null,
  );
  const activeGroupId = selectedGroupId ?? groupIdProp;

  // Listen for group completed event via transport
  useEffect(() => {
    return transport.on(`${artifactType}.group.completed`, (data) => {
      const name = data.name as string;
      if (name) setSelectedGroupName(name);
    });
  }, [transport, artifactType]);

  const liveMessages = listener.messages.map((m) => ({
    role: m.role, text: m.text, type: m.type,
    toolName: m.toolName,
    toolStatus: m.toolStatus === "pending" ? undefined : m.toolStatus,
  } as GenerateMessage));
  const isGenerating = listener.isGenerating;
  const clearMessages = listener.clearMessages;

  // Historical messages from /group/get. Seeded from the SSR-fetched
  // `initialGroupHistory` so the panel renders the right runs
  // synchronously on first paint — no client-side refetch flicker.
  // `useState(initializer)` runs only on the first render; subsequent
  // group changes go through the effect below as usual.
  const [historicalMessages, setHistoricalMessages] = useState<HistoricalMessage[]>(
    () => (initialGroupHistory ? flattenMessages(initialGroupHistory) : []),
  );
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

    // "Fresh chat" intent overrides everything — render empty,
    // ignore the SSR-fetched windowed default's runs.
    if (listener.forceNewChat) {
      setHistoricalMessages([]);
      setTextContent({});
      return;
    }

    const groupToFetch = selectedGroupId ?? groupIdProp;
    if (!groupToFetch) {
      setHistoricalMessages([]);
      setTextContent({});
      return;
    }

    // SSR seed is valid as long as the active group still equals the
    // page's SSR-fetched ``groupIdProp`` and we're not refetching
    // after a just-finished generation (which has new runs to pick
    // up). Note we deliberately DON'T gate on ``!selectedGroupId`` —
    // pre-latching the URL with the same value as ``groupIdProp``
    // would otherwise force a redundant refetch of identical data.
    if (
      !justFinished &&
      initialGroupHistory &&
      groupToFetch === groupIdProp
    ) {
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

    const fetchHistory = getGroupAction
      ? getGroupAction({ body: { group_id: groupToFetch } })
      : transport.send(`/${artifactType}/group`, { group_id: groupToFetch });

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
  }, [selectedGroupId, groupIdProp, isGenerating, getGroupAction, transport, artifactType, listener.forceNewChat]);

  // Search state — URL-backed via nuqs so the filter survives refresh
  // and is sharable, mirroring the persona page's filter pattern.
  // Reads/writes ``?groupSearch=…`` (cleared when empty for a clean URL).
  const [chatSearchUrl, setChatSearchUrl] = useQueryState(
    "groupSearch",
    parseAsString,
  );
  const chatSearch = chatSearchUrl ?? "";
  const setChatSearch = useCallback(
    (value: string) => {
      // Empty string ⇒ remove the param from the URL (no clutter).
      void setChatSearchUrl(value || null);
    },
    [setChatSearchUrl],
  );
  const [searchResults, setSearchResults] = useState<GroupSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch groups via transport
  const fetchGroups = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const res = searchGenerationsAction
          ? await searchGenerationsAction({ body: { search: query.trim() || null } })
          : await transport.send(`/${artifactType}/generations`, { search: query.trim() || null });
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
    [searchGenerationsAction, transport, artifactType],
  );

  const handleDropdownOpen = useCallback(
    (open: boolean) => {
      if (open) {
        // Reopening — refetch with whatever the URL says (a deep link
        // can preload a filter; a fresh open shows everything).
        fetchGroups(chatSearch);
      } else {
        // Closing — drop the URL-backed filter, mirroring the
        // persona-page picker pattern (GenericPicker.tsx:326-338):
        // the search term only lives in the URL while the picker is
        // open; closing it clears the param so the URL doesn't
        // accumulate stale filter state.
        setChatSearch("");
        setSearchResults([]);
      }
    },
    [fetchGroups, chatSearch, setChatSearch],
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

  // Auto-resize textarea — clamp single-line height to the send button's
  // 36px (h-9) so an empty input lines up with the button instead of
  // collapsing shorter than it.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(36, Math.min(textarea.scrollHeight, 128))}px`;
    }
  }, [instructions]);

  const handleSelectGroupWithClear = useCallback(
    (group: GroupSearchItem) => {
      setSelectedGroupId(group.id);
      setSelectedGroupName(group.name);
      setChatSearch("");
      setSearchResults([]);
      clearMessages();
      // Picking an existing chat overrides any "fresh chat" intent.
      listener.setForceNewChat(false);
    },
    [clearMessages, listener, setSelectedGroupId, setChatSearch],
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
    // Set the transient "fresh chat intent" flag — panel will render
    // empty state and ignore the SSR-fetched windowed default until
    // the user actually generates. Reset on first send (in
    // handleSend) and reset by handleSelectGroupWithClear.
    listener.setForceNewChat(true);
  }, [clearMessages, listener, setSelectedGroupId, setChatSearch]);

  const handleSend = useCallback(async () => {
    if (!instructions.trim()) return;
    const text = instructions.trim();
    setInstructions("");

    try {
      listener.setGenerating(true);
      // "Fresh chat" intent: send no group_id so the server allocates
      // a new one. The latch happens via the response (server returns
      // the allocated id; the audit/forwarder path includes it on
      // events). Reset the flag — the chat is committing right now.
      const sendGroupId = listener.forceNewChat ? null : activeGroupId;
      if (listener.forceNewChat) {
        listener.setForceNewChat(false);
      } else if (activeGroupId) {
        // Normal path: pre-latch the URL to the group we're about to
        // target. If the user refreshes mid-flight, SSR resolves
        // back to this same group and picks up the in-progress run.
        listener.latchGroupId(activeGroupId);
      }
      const generateBody = {
        instructions: text ? [text] : [],
        config: {
          operations,
          // Hardcoded: dangerous toggle is hidden in the UI; every
          // generate runs in auto-execute mode.
          dangerous: true,
          group_id: sendGroupId,
        },
      };
      if (runGenerateAction) {
        await runGenerateAction({ body: generateBody });
      } else {
        await transport.send(`/${artifactType}/generate`, generateBody);
      }
    } catch (err) {
      listener.setError(
        err instanceof Error ? err.message : "Generate request failed",
      );
    }
  }, [instructions, dangerousMode, runGenerateAction, transport, artifactType, activeGroupId, operations, listener]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Display name precedence:
  //   1. ``selectedGroupName`` — transient local override set the
  //      moment the user picks a chat from the dropdown (snappy UI;
  //      lost on remount).
  //   2. ``groupNameProp`` — SSR-fetched name from the page's
  //      ``/<art>/group`` response. Stable across remounts/refreshes
  //      because the page re-runs SSR with the URL's ``?groupId=``.
  //   3. Fallback: ``"Untitled"`` when a group is selected but
  //      server-side name is null — keeps wording consistent with
  //      the dropdown items (which also say "Untitled" for
  //      null-named groups). ``"New Chat"`` when no group is
  //      selected at all (the genuinely-new session).
  // While the user has explicitly clicked "New Chat" (forceNewChat),
  // ignore SSR-derived names and show the fresh-chat label —
  // matches the empty render below.
  const displayName = listener.forceNewChat
    ? "New Chat"
    : selectedGroupName ??
      groupNameProp ??
      (selectedGroupId ? "Untitled" : "New Chat");
  const displaySubtext = listener.forceNewChat
    ? "Current session"
    : selectedGroupId
      ? "Previous session"
      : "Current session";

  const hasMessages = historicalMessages.length > 0 || liveMessages.length > 0;

  // ---- Renderers ----

  const renderHistoricalMessage = (msg: HistoricalMessage, i: number) => {
    // Skip system/developer messages — they're prompt context, not conversation
    if (msg.role === "system" || msg.role === "developer") return null;

    const parts: React.ReactNode[] = [];
    const hasToolCalls = msg.calls.length > 0;

    // Tool calls — alignment follows the parent message's role so that
    // user-initiated audited ops land on the user side and model-driven
    // ones on the assistant side. Mirrors how text bubbles align.
    const align = msg.role === "user" ? "justify-end" : "justify-start";
    for (const call of msg.calls) {
      parts.push(
        <div key={`call-${call.id}`} className={`flex ${align}`}>
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
        <div key={`img-${msg.id}`} className={`flex ${align}`}>
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
        <div key={`audio-${msg.id}`} className={`flex ${align}`}>
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
        <div key={`video-${msg.id}`} className={`flex ${align}`}>
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
        <div key={`file-${msg.id}`} className={`flex ${align}`}>
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
        <div key={`live-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
    <Sidebar side="right" variant="sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-1 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground has-[[data-state=open]]:bg-sidebar-accent has-[[data-state=open]]:text-sidebar-accent-foreground">
              {/* Hover lives on the parent row so the leading icon
                  and the trigger read as one continuous hover band.
                  Children opt out of their own hover/open bg via
                  ``hover:bg-transparent`` so they don't double-paint.
                  Click targets remain distinct — the icon fires
                  "new chat", the trigger opens the dropdown. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 hover:bg-transparent"
                    aria-label="New chat"
                    onClick={handleNewChatWithClear}
                  >
                    <SquarePen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New chat</TooltipContent>
              </Tooltip>
              <DropdownMenu onOpenChange={handleDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="flex-1 hover:bg-transparent hover:text-current data-[state=open]:bg-transparent data-[state=open]:text-current"
                  >
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-medium truncate">{displayName}</span>
                      <span className="text-xs text-muted-foreground">{displaySubtext}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[17rem] max-h-72 overflow-y-auto rounded-lg"
                  align="end"
                  sideOffset={4}
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
          {listener.stage === "error" && listener.error && (
            <div className="mx-3 mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{listener.error}</span>
              <button
                type="button"
                aria-label="Dismiss error"
                onClick={() => listener.setError(null)}
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Instructions..."
                rows={1}
                className="min-h-9 max-h-32 flex-1 resize-none overflow-y-auto text-sm"
              />
              <TooltipProvider>
                <div className="flex flex-col gap-1 self-end shrink-0">
                  {/* Dangerous-mode toggle hidden in UI — generation is
                      always invoked with `dangerous: true` (auto-execute).
                      Keep the state hook so the storage key + send payload
                      stay coherent. */}
                  {/*
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant={dangerousMode ? "destructive" : "outline"}
                        className="h-9 w-9"
                        onClick={() => setDangerousMode(!dangerousMode)}
                        aria-label={
                          dangerousMode
                            ? "Auto-execute on (dangerous): tool calls run immediately"
                            : "Auto-execute off: tool calls staged for approval"
                        }
                      >
                        {dangerousMode ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-[220px] text-xs">
                        {dangerousMode
                          ? "Auto-execute ON — tool calls run immediately. Click to require approval."
                          : "Auto-execute OFF — tool calls are soft-staged pending acceptance. Click to enable immediate execution."}
                      </p>
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
  );
}
