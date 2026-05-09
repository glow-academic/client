"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronsUpDown, FileText, Image, Loader2, Mic, Search, Send, Settings2, SquarePen, Video, Wrench, X, XCircle } from "lucide-react";
import { ackOperation } from "@/lib/api/ack";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { callDownloadUrl, textDownloadUrl } from "@/lib/api/download-routes";
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
  calls: {
    id: string;
    templateName: string | null;
    /** Tool resource envelope (``GetToolResponse`` shape) when this
     *  call has a registered tool; ``null`` for audit-only events. */
    tool: Record<string, unknown> | null;
    /** Latest ``soft_calls_mv`` row for this call, stamped server-side
     *  in ``resolve_group_impl``. ``null`` when the call wasn't a soft
     *  write — those don't have a ledger entry, so they render as
     *  fully executed.
     *  See ``project_soft_calls_entry_pattern`` (api memory). */
    ledgerStatus: "pending" | "accepted" | "rejected" | null;
    ledgerOperation: string | null;
    ledgerArtifact: string | null;
    ledgerArtifactId: string | null;
  }[];
  /** Whether this message will be threaded into the LLM's context for
   *  the next generation. Mirrors the dedup pass on the server (latest
   *  read-only call per tool wins; writes always kept). When false,
   *  ``inContextReason`` explains why. */
  inContext: boolean;
  inContextReason: string;
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
/** Settings-menu preferences read from cookies at SSR time and passed
 *  into the panel as a prop. Avoids the hydration flicker that a
 *  client-side ``useEffect(cookieRead)`` would cause: server renders
 *  with the same values the client will use on first paint. The
 *  client-side toggles still write the cookies back so the next SSR
 *  navigation picks them up. */
export interface GenerationPanelPrefs {
  safeMode: boolean;
  showFullContext: boolean;
  showUserTools: boolean;
}

export const DEFAULT_GENERATION_PANEL_PREFS: GenerationPanelPrefs = {
  safeMode: false,
  showFullContext: false,
  showUserTools: false,
};

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
  /** SSR-read cookie prefs for the settings menu. Pages compute this
   *  via ``readGenerationPanelPrefs()`` (see lib/generation/panel-prefs.ts)
   *  and pass it through. Omit to use the all-false defaults — the
   *  panel still works, but the first paint will use defaults until
   *  the user toggles something. */
  initialPanelPrefs?: GenerationPanelPrefs;
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
          tool: (c.tool as Record<string, unknown> | null) ?? null,
          ledgerStatus: (c.ledger_status as "pending" | "accepted" | "rejected" | null) ?? null,
          ledgerOperation: (c.ledger_operation as string | null) ?? null,
          ledgerArtifact: (c.ledger_artifact as string | null) ?? null,
          ledgerArtifactId: (c.ledger_artifact_id as string | null) ?? null,
        })),
        inContext: msg.in_context !== false,
        inContextReason: (msg.in_context_reason as string) ?? "kept",
      });
    }
  }
  return flat;
}

/**
 * Lazy text bubble — fetches the per-artifact text-download BFF route
 * on first viewport intersection. URL is resolved via {@link
 * textDownloadUrl}, which routes to the per-artifact endpoint when the
 * artifact has been migrated and falls back to ``/api/system/...``
 * otherwise. Renders the cached body once available, the shared
 * "Loading..." placeholder until then. Refetch is suppressed via the
 * ``cached`` prop: if the parent already has the body, we skip the
 * observer entirely. ``rootMargin`` pre-fetches a screen ahead so
 * users almost never see the placeholder while scrolling.
 */
