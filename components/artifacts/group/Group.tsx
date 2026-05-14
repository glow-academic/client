/**
 * Group.tsx
 * Display multiple runs with messages stacked vertically.
 * Each run is shown in its own section with summary and messages.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */
"use client";

import type { PricingGroupDetailOut } from "@/app/(main)/analytics/pricing/[groupId]/page";
import Markdown from "@/components/common/markdown/Markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ToolCallBubble,
  EventPill,
  bubbleLabel,
} from "@/components/common/ai/GenerationPanel";
import { callDownloadUrl } from "@/lib/api/download-routes";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Code,
  File,
  Loader2,
  MessageSquare,
  Settings,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface GroupProps {
  groupDetail: PricingGroupDetailOut;
}

const getRoleLabel = (role: string): string => {
  switch (role.toLowerCase()) {
    case "system":
      return "System";
    case "developer":
      return "Developer";
    case "user":
      return "User";
    case "assistant":
    case "response":
      return "Assistant";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const getRoleIcon = (role: string) => {
  switch (role.toLowerCase()) {
    case "system":
      return Settings;
    case "developer":
      return Code;
    case "user":
      return User;
    case "assistant":
    case "response":
      return MessageSquare;
    default:
      return MessageSquare;
  }
};

const formatDate = (dateString: string): string => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
};

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};

const formatCost = (cost: number): string => {
  return `$${cost.toFixed(6)}`;
};

/**
 * Per-media-type BFF URLs.
 *
 * The previous ``/api/group/download/{id}`` proxy was a single
 * unified endpoint that no longer exists — the canonical surface is
 * artifact-scoped (``system`` as the catch-all) with one route per
 * media type, each proxying to its matching ``/system/*_download``
 * impl. ``id`` here is an entry id (text_id, image_id, etc.) as
 * surfaced by the chat MV's resource-id lists, not an upload id.
 */
const SYSTEM_TEXT_URL = (id: string) => `/api/system/text/${id}`;
const SYSTEM_IMAGE_URL = (id: string) => `/api/system/image/${id}`;
const SYSTEM_AUDIO_URL = (id: string) => `/api/system/audio/${id}`;
const SYSTEM_VIDEO_URL = (id: string) => `/api/system/video/${id}`;
const SYSTEM_FILE_URL = (id: string) => `/api/system/file/${id}`;
// NOTE: ``SYSTEM_CALL_URL`` intentionally absent. ``message.call_ids``
// is a join side-effect of ``messages_mv`` aggregating from
// ``call_uploads_entry``; the bubble surface treats tool-call records
// (``msg.calls`` → ToolCallBubble) as authoritative and ignores the
// call-audio recordings exactly like GenerationPanel does.

/** Fetch text content for a single text entry id via the system text proxy. */
async function fetchGroupTextContent(textId: string): Promise<string> {
  const res = await fetch(SYSTEM_TEXT_URL(textId));
  if (!res.ok) return "";
  return res.text();
}

type GroupMessageItem = {
  id: string | null;
  text_ids?: string[];
};

/** Hook: resolve text_ids to displayable strings for each message. */
function useGroupTextContents(messages: GroupMessageItem[]) {
  const [contentMap, setContentMap] = useState<Record<string, string[]>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toFetch: { messageId: string; uploadIds: string[] }[] = [];

    for (const msg of messages) {
      const mid = msg.id;
      if (!mid || fetchedRef.current.has(mid)) continue;
      const ids = msg.text_ids;
      if (!ids || ids.length === 0) continue;
      toFetch.push({ messageId: mid, uploadIds: ids });
      fetchedRef.current.add(mid);
    }

    if (toFetch.length === 0) return;

    for (const { messageId, uploadIds } of toFetch) {
      Promise.all(uploadIds.map((id) => fetchGroupTextContent(id))).then(
        (texts) => {
          setContentMap((prev) => ({ ...prev, [messageId]: texts }));
        }
      );
    }
  }, [messages]);

  return contentMap;
}

/** Render the content of a single message from its upload IDs.
 *
 * Text-suppression rule mirrors GenerationPanel's canonical behavior:
 *   ``!hasToolCalls && !hasPrimaryMedia → render text``.
 * Text on a message that also has media/calls is the server-written
 * fallback caption (e.g. "Generated image resource: image-…", or the
 * rendered tool-call args) and is redundant when the native object
 * renders alongside it.
 *
 * ``call_ids`` are intentionally NOT rendered here — they're a
 * join side-effect of ``messages_mv`` aggregating from
 * ``call_uploads_entry`` and not a real chat surface. Tool calls are
 * handled by the parent via ``msg.calls`` + ``ToolCallBubble`` /
 * ``EventPill``; call recordings (if/when needed) would surface via a
 * dedicated affordance, not stacked into the bubble.
 */