function LazyText({
  textId,
  artifactType,
  cached,
  onLoaded,
  alignClass,
  bubbleClass,
}: {
  textId: string;
  artifactType: string;
  cached: string | undefined;
  onLoaded: (id: string, text: string) => void;
  alignClass: string;
  bubbleClass: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cached !== undefined) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let cancelled = false;
    let fired = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (fired) return;
        if (!entries.some((e) => e.isIntersecting)) return;
        fired = true;
        observer.disconnect();
        void (async () => {
          try {
            const r = await fetch(textDownloadUrl(artifactType, textId));
            const text = r.ok ? await r.text() : "";
            if (!cancelled) onLoaded(textId, text);
          } catch {
            if (!cancelled) onLoaded(textId, "");
          }
        })();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [textId, artifactType, cached, onLoaded]);

  return (
    <div ref={ref} className={`flex ${alignClass}`}>
      <div className={bubbleClass}>
        {cached ? (
          <span className="whitespace-pre-wrap">{cached}</span>
        ) : (
          <div className="flex items-center gap-1.5 text-xs opacity-70">
            <FileText className="h-3 w-3" />
            <span>Loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Visual variant matching the role split used by text bubbles:
 *  user → solid primary bg + inverse text (dark/inverse style),
 *  assistant → dashed-border accent surface (default muted style).
 *  Kept as a single helper so the button and the status indicator
 *  stay in lockstep. */
function toolBubbleClasses(role: "user" | "assistant"): string {
  return role === "user"
    ? "bg-primary text-primary-foreground border-dashed border-primary-foreground/20 hover:bg-primary/90"
    : "border border-dashed text-muted-foreground hover:bg-accent";
}

/** Lazily-loaded compact Markdown renderer. The accordion lives in a
 *  narrow sidebar column, so we use the inline-sized variant
 *  (``MarkdownInline``) — no KaTeX, no syntax highlighting, no
 *  autolink-heading arrows, just GFM with tight typography. The
 *  full-page renderer (``components/common/markdown/Markdown``) blew
 *  up the layout with chat-grade heading sizes. */
const MarkdownRenderer = dynamic(
  () =>
    import("@/components/common/markdown/MarkdownInline").then((mod) => ({
      default: ({ content }: { content: string }) => (
        <mod.default>{content}</mod.default>
      ),
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading preview…</span>
      </div>
    ),
  },
);

/** Lifecycle state of a soft-eligible tool call.
 *
 *  Source of truth is the server's ``soft_calls_mv`` ledger, surfaced
 *  via ``GroupCall.ledger_status``. ``executed`` means the call wasn't a
 *  soft write at all (no ledger entry) — render no ack controls. */
type ReceiptState = "pending" | "accepted" | "rejected" | "executed";

function ledgerToReceiptState(
  ledgerStatus: "pending" | "accepted" | "rejected" | null,
): ReceiptState {
  return ledgerStatus ?? "executed";
}

/** Body of an expanded tool-call accordion.
 *
 *  Two stacked sections:
 *    - Lifecycle controls (top): when the call's ledger status is
 *      ``pending``, surface Accept / Reject buttons. Clicking fires the
 *      generic ``ackOperation`` server action against
 *      ``/<artifact>/<operation>``; the server appends the ack ledger
 *      row, and on next render the parent passes the updated status.
 *    - Receipt body (rest): Preview / Raw toggle of the call JSON. */
function CallReceiptBody({
  data,
  callId,
  ledgerStatus,
  ledgerArtifact,
  ledgerOperation,
}: {
  data: Record<string, unknown>;
  callId: string;
  /** Server-stamped ledger snapshot (see GroupCall on api side).
   *  ``null`` for non-soft calls — render no ack controls. */
  ledgerStatus: "pending" | "accepted" | "rejected" | null;
  ledgerArtifact: string | null;
  ledgerOperation: string | null;
}) {
  const output = typeof data["output"] === "string" ? (data["output"] as string) : null;
  const hasPreview = output !== null && output.trim().length > 0;
  const [mode, setMode] = useState<"preview" | "raw">(
    hasPreview ? "preview" : "raw",
  );

  // ── Lifecycle state ──────────────────────────────────────────────
  const initialState = ledgerToReceiptState(ledgerStatus);
  // Local override for optimistic update — server's accepted/rejected
  // ledger row arrives async; treat the local state as truth this render.
  const [optimisticState, setOptimisticState] = useState<ReceiptState | null>(null);
  const state = optimisticState ?? initialState;
  const route =
    ledgerArtifact && ledgerOperation
      ? { artifact: ledgerArtifact, operation: ledgerOperation }
      : null;
  const [acking, setAcking] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  const handleAck = useCallback(
    async (accept: boolean) => {
      if (!route || !callId || acking) return;
      setAcking(true);
      setAckError(null);
      // Optimistic flip — UI updates instantly. Server's ack events
      // will land on the receipt asynchronously.
      setOptimisticState(accept ? "accepted" : "rejected");
      try {
        await ackOperation({
          artifact: route.artifact,
          operation: route.operation,
          idempotencyKey: callId,
          accept,
        });
      } catch (err) {
        // Revert optimistic state and surface the error.
        setOptimisticState(null);
        setAckError(err instanceof Error ? err.message : "Ack failed");
      } finally {
        setAcking(false);
      }
    },
    [route, callId, acking],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {/* Lifecycle controls */}
      {state === "pending" && route && callId && (
        <div className="flex items-center gap-1.5 self-end text-[10px]">
          <button
            type="button"
            onClick={() => void handleAck(true)}
            disabled={acking}
            className="px-2 py-0.5 rounded transition-colors bg-green-500/15 text-green-600 hover:bg-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {acking ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
            Accept
          </button>
          <button
            type="button"
            onClick={() => void handleAck(false)}
            disabled={acking}
            className="px-2 py-0.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <X className="h-2.5 w-2.5" />
            Reject
          </button>
        </div>
      )}
      {state === "accepted" && (
        <span className="self-end text-[10px] text-green-600 flex items-center gap-1">
          <Check className="h-2.5 w-2.5" />
          Accepted
        </span>
      )}
      {state === "rejected" && (
        <span className="self-end text-[10px] text-muted-foreground flex items-center gap-1">
          <X className="h-2.5 w-2.5" />
          Rejected
        </span>
      )}
      {ackError && (
        <span className="self-end text-[10px] text-red-500">{ackError}</span>
      )}

      {/* Preview/Raw toggle */}
      {hasPreview && (
        <div className="flex items-center gap-1 self-end text-[10px]">
          <button
            type="button"
            onClick={() => setMode("preview")}
            aria-pressed={mode === "preview"}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              mode === "preview"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setMode("raw")}
            aria-pressed={mode === "raw"}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              mode === "raw"
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw
          </button>
        </div>
      )}
      {mode === "preview" && hasPreview ? (
        <div className="max-h-80 overflow-auto">
          <MarkdownRenderer content={output as string} />
        </div>
      ) : (
        <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words max-h-80 overflow-auto font-mono text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Expandable tool-call bubble — shared between the historical and the
 * live renderers. ``align`` follows the message role (right for user,
 * left for assistant). When opened, the dropdown body lazy-fetches the
 * call's persisted JSON via {@link callDownloadUrl}.
 *
 * Live messages whose ``toolStatus !== "success"`` should NOT use this —
 * they render the static {@link ToolCallStatusBubble} instead, since
 * there is no completed call_id to expand yet.
 */
function ToolCallBubble({
  callId,
  templateName,
  tool,
  role,
  align,
  expanded,
  onToggle,
  ledgerStatus = null,
  ledgerArtifact = null,
  ledgerOperation = null,
}: {
  callId: string;
  templateName: string | null;
  /** Tool resource envelope. ``null`` when no tool is registered —
   *  callers shouldn't pass undefined; pass ``null`` explicitly. */
  tool: Record<string, unknown> | null;
  role: "user" | "assistant";
  align: string;
  expanded: { id: string; data: Record<string, unknown> | null; error: string | null } | null;
  onToggle: (id: string) => void;
  /** Ledger snapshot from server. Null fields = non-soft call → no
   *  ack controls. */
  ledgerStatus?: "pending" | "accepted" | "rejected" | null;
  ledgerArtifact?: string | null;
  ledgerOperation?: string | null;
}) {
  const isOpen = expanded?.id === callId;
  const label = bubbleLabel(tool, templateName);
  const description =
    tool && typeof tool["description"] === "string" ? (tool["description"] as string) : "";
  // Outer is `flex` (row) — `justify-end` / `justify-start` controls
  // horizontal placement. Inner is `flex-col` to stack the toggle
  // button on top of the expanded JSON. Width-capping the inner
  // column keeps the bubble narrow regardless of side.
  return (
    <div className={`flex ${align}`}>
      <div className="flex flex-col gap-1 max-w-[85%]">
        <button
          type="button"
          onClick={() => onToggle(callId)}
          aria-expanded={isOpen}
          title={description || undefined}
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors text-left ${toolBubbleClasses(role)}`}
        >
          <Wrench className="h-3 w-3 shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" />
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen && (
          <div className="rounded-md border bg-muted/40 px-2.5 py-2">
            {expanded?.data ? (
              <CallReceiptBody
                data={expanded.data}
                callId={callId}
                ledgerStatus={ledgerStatus}
                ledgerArtifact={ledgerArtifact}
                ledgerOperation={ledgerOperation}
              />
            ) : expanded?.error ? (
              <span className="text-xs text-red-500">{expanded.error}</span>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Static in-flight tool-call indicator — shown while ``toolStatus`` is
 *  pending or errored. No dropdown because there's no call_id to expand
 *  yet (or the call failed). Aligns right for user, left for assistant. */
function ToolCallStatusBubble({
  toolName,
  status,
  role,
  align,
}: {
  toolName: string;
  status: "pending" | "error";
  role: "user" | "assistant";
  align: string;
}) {
  return (
    <div className={`flex ${align}`}>
      <div className={`max-w-[85%] flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${toolBubbleClasses(role)}`}>
        <Wrench className="h-3 w-3 shrink-0" />
        <span className="flex-1 truncate">{toolName}</span>
        {status === "pending" ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <XCircle className="h-3 w-3 shrink-0 text-destructive" />
        )}
      </div>
    </div>
  );
}

/** Lightweight event pill — used when an audited operation fires but
 *  has no registered tool, OR when the parent message role is ``"user"``
 *  (user-attributed audit events aren't conceptually tool calls — they're
 *  records of UI actions). Smaller than {@link ToolCallBubble}, no
 *  border, dot icon, no chevron, no expandable receipt.
 *
 *  Status reflects the audit lifecycle: pending (spinner), success
 *  (subtle dot), error (red x).
 */
function EventPill({
  name,
  status,
  align,
}: {
  name: string;
  status: "pending" | "success" | "error";
  align: string;
}) {
  return (
    <div className={`flex ${align}`}>
      <div className="max-w-[85%] flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-muted-foreground/80">
        {status === "pending" ? (
          <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
        ) : status === "error" ? (
          <XCircle className="h-2.5 w-2.5 shrink-0 text-destructive" />
        ) : (
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
        )}
        <span className="flex-1 truncate">{name}</span>
      </div>
    </div>
  );
}

/** Pick the visible label for a tool-call bubble. Prefer the registered
 *  tool's ``name`` (recognizable for tools the user configured), fall
 *  back to the title-cased operation when no tool envelope is set. */
function bubbleLabel(
  tool: Record<string, unknown> | null | undefined,
  fallback: string | null,
): string {
  const name = tool && typeof tool["name"] === "string" ? (tool["name"] as string) : null;
  return name || fallback || "tool_call";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationPanel({
  artifactType, groupId: groupIdProp, groupName: groupNameProp,
  initialGroupHistory, operations, prompts,
  getGroupAction, searchGenerationsAction,
  initialPanelPrefs = DEFAULT_GENERATION_PANEL_PREFS,
}: GenerationPanelProps) {
  const [instructions, setInstructions] = useState("");

  // Generation panel preferences — initial values come from cookies
  // read by the page at SSR time and passed in via ``initialPanelPrefs``.
  // No useEffect cookie read here, so first client paint matches SSR
  // (no hydration flicker). The setters write the cookies back so the
  // next SSR navigation picks up the change. All three defaults are
  // unchecked = sensible defaults: auto-execute on, hide stale
  // messages, hide user-fired tool clutter.
  //
  //   safeMode         — when true, tool calls are soft-staged pending
  //                      acceptance instead of running immediately. The
  //                      send payload uses ``dangerous: !safeMode``.
  //   showFullContext  — when true, render every message in the group
  //                      including ones the LLM won't see on the next
  //                      generation (deduped reads, audit-only events).
  //   showUserTools    — when true, render user-attributed tool calls
  //                      (auto-fired Context/Search/Group on page load,
  //                      etc.). Default off keeps the panel focused on
  //                      assistant-driven work.
  const [safeMode, setSafeModeState] = useState<boolean>(initialPanelPrefs.safeMode);
  const [showFullContext, setShowFullContextState] = useState<boolean>(initialPanelPrefs.showFullContext);
  const [showUserTools, setShowUserToolsState] = useState<boolean>(initialPanelPrefs.showUserTools);

  const writeCookie = useCallback((name: string, value: boolean) => {
    if (typeof document === "undefined") return;
    // 1-year max-age; SameSite=Lax so it follows top-level navigations
    // (cookies need to flow on the SSR fetch the Next.js server makes).
    document.cookie = `${name}=${value ? "1" : "0"}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  const setSafeMode = useCallback((v: boolean) => {
    setSafeModeState(v);
    writeCookie("glow.gp.safeMode", v);
  }, [writeCookie]);
  const setShowFullContext = useCallback((v: boolean) => {
    setShowFullContextState(v);
    writeCookie("glow.gp.showFullContext", v);
  }, [writeCookie]);
  const setShowUserTools = useCallback((v: boolean) => {
    setShowUserToolsState(v);
    writeCookie("glow.gp.showUserTools", v);
  }, [writeCookie]);
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

  // Header rename channel. ``*_Title`` is now the canonical rename op
  // (write); ``*_Group`` is read-only and its completed event represents
  // a fetch, not a rename, so it doesn't belong here. Payload key is
  // ``title``.
  useEffect(() => {
    return transport.on(`${artifactType}.title.completed`, (data) => {
      const title = data.title as string;
      if (title) setSelectedGroupName(title);
    });
  }, [transport, artifactType]);

  const liveMessages = listener.messages.map((m) => ({
    id: m.id,
    role: m.role, text: m.text, type: m.type,
    toolName: m.toolName,
    toolStatus: m.toolStatus === "pending" ? undefined : m.toolStatus,
    tool: m.tool,
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

  // Fetch historical messages when the selected group changes. Live
  // bubbles from ``useArtifactGeneration`` stay on screen until the
  // user navigates away — no clear/refetch dance at completion.
  useEffect(() => {
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

    // SSR seed valid when the active group still equals the page's
    // SSR-fetched ``groupIdProp``. Skip the redundant refetch.
    if (initialGroupHistory && groupToFetch === groupIdProp) {
      return;
    }

    setHistoricalMessages([]);
    setTextContent({});

    let cancelled = false;
    setIsLoadingHistory(true);

    const fetchHistory = getGroupAction
      ? getGroupAction({ body: { group_id: groupToFetch } })
      : transport.send(`/${artifactType}/group`, { group_id: groupToFetch });

    fetchHistory
      .then((res) => {
        if (cancelled) return;
        setHistoricalMessages(flattenMessages(res));
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
  }, [selectedGroupId, groupIdProp, getGroupAction, transport, artifactType, listener.forceNewChat]);

  // Per-bubble lazy fetch handler — passed to ``<LazyText>``. Bubbles
  // fetch their own body when scrolled into view (or near it) and write
  // back into the shared ``textContent`` cache so subsequent scroll-by
  // is free.
  const onTextLoaded = useCallback((id: string, text: string) => {
    setTextContent((prev) => (id in prev ? prev : { ...prev, [id]: text }));
  }, []);

  // Call expansion — at most one call's receipt in memory at a time. Click
  // to fetch + open; click again (or another) to swap. The receipt JSON
  // can be large; bounding to one keeps the panel cheap.
  const [expandedCall, setExpandedCall] = useState<{
    id: string;
    data: Record<string, unknown> | null;
    error: string | null;
  } | null>(null);

  const toggleCall = useCallback(async (callId: string) => {
    let shouldFetch = true;
    setExpandedCall((curr) => {
      if (curr?.id === callId) {
        shouldFetch = false;
        return null;
      }
      return { id: callId, data: null, error: null };
    });
    if (!shouldFetch) return;
    try {
      const r = await fetch(callDownloadUrl(artifactType, callId));
      if (!r.ok) {
        setExpandedCall((curr) =>
          curr?.id === callId
            ? { id: callId, data: null, error: `Fetch failed (${r.status})` }
            : curr,
        );
        return;
      }
      const data = (await r.json()) as Record<string, unknown>;
      setExpandedCall((curr) =>
        curr?.id === callId ? { id: callId, data, error: null } : curr,
      );
    } catch (e) {
      setExpandedCall((curr) =>
        curr?.id === callId
          ? { id: callId, data: null, error: e instanceof Error ? e.message : "Failed" }
          : curr,
      );
    }
  }, [artifactType]);

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
      // Client-mints the id for fresh chats; the server idempotently
      // upserts via ``create_group``'s ``ON CONFLICT`` clause. Same
      // pattern ``draftId`` uses — caller is the source of truth for
      // the canonical id, server fills in the row.
      //
      // Pre-latch is unconditional: existing groups latch to their
      // current id (no-op if URL already matches), fresh chats latch
      // to the just-minted id. The URL is correct synchronously
      // before the request leaves, so refresh-during-generate
      // resolves SSR back to the right group and the EventSource is
      // already on the right channel from t=0.
      const sendGroupId =
        listener.forceNewChat
          ? crypto.randomUUID()
          : activeGroupId ?? crypto.randomUUID();
      if (listener.forceNewChat) {
        listener.setForceNewChat(false);
      }
      listener.latchGroupId(sendGroupId);

      const generateBody = {
        instructions: text ? [text] : [],
        config: {
          operations,
          // Driven by the "Safe mode" toggle in the settings menu.
          // Default unchecked → ``safeMode=false`` → ``dangerous=true``
          // (auto-execute, matches prior hardcoded behavior). Toggling
          // safe mode on soft-stages tool calls for explicit approval.
          dangerous: !safeMode,
          group_id: sendGroupId,
        },
      };
      // Generate goes through ``transport.send`` (client → BFF), NOT a
      // Next.js server action. Server actions auto-trigger an RSC
      // re-render of the page that hosts the panel, which re-runs the
      // page's SSR data fetches (``/X/context``, ``/X/group``,
      // ``/X/search``) — visible as a duplicate burst on every prompt
      // submit. The panel's own update flow is SSE-driven, so the
      // refresh is pure waste here. CRUD actions (create/update/delete)
      // legitimately want the refresh and stay as server actions.
      await transport.send(`/${artifactType}/generate`, generateBody);
    } catch (err) {
      listener.setError(
        err instanceof Error ? err.message : "Generate request failed",
      );
    }
  }, [instructions, safeMode, transport, artifactType, activeGroupId, operations, listener]);

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
    : selectedGroupName ||
      groupNameProp ||
      (selectedGroupId ? "Untitled" : "New Chat");
  const displaySubtext = listener.forceNewChat
    ? "Current session"
    : selectedGroupId
      ? "Previous session"
      : "Current session";

  // Settings-menu filters are orthogonal — each toggle gates one rule
  // independently of the other. A message has to pass BOTH rules to be
  // shown:
  //
  //   showFullContext OFF (default) → drop messages the LLM won't see
  //                                   on the next turn (in_context=false
  //                                   for history; tool=null audit
  //                                   events for live).
  //   showUserTools OFF (default)   → drop user-attributed tool calls
  //                                   (auto-fired *_Context / *_Search
  //                                   / *_Group on page load).
  //
  // Memoized so re-renders only recompute when one of the deps changes,
  // and so the same filtered lists drive both the render and the
  // ``hasMessages`` empty-state decision below.
  const filteredHistoricalMessages = useMemo(
    () =>
      historicalMessages.filter((m) => {
        if (!showFullContext && !m.inContext) return false;
        if (!showUserTools && m.role === "user" && m.calls.length > 0) {
          return false;
        }
        return true;
      }),
    [historicalMessages, showFullContext, showUserTools],
  );

  const filteredLiveMessages = useMemo(
    () =>
      liveMessages.filter((m) => {
        if (!showFullContext && m.type === "tool" && m.tool == null) {
          return false;
        }
        if (!showUserTools && m.type === "tool" && m.role === "user") {
          return false;
        }
        return true;
      }),
    [liveMessages, showFullContext, showUserTools],
  );

  const hasMessages =
    filteredHistoricalMessages.length > 0 || filteredLiveMessages.length > 0;

  // ---- Renderers ----

  const renderHistoricalMessage = (msg: HistoricalMessage, i: number) => {
    // Skip system/developer messages — they're prompt context, not conversation
    if (msg.role === "system" || msg.role === "developer") return null;

    const parts: React.ReactNode[] = [];
    const hasToolCalls = msg.calls.length > 0;

    // Tier selection is tool-presence-based:
    //   - call.tool present → ToolCallBubble. A tool is connected to
    //                          this call via ``tools_calls_connection``,
    //                          so we have real metadata (name,
    //                          description, future icon). Render the
    //                          full bubble regardless of who initiated
    //                          the call. Alignment still follows role.
    //   - call.tool null    → EventPill. Audit fired but no tool was
    //                          connected — render a lightweight event
    //                          marker rather than a fake tool call.
    const align = msg.role === "user" ? "justify-end" : "justify-start";
    for (const call of msg.calls) {
      if (call.tool == null) {
        parts.push(
          <EventPill
            key={`call-${call.id}`}
            name={bubbleLabel(call.tool, call.templateName)}
            status="success"
            align={align}
          />,
        );
      } else {
        parts.push(
          <ToolCallBubble
            key={`call-${call.id}`}
            callId={call.id}
            templateName={call.templateName}
            tool={call.tool}
            role={msg.role === "user" ? "user" : "assistant"}
            align={align}
            expanded={expandedCall}
            onToggle={(id) => void toggleCall(id)}
            ledgerStatus={call.ledgerStatus}
            ledgerArtifact={call.ledgerArtifact}
            ledgerOperation={call.ledgerOperation}
          />,
        );
      }
    }

    // Text uploads — only render standalone text (skip if message has tool calls,
    // since those text_ids are just rendered tool output, not assistant text).
    // Each ``<LazyText>`` fetches its body when scrolled into view.
    if (!hasToolCalls) for (const textId of msg.textIds) {
      const alignClass = msg.role === "user" ? "justify-end" : "justify-start";
      const bubbleClass = `max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent border"
      }`;
      parts.push(
        <LazyText
          key={`text-${textId}`}
          textId={textId}
          artifactType={artifactType}
          cached={textContent[textId]}
          onLoaded={onTextLoaded}
          alignClass={alignClass}
          bubbleClass={bubbleClass}
        />,
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
      const align = msg.role === "user" ? "justify-end" : "justify-start";

      // Tier selection is tool-presence-based — see renderHistoricalMessage
      // for the rule. ``msg.tool == null`` ⇒ event pill; tool present ⇒
      // full bubble. Alignment still follows role so user-initiated and
      // model-driven calls land on opposite sides.
      if (msg.tool == null) {
        const pillStatus: "pending" | "success" | "error" =
          msg.toolStatus === "success" ? "success"
            : msg.toolStatus === "error" ? "error"
              : "pending";
        return (
          <EventPill
            key={`live-${i}`}
            name={bubbleLabel(msg.tool, msg.toolName ?? null)}
            status={pillStatus}
            align={align}
          />
        );
      }

      // Tool present — full bubble. Once succeeded, expandable;
      // otherwise show a static status indicator.
      if (msg.toolStatus === "success") {
        return (
          <ToolCallBubble
            key={`live-${i}`}
            callId={msg.id}
            templateName={msg.toolName ?? null}
            tool={msg.tool}
            role={msg.role}
            align={align}
            expanded={expandedCall}
            onToggle={(id) => void toggleCall(id)}
          />
        );
      }
      return (
        <ToolCallStatusBubble
          key={`live-${i}`}
          toolName={bubbleLabel(msg.tool, msg.toolName ?? null)}
          status={msg.toolStatus === "error" ? "error" : "pending"}
          role={msg.role}
          align={align}
        />
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
              {filteredHistoricalMessages.map((msg, i) => renderHistoricalMessage(msg, i))}
              {filteredLiveMessages.map((msg, i) => renderLiveMessage(msg, i))}
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
                  {/* Sticky session settings — auto-execute, context
                      filtering, future toggles. Stacked above the send
                      button so the right rail stays single-column. */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            aria-label="Generation settings"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Generation settings</p>
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel>Generation settings</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={safeMode}
                        onCheckedChange={(v) => setSafeMode(Boolean(v))}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">Safe mode</span>
                          <span className="text-xs text-muted-foreground">
                            Stage tool calls for approval before they run
                          </span>
                        </div>
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={showFullContext}
                        onCheckedChange={(v) => setShowFullContext(Boolean(v))}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">Show full context</span>
                          <span className="text-xs text-muted-foreground">
                            Show every message in this group, including ones not sent to the model
                          </span>
                        </div>
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={showUserTools}
                        onCheckedChange={(v) => setShowUserTools(Boolean(v))}
                        onSelect={(e) => e.preventDefault()}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">Show user tools</span>
                          <span className="text-xs text-muted-foreground">
                            Show background user-fired tool calls (Context, Search, etc.)
                          </span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