function MessageContent({
  msg,
  textContents,
  hasToolCalls,
}: {
  msg: {
    id: string | null;
    text_ids?: string[];
    image_ids?: string[];
    audio_ids?: string[];
    video_ids?: string[];
    file_ids?: string[];
  };
  textContents: Record<string, string[]>;
  hasToolCalls: boolean;
}) {
  const texts = msg.id ? textContents[msg.id] : undefined;
  const textContent = texts?.join("\n") ?? "";
  const isLoadingText =
    !texts &&
    ((msg.text_ids?.length ?? 0) > 0);
  const hasImages = (msg.image_ids?.length ?? 0) > 0;
  const hasAudio = (msg.audio_ids?.length ?? 0) > 0;
  const hasVideo = (msg.video_ids?.length ?? 0) > 0;
  const hasFiles = (msg.file_ids?.length ?? 0) > 0;
  const hasPrimaryMedia = hasImages || hasAudio || hasVideo || hasFiles;
  const shouldRenderText = !hasToolCalls && !hasPrimaryMedia;
  const hasAnyContent =
    (shouldRenderText && (isLoadingText || textContent)) ||
    hasImages ||
    hasAudio ||
    hasVideo ||
    hasFiles;

  if (!hasAnyContent) {
    return <p className="text-sm text-muted-foreground italic">No content</p>;
  }

  return (
    <div className="space-y-2">
      {/* Text content — suppressed when tool calls or primary media
          are present (caption-fallback rule, matches GenerationPanel). */}
      {shouldRenderText && isLoadingText ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : shouldRenderText && textContent ? (
        <Markdown>{textContent}</Markdown>
      ) : null}

      {/* Images */}
      {hasImages &&
        msg.image_ids!.map((imageId) => (
          <img
            key={imageId}
            src={SYSTEM_IMAGE_URL(imageId)}
            alt="Message image"
            className="max-w-full rounded-md"
            loading="lazy"
          />
        ))}

      {/* Audio */}
      {hasAudio &&
        msg.audio_ids!.map((audioId) => (
          <audio
            key={audioId}
            controls
            preload="metadata"
            className="w-full"
          >
            <source src={SYSTEM_AUDIO_URL(audioId)} />
          </audio>
        ))}

      {/* Video */}
      {hasVideo &&
        msg.video_ids!.map((videoId) => (
          <video
            key={videoId}
            controls
            preload="metadata"
            className="max-w-full rounded-md"
          >
            <source src={SYSTEM_VIDEO_URL(videoId)} />
          </video>
        ))}

      {/* Files */}
      {hasFiles &&
        msg.file_ids!.map((fileId) => (
          <a
            key={fileId}
            href={SYSTEM_FILE_URL(fileId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm underline"
          >
            <File className="h-3 w-3" />
            Download file
          </a>
        ))}
    </div>
  );
}

export default function Group({ groupDetail }: GroupProps) {
  const [currentRunIndex, setCurrentRunIndex] = useState(0);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showDeveloperPrompt, setShowDeveloperPrompt] = useState(false);
  const [showPreviousContext, setShowPreviousContext] = useState(true);
  const [showToolCalls, setShowToolCalls] = useState(true);

  // Expanded tool call — at most one receipt body in memory at a time.
  // Mirrors the state machinery in GenerationPanel so ``ToolCallBubble``
  // gets the same expand/collapse + lazy-fetch behavior here.
  // ``artifactType`` is fixed to ``"system"`` because the Group panel
  // is rooted at the system catch-all surface.
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
      const r = await fetch(callDownloadUrl("system", callId));
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
  }, []);

  // This component only handles group responses (has 'runs' property)
  // Type assertion is safe here since this component is specifically for groups
  const isGroupResponse = "runs" in groupDetail;
  
  // Type guard to ensure we have group response
  type GroupResponseType = PricingGroupDetailOut & { runs: unknown[]; models?: unknown[]; agents?: unknown[]; profiles?: unknown[] };
  const groupResponse = isGroupResponse ? (groupDetail as GroupResponseType) : null;
  
  // Type for tool calls. Mirrors the server's ``GroupCall`` resolve
  // shape — see ``app/infra/group/resolve.py`` — so the FE can run
  // the same two-tier render that GenerationPanel uses:
  //   * ``tool === null`` → audit event without a registered tool →
  //     ``EventPill``
  //   * ``tool`` set → real tool call → ``ToolCallBubble`` with
  //     ledger-status awareness for soft writes.
  type CallItem = {
    id: string;
    template_name: string | null;
    tool: Record<string, unknown> | null;
    ledger_status?: "pending" | "accepted" | "rejected" | null;
    ledger_operation?: string | null;
    ledger_artifact?: string | null;
    ledger_artifact_id?: string | null;
  };

  // Message type matching server GroupDetailMessageItem (upload IDs by modality)
  type MessageItem = {
    id: string | null;
    role: string | null;
    text_ids?: string[];
    audio_ids?: string[];
    image_ids?: string[];
    video_ids?: string[];
    file_ids?: string[];
    call_ids?: string[];
    calls?: CallItem[];
  };

  // Flat GroupRun shape (server's resolve_group_impl canonical form):
  // run metadata + messages live side-by-side on the same object — no
  // nested ``.run`` wrapper. ``previous_context_start_index`` sits at
  // the same level as ``messages``.
  type RunItem = {
    id: string;
    created_at: string;
    input_tokens: number;
    output_tokens: number;
    cached_input_tokens: number;
    cost: number;
    model_id: string | null;
    agent_id: string | null;
    profile_id: string | null;
    previous_context_start_index: number | null;
    messages: MessageItem[];
  };

  const runs = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.runs ?? []) as RunItem[];
  }, [groupResponse]);

  // ``GroupResource`` is a flat ``{id, name}`` pair across all three
  // surfaces — model/agent/profile. The detail tree references the
  // role-specific id (``model_id`` / ``agent_id`` / ``profile_id``)
  // on each run, and these arrays let us resolve any of them to a
  // human-readable name.
  type ResourceItem = { id: string; name: string | null };

  const models = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.models || []) as ResourceItem[];
  }, [groupResponse]);
  const agents = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.agents || []) as ResourceItem[];
  }, [groupResponse]);
  const profiles = useMemo(() => {
    if (!groupResponse) return [];
    return (groupResponse.profiles || []) as ResourceItem[];
  }, [groupResponse]);

  // Sort runs chronologically
  const sortedRuns = useMemo(() => {
    if (!groupResponse || runs.length === 0) {
      return [];
    }
    return [...runs].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );
  }, [runs, groupResponse]);

  // Get current run
  const currentRun = sortedRuns[currentRunIndex];

  // Filter messages based on toggle switches
  const filteredMessages = useMemo(() => {
    if (!currentRun) {
      return [];
    }

    // First filter by previous context (if needed)
    let messagesToFilter = currentRun.messages;
    if (
      !showPreviousContext &&
      currentRun.previous_context_start_index !== null &&
      currentRun.previous_context_start_index !== undefined
    ) {
      // Hide messages before the previous_context_start_index (these are from previous runs)
      messagesToFilter = currentRun.messages.slice(
        currentRun.previous_context_start_index
      );
    }

    // Then filter by system/developer toggles
    return messagesToFilter.filter((message) => {
      const role = (message.role || "").toLowerCase();

      // Filter by system/developer toggles
      if (role === "system" && !showSystemPrompt) {
        return false;
      }
      if (role === "developer" && !showDeveloperPrompt) {
        return false;
      }

      return true;
    });
  }, [currentRun, showSystemPrompt, showDeveloperPrompt, showPreviousContext]);

  // Lazy text fetch: only request text for the messages that belong
  // to the run the user is currently viewing, not every message in
  // every run. The previous shape fired one ``/api/system/text/{id}``
  // request per text_id per message across all runs on mount — for
  // an 8-run group with chat-history this was hundreds of round-trips
  // (and as many 500s when any single fetch errored). Browser-managed
  // media tags (``<img>``/``<audio>``/``<video>``) already lazy-load
  // via render gating; text was the one explicit fetch path.
  //
  // We pass the unfiltered current-run messages (not
  // ``filteredMessages``) so toggling system/developer doesn't
  // dirty-fetch the same texts again. The hook's internal
  // ``fetchedRef`` deduplicates across run navigation, so revisiting
  // a previously-viewed run is free.
  const currentRunMessages = useMemo(
    () => (currentRun ? currentRun.messages : []),
    [currentRun],
  );
  const textContents = useGroupTextContents(currentRunMessages);

  if (!isGroupResponse) {
    return null; // This component only handles group responses
  }

  if (!currentRun) {
    return null;
  }

  // Messages are already ordered by message_tree from server, no need to sort.
  // ``GroupResource`` exposes ``{id, name}`` — match against the
  // role-specific id (``model_id`` / ``agent_id`` / ``profile_id``)
  // on the run.
  const modelName =
    currentRun.model_id
      ? (models.find((m) => m.id === currentRun.model_id)?.name ?? currentRun.model_id)
      : "Unknown";
  const agentName =
    currentRun.agent_id
      ? (agents.find((a) => a.id === currentRun.agent_id)?.name ?? currentRun.agent_id)
      : "Unknown";
  const profileName =
    currentRun.profile_id
      ? (profiles.find((p) => p.id === currentRun.profile_id)?.name ?? currentRun.profile_id)
      : "Unknown";

  return (
    <div className="flex flex-col">
      {/* Current Run Display */}
      <div className="flex flex-col border rounded-lg p-6 bg-card max-h-[700px] min-h-0 overflow-hidden">
        {/* Run header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">
              Run {currentRunIndex + 1} of {sortedRuns.length}
            </h3>
            <div className="flex items-center gap-4">
              {currentRunIndex > 0 && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-previous-context"
                    checked={showPreviousContext}
                    onCheckedChange={setShowPreviousContext}
                  />
                  <Label
                    htmlFor="show-previous-context"
                    className="text-sm cursor-pointer"
                  >
                    Show previous context
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="show-system-prompt"
                  checked={showSystemPrompt}
                  onCheckedChange={setShowSystemPrompt}
                />
                <Label
                  htmlFor="show-system-prompt"
                  className="text-sm cursor-pointer"
                >
                  Show system prompt
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-developer-prompt"
                  checked={showDeveloperPrompt}
                  onCheckedChange={setShowDeveloperPrompt}
                />
                <Label
                  htmlFor="show-developer-prompt"
                  className="text-sm cursor-pointer"
                >
                  Show developer prompt
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-tool-calls"
                  checked={showToolCalls}
                  onCheckedChange={setShowToolCalls}
                />
                <Label
                  htmlFor="show-tool-calls"
                  className="text-sm cursor-pointer"
                >
                  Show tool calls
                </Label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <div className="text-sm text-muted-foreground">Cost</div>
              <div className="text-lg font-semibold">
                {formatCost(currentRun.cost ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Input Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(currentRun.input_tokens ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Output Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(currentRun.output_tokens ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Cached Tokens</div>
              <div className="text-lg font-semibold">
                {formatNumber(currentRun.cached_input_tokens ?? 0)}
              </div>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Model: </span>
              <span className="font-medium">{modelName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span className="font-medium">{agentName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Profile: </span>
              <span className="font-medium">{profileName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="font-medium">{formatDate(currentRun.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Messages list */}
        <ScrollArea className="border rounded-lg h-[500px] min-h-0">
          <TooltipProvider>
            <div className="space-y-4 p-4">
              {filteredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No messages found for this run</p>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const role = msg.role || "";
                  const isUser = role.toLowerCase() === "user";
                  const RoleIcon = getRoleIcon(role);
                  const roleLabel = getRoleLabel(role);

                  // Check if this is the boundary between previous context and current run
                  // Find the original index in the unfiltered messages array
                  const originalIndex = currentRun.messages.findIndex(
                    (m) => m.id === msg.id
                  );
                  const isPreviousContextBoundary =
                    currentRun.previous_context_start_index !== null &&
                    currentRun.previous_context_start_index !== undefined &&
                    originalIndex === currentRun.previous_context_start_index &&
                    showPreviousContext; // Only show boundary when previous context is visible

                  // Get calls attached to this message
                  const messageCalls = (msg.calls || []) as CallItem[];
                  const renderCalls = showToolCalls && messageCalls.length > 0;

                  // "Own content" = anything the message itself
                  // carries beyond tool-call envelopes. Text on a
                  // tool-call-only assistant message is the
                  // server-written caption fallback (rendered as
                  // "No content" once the suppression rule fires) —
                  // here we treat it as absent so the tool call can
                  // step into the bubble's slot instead of sitting
                  // above a placeholder. Matches the rule used by
                  // ``MessageContent`` to decide what to render.
                  const hasOwnText =
                    !renderCalls &&
                    ((msg.id && (textContents[msg.id]?.join("") ?? "")) ||
                      (msg.text_ids?.length ?? 0) > 0);
                  const hasPrimaryMedia =
                    (msg.image_ids?.length ?? 0) > 0 ||
                    (msg.audio_ids?.length ?? 0) > 0 ||
                    (msg.video_ids?.length ?? 0) > 0 ||
                    (msg.file_ids?.length ?? 0) > 0;
                  const hasOwnContent = Boolean(hasOwnText) || hasPrimaryMedia;

                  // Layout decision tree:
                  //   * calls + no own content → tool calls take
                  //     the message-row slot at ``size="lg"``
                  //     (bulkier rhythm matching the analytics
                  //     panel's message bubble). No "No content"
                  //     placeholder.
                  //   * calls + own content → calls stay above as
                  //     auxiliary markers at the default ``sm``
                  //     density; the message bubble renders its
                  //     content below.
                  //   * no calls → just the message bubble as
                  //     today.
                  // ``bubbleLabel`` walks ``tool.name → templateName
                  // → "tool_call"`` so the label prefers the
                  // registered tool's display name.
                  const align = isUser ? "justify-end" : "justify-start";
                  const callsAsRow = renderCalls && !hasOwnContent;

                  const renderCallList = (size: "sm" | "lg") =>
                    messageCalls.map((call) => {
                      if (call.tool == null) {
                        return (
                          <EventPill
                            key={call.id}
                            name={bubbleLabel(call.tool, call.template_name)}
                            status="success"
                            align={align}
                            size={size}
                          />
                        );
                      }
                      return (
                        <ToolCallBubble
                          key={call.id}
                          callId={call.id}
                          templateName={call.template_name}
                          tool={call.tool}
                          role={isUser ? "user" : "assistant"}
                          align={align}
                          expanded={expandedCall}
                          onToggle={(id) => void toggleCall(id)}
                          ledgerStatus={call.ledger_status ?? null}
                          ledgerArtifact={call.ledger_artifact ?? null}
                          ledgerOperation={call.ledger_operation ?? null}
                          size={size}
                        />
                      );
                    });

                  const Avatar = isUser ? (
                    <div className="flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                            <User className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{roleLabel}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                            <RoleIcon className="h-4 w-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{roleLabel}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  );

                  return (
                    <div key={msg.id || `msg-${originalIndex}`}>
                      {isPreviousContextBoundary && (
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-dashed border-muted-foreground/30" />
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-2 text-muted-foreground">
                              Previous context
                            </span>
                          </div>
                        </div>
                      )}
                      {renderCalls && !callsAsRow && (
                        <div className="space-y-2 mb-3">
                          {renderCallList("sm")}
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex gap-3",
                          isUser ? "justify-end" : "justify-start"
                        )}
                      >
                        {!isUser && Avatar}
                        <div
                          className={cn(
                            "flex flex-col gap-2 max-w-[80%] flex-1",
                            isUser ? "items-end" : "items-start"
                          )}
                        >
                          {callsAsRow ? (
                            <div className="w-full space-y-2">
                              {renderCallList("lg")}
                            </div>
                          ) : (
                            <div
                              className={cn(
                                "rounded-lg p-3",
                                isUser
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              <MessageContent
                                msg={msg}
                                textContents={textContents}
                                hasToolCalls={renderCalls}
                              />
                            </div>
                          )}
                        </div>
                        {isUser && Avatar}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TooltipProvider>
        </ScrollArea>
      </div>

      {/* Pagination Footer - Run Navigation */}
      {sortedRuns.length > 1 && (
        <div className="border-t px-4 py-3 flex items-center bg-background relative">
          {/* Left Side - First and Previous Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(0)}
              disabled={currentRunIndex === 0}
            >
              <span className="sr-only">Go to first run</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(currentRunIndex - 1)}
              disabled={currentRunIndex === 0}
            >
              <span className="sr-only">Go to previous run</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Center - Current Run Info */}
          <div className="flex items-center gap-2 px-4 absolute left-1/2 -translate-x-1/2">
            <span className="text-sm font-medium">
              Run {currentRunIndex + 1} of {sortedRuns.length}
            </span>
          </div>

          {/* Spacer - flex grow to push content apart */}
          <div className="flex-1" />

          {/* Right Side - Next and Last Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(currentRunIndex + 1)}
              disabled={currentRunIndex >= sortedRuns.length - 1}
            >
              <span className="sr-only">Go to next run</span>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentRunIndex(sortedRuns.length - 1)}
              disabled={currentRunIndex >= sortedRuns.length - 1}
            >
              <span className="sr-only">Go to last run</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
