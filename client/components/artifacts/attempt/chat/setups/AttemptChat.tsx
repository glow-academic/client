/**
 * AttemptChat.tsx
 * Full chat component with unified attempt_* event contract.
 * Uses strongly typed socket events from OpenAPI-generated types.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/contexts/socket-context";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { components } from "@/lib/api/schema";
import type { OutputOf } from "@/lib/api/types";
import { useAttemptMessages } from "@/hooks/use-attempt-messages";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/ws/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MessagesViewProps } from "../chatAreas/MessagesView";
import { MessagesView } from "../chatAreas/MessagesView";
import type { RubricViewProps } from "../chatAreas/RubricView";
import { RubricView } from "../chatAreas/RubricView";
import type { VideoViewProps } from "../chatAreas/VideoView";
import { VideoView } from "../chatAreas/VideoView";
import type { ChatHeaderProps } from "../chatHeaders/AttemptChatHeader";
import { AttemptChatHeader } from "../chatHeaders/AttemptChatHeader";
import type { DocumentAreaProps } from "../documentAreas/AttemptDocumentArea";
import { AttemptDocumentArea } from "../documentAreas/AttemptDocumentArea";
import {
  GenericChatInterface,
  type ChatAreaViewMode,
} from "../generic/GenericChatInterface";
import type { QuestionReviewViewProps } from "../chatAreas/QuestionReviewView";
import { QuestionReviewView } from "../chatAreas/QuestionReviewView";
import type { QuestionTakingInputProps } from "../inputAreas/QuestionTakingInput";
import { QuestionTakingInput } from "../inputAreas/QuestionTakingInput";
import type { HybridInputProps, HybridInputHandle } from "../inputAreas/HybridInput";
import { HybridInput } from "../inputAreas/HybridInput";
import { AttemptLobby } from "../AttemptLobby";

// ============================================================================
// TYPES
// ============================================================================

type AttemptResourceMap<T> = Record<string, T>;

type AttemptResources = {
  scenarios?: AttemptResourceMap<components["schemas"]["ScenarioEntry"]>;
  personas?: AttemptResourceMap<components["schemas"]["PersonaEntry"]>;
  documents?: AttemptResourceMap<components["schemas"]["DocumentEntry"]>;
  images?: AttemptResourceMap<components["schemas"]["ImageEntry"]>;
  videos?: AttemptResourceMap<components["schemas"]["VideoEntry"]>;
  objectives?: AttemptResourceMap<components["schemas"]["ObjectiveEntry"]>;
  questions?: AttemptResourceMap<components["schemas"]["QuestionEntry"]>;
  options?: AttemptResourceMap<components["schemas"]["OptionEntry"]>;
  problem_statements?: AttemptResourceMap<
    components["schemas"]["ProblemStatementEntry"]
  >;
  rubrics?: AttemptResourceMap<components["schemas"]["RubricEntry"]>;
  standard_groups?: AttemptResourceMap<components["schemas"]["StandardGroupEntry"]>;
  standards?: AttemptResourceMap<components["schemas"]["StandardEntry"]>;
};

type AttemptViews = {
  simulation_attempts?: components["schemas"]["AttemptViewItem"][] | null;
  simulation_chats?: components["schemas"]["ChatData"][] | null;
  simulation_messages?: components["schemas"]["MessageData"][] | null;
};

/** Attempt data from server - strongly typed from OpenAPI */
type AttemptData = OutputOf<"/api/v4/artifacts/attempt/get", "post"> & {
  resources?: AttemptResources;
  views?: AttemptViews;
};

/** Message data from OpenAPI schema - used for optimistic messages */
type MessageData = components["schemas"]["MessageData"];

// Socket event payload types (auto-generated from server OpenAPI schema)
// Client-to-Server payloads
type AttemptJoinPayload = Parameters<ClientToServerEvents["attempt_join"]>[0];
type AttemptLeavePayload = Parameters<ClientToServerEvents["attempt_leave"]>[0];
type AttemptStopPayload = Parameters<ClientToServerEvents["attempt_stop"]>[0];
type AttemptAudioStartPayload = Parameters<ClientToServerEvents["attempt_audio_start"]>[0];
type AttemptAudioStopPayload = Parameters<ClientToServerEvents["attempt_audio_stop"]>[0];
type AttemptAudioFramePayload = Parameters<ClientToServerEvents["attempt_audio_frame"]>[0];
type AttemptMicMutePayload = Parameters<ClientToServerEvents["attempt_mic_mute"]>[0];
type AttemptResponseSubmitPayload = Parameters<ClientToServerEvents["attempt_response_submit"]>[0];

// Server-to-Client event payloads (message streaming types are in useAttemptMessages hook)
type AttemptUserStartEvent = Parameters<ServerToClientEvents["attempt_user_start"]>[0];
type AttemptUserDeltaEvent = Parameters<ServerToClientEvents["attempt_user_delta"]>[0];
type AttemptAssistantAudioEvent = Parameters<ServerToClientEvents["attempt_assistant_audio"]>[0];
type AttemptChatEndedEvent = Parameters<ServerToClientEvents["attempt_chat_ended"]>[0];
type AttemptEndedEvent = Parameters<ServerToClientEvents["attempt_ended"]>[0];
type AttemptAudioReadyEvent = Parameters<ServerToClientEvents["attempt_audio_ready"]>[0];
type AttemptAudioEndedEvent = Parameters<ServerToClientEvents["attempt_audio_ended"]>[0];
type AttemptGradingProgressEvent = Parameters<ServerToClientEvents["attempt_grading_progress"]>[0];
type AttemptGradedEvent = Parameters<ServerToClientEvents["attempt_graded"]>[0];
type AttemptHintProgressEvent = Parameters<ServerToClientEvents["attempt_hint_progress"]>[0];
type AttemptResponseResultEvent = Parameters<ServerToClientEvents["attempt_response_result"]>[0];

/** Props for the AttemptChat component */
export interface AttemptChatProps {
  attempt_id: string;
  attempt_data: AttemptData;
  draft_id?: string | null;
  infinite_mode?: boolean;
  user_instructions?: string | null;
}

/** Grading state in Record format (matches server response) */
type OptimisticGradingState = {
  achieved_standards?: Record<string, boolean> | null;
  passed_standards?: Record<string, boolean> | null;
  feedback_by_standard_id?: Record<string, string> | null;
};

type HintsByMessage = {
  message_id: string;
  hints: Array<{
    hint: string;
    idx: number;
  }>;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AttemptChat({
  attempt_id,
  attempt_data: initialAttemptData,
  draft_id: draftIdProp = null,
  infinite_mode: infiniteModeProp = false,
  user_instructions: userInstructionsProp = null,
}: AttemptChatProps) {
  const router = useRouter();
  const { socket, isConnected } = useSocket();

  // ---------------------------------------------------------------------------
  // STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  const [attemptData, setAttemptData] = useState(initialAttemptData);
  const [currentChatIndex, setCurrentChatIndex] = useState(
    initialAttemptData.current_chat_index ?? 0
  );
  const [showDocuments, setShowDocuments] = useState(true);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [showGrades, setShowGrades] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [userHasManuallyToggledGrades, setUserHasManuallyToggledGrades] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );
  const [localElapsedOffset, setLocalElapsedOffset] = useState(0);

  const [optimisticHints, setOptimisticHints] = useState<
    Record<string, HintsByMessage[]>
  >({});
  const [optimisticGradingStates, setOptimisticGradingStates] = useState<
    Record<string, OptimisticGradingState>
  >({});

  const [gradingProgress, setGradingProgress] = useState<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const groupMessagesByChat = useCallback(
    (messages?: MessageData[] | null) => {
      const grouped: Record<string, MessageData[]> = {};
      if (!messages) return grouped;
      messages.forEach((message) => {
        const chatId = message.chat_id ? String(message.chat_id) : null;
        if (!chatId) return;
        if (!grouped[chatId]) grouped[chatId] = [];
        grouped[chatId].push(message);
      });
      return grouped;
    },
    []
  );

  const messagesByChat = useMemo(
    () => groupMessagesByChat(attemptData?.views?.simulation_messages),
    [attemptData?.views?.simulation_messages, groupMessagesByChat]
  );

  // Refs
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const hasInitializedFromServerRef = useRef(false);
  const pendingNextChatIdRef = useRef<string | null>(null);
  const freshlyCompletedChatsRef = useRef<Set<string>>(new Set());
  const transcriptDeltasRef = useRef<Map<string, string>>(new Map());
  const itemIdToOptimisticIdRef = useRef<Map<string, string>>(new Map());
  const voiceInputRef = useRef<HybridInputHandle | null>(null);
  const dataFetchedAtRef = useRef<number>(Date.now());
  const gradingProgressRef = useRef<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);
  const isGradingRef = useRef(false);

  // Attempt message streaming hook
  const handleUserCompleteVoiceCleanup = useCallback(
    (data: Parameters<import("@/lib/ws/types").ServerToClientEvents["attempt_user_complete"]>[0]) => {
      // Clean up voice optimistic messages matching this user message
      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        const normalizedContent = data.content.trim().toLowerCase();
        let matchedOptimisticId: string | null = null;

        for (const [tempId, optMsg] of newMap.entries()) {
          if (
            optMsg.type === "query" &&
            (tempId.startsWith("optimistic-user-") ||
              tempId.startsWith("optimistic-user-voice-"))
          ) {
            const optContent = optMsg.contents?.[0]?.content || "";
            const optNormalized = optContent.trim().toLowerCase();
            if (optNormalized === normalizedContent) {
              matchedOptimisticId = tempId;
              break;
            }
            if (
              optNormalized.length > 5 &&
              normalizedContent.length > 5 &&
              (optNormalized.includes(normalizedContent) ||
                normalizedContent.includes(optNormalized))
            ) {
              if (!matchedOptimisticId || tempId.startsWith("optimistic-user-voice-")) {
                matchedOptimisticId = tempId;
              }
            }
          }
        }

        if (!matchedOptimisticId) {
          for (const [tempId, optMsg] of newMap.entries()) {
            if (optMsg.type === "query" && tempId.startsWith("optimistic-user-voice-")) {
              matchedOptimisticId = tempId;
              break;
            }
          }
        }

        if (matchedOptimisticId) {
          newMap.delete(matchedOptimisticId);
          let matchedItemId: string | null = null;
          for (const [itemId, optId] of itemIdToOptimisticIdRef.current.entries()) {
            if (optId === matchedOptimisticId) {
              matchedItemId = itemId;
              itemIdToOptimisticIdRef.current.delete(itemId);
              break;
            }
          }
          if (matchedItemId) {
            transcriptDeltasRef.current.delete(matchedItemId);
          }
        }

        return newMap;
      });
    },
    []
  );

  const {
    streamingContent,
    setStreamingContent,
    optimisticMessages,
    setOptimisticMessages,
    isSending: isSendingMessage,
    isStopping: isStoppingMessage,
    setIsSending: setIsSendingMessage,
    setIsStopping: setIsStoppingMessage,
    clearStreamingState,
  } = useAttemptMessages({
    socket,
    chatIdRef: currentChatIdRef,
    personas: attemptData?.resources?.personas,
    onRefresh: useCallback(() => router.refresh(), [router]),
    onUserComplete: handleUserCompleteVoiceCleanup,
  });

  // ---------------------------------------------------------------------------
  // SYNC WITH INITIAL DATA
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialAttemptData) return;

    setAttemptData(initialAttemptData);

    if (initialAttemptData.current_chat_index !== undefined) {
      if (!hasInitializedFromServerRef.current) {
        setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        hasInitializedFromServerRef.current = true;
      } else if (initialAttemptData.views?.simulation_chats) {
        const currentChatId = attemptData?.views?.simulation_chats?.[currentChatIndex]?.id;
        const currentChatStillExists = initialAttemptData.views.simulation_chats.some(
          (c) => c.id === currentChatId
        );
        if (!currentChatStillExists && initialAttemptData.views.simulation_chats.length > 0) {
          setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        }
      }
    }

    if (initialAttemptData.views?.simulation_chats) {
      setOptimisticGradingStates((prev) => {
        const updated: Record<string, OptimisticGradingState> = {};
        Object.entries(prev).forEach(([chatId, optimisticState]) => {
          const chatData = initialAttemptData.views?.simulation_chats?.find(
            (c) => c.id === chatId
          );
          if (!chatData?.grading_state) {
            updated[chatId] = optimisticState;
          }
        });
        return updated;
      });

      setOptimisticHints((prev) => {
        const updated: Record<string, HintsByMessage[]> = {};
        const initialMessagesByChat = groupMessagesByChat(
          initialAttemptData.views?.simulation_messages
        );
        Object.entries(prev).forEach(([chatId, optimisticChatHints]) => {
          const messages = initialMessagesByChat[chatId] || [];

          // Build map of message_id -> hints from message-level hints
          const serverHintsMap = new Map<string, HintsByMessage>();
          messages.forEach((msg) => {
            if (msg.id && msg.hints && msg.hints.length > 0) {
              serverHintsMap.set(msg.id, {
                message_id: msg.id,
                hints: msg.hints.map((hint) => ({
                  hint: hint.hint || "",
                  idx: hint.idx ?? 0,
                })),
              });
            }
          });

          const missingOrIncompleteHints = optimisticChatHints.filter(
            (optimisticHint) => {
              const serverHint = serverHintsMap.get(optimisticHint.message_id);
              if (!serverHint) return true;
              const serverHintCount = (serverHint.hints || []).length;
              const optimisticHintCount = (optimisticHint.hints || []).length;
              if (serverHintCount !== optimisticHintCount) return true;
              const hasContent = (serverHint.hints || []).some(
                (h) => h.hint && h.hint.trim().length > 0
              );
              return !hasContent;
            }
          );

          if (missingOrIncompleteHints.length > 0) {
            updated[chatId] = missingOrIncompleteHints;
          }
        });
        return updated;
      });
    }
  }, [attemptData, currentChatIndex, initialAttemptData, groupMessagesByChat]);

  useEffect(() => {
    if (!pendingNextChatIdRef.current || !attemptData?.views?.simulation_chats) return;
    const nextChatId = pendingNextChatIdRef.current;
    const sortedChats = [...attemptData.views.simulation_chats]
      .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const nextIndex = sortedChats.findIndex((c) => c.id === nextChatId);
    if (nextIndex !== -1) {
      setCurrentChatIndex(nextIndex);
      pendingNextChatIdRef.current = null;
    }
  }, [attemptData]);

  // ---------------------------------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------------------------------

  const currentChat = useMemo(() => {
    const chats = attemptData?.views?.simulation_chats ?? [];
    if (chats.length === 0) return null;
    return chats[currentChatIndex] || chats[0] || null;
  }, [attemptData, currentChatIndex]);

  const resolvedChat = useMemo(() => {
    if (!currentChat) return null;
    const resources = attemptData?.resources;

    const resolveById = <T,>(
      id: string | null | undefined,
      map?: AttemptResourceMap<T>
    ): T | null => {
      if (!id || !map) return null;
      return map[String(id)] ?? null;
    };

    const resolveByIds = <T,>(
      ids: string[] | null | undefined,
      map?: AttemptResourceMap<T>
    ): T[] | null => {
      if (!ids || !map) return null;
      const items = ids
        .map((id) => map[String(id)])
        .filter(Boolean) as T[];
      return items.length > 0 ? items : null;
    };

    const resolvedQuestions = (() => {
      if (!resources?.questions || !currentChat.question_ids) return null;
      const optionsMap = resources.options ?? {};
      const questions = resolveByIds(
        currentChat.question_ids,
        resources.questions
      );
      if (!questions) return null;
      return questions.map((q) => {
        const qId = String((q as { question_id?: string }).question_id ?? "");
        const options = Object.values(optionsMap).filter(
          (opt) =>
            String((opt as { option_id?: string }).option_id ?? "") &&
            String((opt as { question_id?: string }).question_id ?? "") === qId
        );
        return {
          ...q,
          options: options.length > 0 ? options : (q as any).options,
        };
      });
    })();

    const resolvedImages = resolveByIds(
      currentChat.image_ids,
      resources?.images
    );
    const resolvedVideos = resolveByIds(
      currentChat.video_ids,
      resources?.videos
    );
    const resolvedDocuments = resolveByIds(
      currentChat.document_ids,
      resources?.documents
    );
    return {
      ...currentChat,
      scenario: resolveById(currentChat.scenario_id, resources?.scenarios),
      problem_statement:
        resolveById(currentChat.problem_statement_id, resources?.problem_statements),
      personas: resolveByIds(currentChat.persona_ids, resources?.personas),
      objectives: resolveByIds(currentChat.objective_ids, resources?.objectives),
      images: resolvedImages,
      background_image: resolvedImages?.[0] ?? null,
      videos: resolvedVideos,
      video: resolvedVideos?.[0] ?? null,
      documents: resolvedDocuments,
      questions: resolvedQuestions,
      rubric: resolveById(currentChat.rubric_id, resources?.rubrics),
      standard_groups: resolveByIds(
        currentChat.standard_group_ids,
        resources?.standard_groups
      ),
      standards: resolveByIds(currentChat.standard_ids, resources?.standards),
    };
  }, [currentChat, attemptData?.resources]);

  const scenario = useMemo(() => {
    if (!resolvedChat) return null;
    const firstPersona = resolvedChat.personas?.[0] ?? null;
    const problemStatementText =
      resolvedChat.problem_statement?.problem_statement ?? null;
    return {
      persona_name: firstPersona?.name ?? null,
      persona_icon: firstPersona?.icon ?? null,
      persona_color: firstPersona?.color ?? null,
      objectives: resolvedChat.objectives?.map((o) => ({
        id: o.objective_id,
        objective: o.objective,
      })) ?? [],
      problem_statement: problemStatementText,
      name: resolvedChat.scenario?.name ?? null,
      copy_paste_allowed: resolvedChat.copy_paste_allowed ?? null,
      text_enabled: resolvedChat.text_enabled ?? true,
      audio_enabled: resolvedChat.audio_enabled ?? false,
    };
  }, [resolvedChat]);

  const chats = useMemo(
    () =>
      attemptData?.views?.simulation_chats?.filter(
        (chat): chat is NonNullable<typeof chat> => chat !== null
      ) || [],
    [attemptData]
  );
  const rubricStructure = attemptData?.rubric_structure || null;
  const isActive = attemptData?.is_active ?? true;
  const isAttemptOwner = true;
  const showResults = attemptData?.show_results ?? false;

  // Timer baseline from server (single source of truth + negative support)
  const serverTimer = useMemo(() => {
    const backendTimer = attemptData?.timer;
    if (!backendTimer) {
      return {
        elapsed: 0,
        remaining: null as number | null,
        expired: false,
        negative: false,
      };
    }
    const remaining =
      backendTimer.limit !== null && backendTimer.elapsed !== null
        ? backendTimer.limit - backendTimer.elapsed
        : null;
    return {
      elapsed: backendTimer.elapsed ?? 0,
      remaining,
      expired: backendTimer.exceeded ?? false,
      negative: backendTimer.negative ?? false,
    };
  }, [attemptData?.timer]);

  // Reset baseline when server timer updates
  useEffect(() => {
    dataFetchedAtRef.current = Date.now();
    setLocalElapsedOffset(0);
  }, [attemptData?.timer?.elapsed]);

  // Tick timer for active chats
  useEffect(() => {
    if (!isActive || !currentChat || currentChat.completed || showResults) return;

    const interval = setInterval(() => {
      const secondsSinceFetch = Math.floor(
        (Date.now() - dataFetchedAtRef.current) / 1000
      );
      setLocalElapsedOffset(secondsSinceFetch);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentChat, isActive, showResults]);

  // Compute display timer (allows negative if server says so)
  const displayTimer = useMemo(() => {
    const elapsed = serverTimer.elapsed + localElapsedOffset;
    let remaining = serverTimer.remaining;
    if (remaining !== null) {
      remaining = remaining - localElapsedOffset;
      if (!serverTimer.negative) {
        remaining = Math.max(remaining, 0);
      }
    }
    return {
      elapsed,
      remaining,
      expired:
        serverTimer.expired || (remaining !== null && remaining <= 0),
      negative: serverTimer.negative,
    };
  }, [serverTimer, localElapsedOffset]);

  // Check if this is a single chat attempt (no pagination needed)
  const isSingleChatAttempt = chats.length <= 1;

  // Get grade data for all chats (for pass/fail badges in pagination)
  const allDynamicRubrics = useMemo(() => {
    return chats
      .map((chat) => {
        const grade = chat.grade;
        if (!grade || !chat.id) return null;
        return {
          chat_id: chat.id,
          score: grade.score ?? 0,
          total_possible_points: grade.total_points ?? 0,
          passed: grade.passed ?? false,
        };
      })
      .filter((rubric): rubric is NonNullable<typeof rubric> => rubric !== null);
  }, [chats]);

  useEffect(() => {
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);

  // ---------------------------------------------------------------------------
  // ROOM MANAGEMENT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isConnected || !currentChat?.id || !socket) return;
    if (currentRoomRef.current === currentChat.id) return;

    if (currentRoomRef.current) {
      socket.emit("attempt_leave", { chat_id: currentRoomRef.current });
    }

    socket.emit("attempt_join", { chat_id: currentChat.id });
    currentRoomRef.current = currentChat.id;
    currentChatIdRef.current = currentChat.id;

    return () => {
      if (currentRoomRef.current && socket) {
        socket.emit("attempt_leave", { chat_id: currentRoomRef.current });
        currentRoomRef.current = null;
        currentChatIdRef.current = null;
      }
    };
  }, [currentChat?.id, isConnected, socket]);

  useEffect(() => {
    const chatId = currentChat?.id ?? null;
    if (prevChatIdRef.current !== null && prevChatIdRef.current !== chatId) {
      clearStreamingState();
      setMessagesWithNewHints(new Set());
      transcriptDeltasRef.current.clear();
      itemIdToOptimisticIdRef.current = new Map();
    }
    prevChatIdRef.current = chatId;
  }, [currentChat?.id, clearStreamingState]);

  useEffect(() => {
    const currentChatId = currentChat?.id ? String(currentChat.id) : "";
    const propMessages = currentChatId ? messagesByChat[currentChatId] : [];
    if (!propMessages || propMessages.length === 0) return;

    const gracePeriodTimeout = setTimeout(() => {
      setStreamingContent((prev) => {
        const newMap = new Map(prev);
        let changed = false;
        propMessages.forEach((msg) => {
          if (msg.completed && newMap.has(msg.id)) {
            const streaming = newMap.get(msg.id);
            if (streaming && msg.contents?.[0]?.content && msg.contents[0].content.length >= streaming.length) {
              newMap.delete(msg.id);
              changed = true;
            }
          }
        });
        return changed ? newMap : prev;
      });

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        let changed = false;
        const propMessageIds = new Set(propMessages.map((msg) => msg.id));
        newMap.forEach((_msg, id) => {
          if (propMessageIds.has(id)) {
            newMap.delete(id);
            changed = true;
          }
        });
        return changed ? newMap : prev;
      });
    }, 500);

    return () => clearTimeout(gracePeriodTimeout);
  }, [attemptData, currentChatIndex, setStreamingContent, setOptimisticMessages]);

  // Auto-show grades/rubric or responses when all chats are completed
  useEffect(() => {
    const chats = attemptData?.views?.simulation_chats ?? [];

    if (showResults && chats.length > 0 && !userHasManuallyToggledGrades) {
      const allCompleted = chats.every((chat) => chat.completed);
      if (allCompleted) {
        // Check if current chat has video questions - if so, show responses instead of rubric
      const hasVideoQuestions = (resolvedChat?.questions?.length ?? 0) > 0;
        if (hasVideoQuestions) {
          setShowResponses(true);
        } else {
          setShowGrades(true);
        }
      }
    }
  }, [
    attemptData?.show_results,
    attemptData?.views?.simulation_chats,
    userHasManuallyToggledGrades,
    attemptData,
    currentChatIndex,
    showResults,
  ]);

  // Reset question index when chat changes
  useEffect(() => {
    setQuestionIndex(0);
  }, [currentChatIndex]);

  // Auto-select first document when chat changes or content becomes available
  useEffect(() => {
    const chatDocuments = resolvedChat?.documents || [];

    const allItems = chatDocuments
      .filter((doc) => doc.document_id)
      .map((doc) => ({ id: `doc:${doc.document_id}` }));

    if (allItems.length > 0) {
      // Check if current selection is valid (support both prefixed and non-prefixed IDs)
      const currentSelectionValid = selectedDocumentId && allItems.some((item) => {
        if (item.id === selectedDocumentId) return true;
        // Check non-prefixed for backwards compatibility
        if (item.id === `doc:${selectedDocumentId}`) return true;
        return false;
      });

      if (!currentSelectionValid) {
        const firstItem = allItems[0];
        if (firstItem) {
          setSelectedDocumentId(firstItem.id);
        }
      }
    } else {
      setSelectedDocumentId(null);
    }
  }, [resolvedChat?.documents, resolvedChat?.id, selectedDocumentId]);

  // ---------------------------------------------------------------------------
  // VIEW MODE
  // ---------------------------------------------------------------------------

  const chatAreaViewMode: ChatAreaViewMode = useMemo(() => {
    if (showGrades) return "rubric";
    const currentChatData = attemptData?.views?.simulation_chats?.[currentChatIndex];
    const hasVideo = !!resolvedChat?.video?.upload_id;
    const hasVideoQuestions = resolvedChat?.questions && resolvedChat.questions.length > 0;

    // graded-video mode when viewing responses for completed video with questions
    if (hasVideo && hasVideoQuestions && showResponses) return "graded-video";
    if (hasVideo) return "video";

    const currentChatId = currentChat?.id ? String(currentChat.id) : "";
    const currentChatMessages = currentChatId ? messagesByChat[currentChatId] : [];
    const hasGradingData =
      currentChatData?.grading_state ||
      currentChatMessages?.some((m) => m.feedbacks && m.feedbacks.length > 0);
    if (hasGradingData && currentChat?.completed) return "graded-messages";
    return "messages";
  }, [
    showGrades,
    showResponses,
    attemptData,
    currentChatIndex,
    currentChat,
    resolvedChat,
    messagesByChat,
  ]);

  // ---------------------------------------------------------------------------
  // MERGED STATES
  // ---------------------------------------------------------------------------

  const mergedGradingStates = useMemo(() => {
    const map: Record<string, OptimisticGradingState> = {};
    attemptData?.views?.simulation_chats?.forEach((chatData) => {
      const chatId = chatData.id;
      if (chatId && chatData.grading_state) {
        map[chatId] = chatData.grading_state;
      }
    });

    Object.entries(optimisticGradingStates).forEach(([chatId, optimisticState]) => {
      const existingState = map[chatId];
      if (existingState) {
        map[chatId] = {
          achieved_standards:
            optimisticState.achieved_standards ?? existingState.achieved_standards,
          passed_standards:
            optimisticState.passed_standards ?? existingState.passed_standards,
          feedback_by_standard_id:
            optimisticState.feedback_by_standard_id ?? existingState.feedback_by_standard_id,
        };
      } else {
        map[chatId] = optimisticState;
      }
    });

    return map;
  }, [attemptData, optimisticGradingStates]);

  const newHintMessageIds = useMemo(
    () => Array.from(messagesWithNewHints),
    [messagesWithNewHints]
  );

  // ---------------------------------------------------------------------------
  // PUBLIC HANDLERS
  // ---------------------------------------------------------------------------

  // Wrapped setter to track manual rubric toggles
  const handleToggleGrades = useCallback((show: boolean) => {
    setShowGrades(show);
    setUserHasManuallyToggledGrades(true);
  }, []);

  const handleSendMessage = useCallback(
    async (message: string, _isRetry?: boolean) => {
      const simulationId = attemptData?.simulation?.id;
      if (!message.trim() || !currentChat || isSendingMessage || !socket || !simulationId) return;

      setIsSendingMessage(true);
      try {
        socket.emit("attempt_message", {
          simulation_id: simulationId,
          chat_id: currentChat.id,
          message: message,
          voice_mode: false,
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false);
      }
    },
    [currentChat, isSendingMessage, socket, attemptData?.simulation?.id]
  );

  const handleStopMessage = useCallback(async () => {
    if (!currentChat || isStoppingMessage || !socket) return;
    setIsStoppingMessage(true);
    try {
      socket.emit("attempt_stop", { chat_id: currentChat.id });
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChat, isStoppingMessage, socket]);

  const handleQuizResponse = useCallback(
    (questionId: string, optionIds: string[]) => {
      if (!currentChat || !socket) return;
      socket.emit("attempt_response_submit", {
        chat_id: currentChat.id,
        question_id: questionId,
        option_ids: optionIds,
      });
    },
    [currentChat, socket]
  );

  const handleVoiceStart = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) {
      toast.error("Cannot enable voice mode: chat or connection not available");
      return;
    }

    const chatId = currentChat.id;

    // BFF: Client sends chat_id, server generates group_id internally
    socket.emit("attempt_audio_start", { chat_id: chatId });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("attempt_audio_ready", handleStartResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session start"));
      }, 10000);

      const handleStartResponse = (data: AttemptAudioReadyEvent) => {
        if (data.chat_id !== chatId) return;
        clearTimeout(timeout);
        cleanup();
        if (data.success) {
          resolve();
        } else {
          reject(new Error(data.message || "Failed to start voice session"));
        }
      };

      socket.on("attempt_audio_ready", handleStartResponse);
    });
  }, [currentChat?.id, isConnected, socket]);

  const handleVoiceStop = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) return;

    const chatId = currentChat.id;

    // BFF: Client sends chat_id, server looks up session by sid
    socket.emit("attempt_audio_stop", { chat_id: chatId });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("attempt_audio_ended", handleStopResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session stop"));
      }, 10000);

      const handleStopResponse = (data: AttemptAudioEndedEvent) => {
        if (data.chat_id !== chatId) return;
        clearTimeout(timeout);
        cleanup();
        if (data.success) {
          resolve();
        } else {
          reject(new Error(data.message || "Failed to stop voice session"));
        }
      };

      socket.on("attempt_audio_ended", handleStopResponse);
    });
  }, [currentChat?.id, isConnected, socket]);

  const handlePcm16Data = useCallback(
    (data: ArrayBuffer) => {
      if (!socket || !isConnected) return;
      socket.emit("attempt_audio_frame", { audio: data });
    },
    [socket, isConnected]
  );

  const handleMicMute = useCallback(
    (muted: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit("attempt_mic_mute", { muted });
    },
    [socket, isConnected]
  );

  // ---------------------------------------------------------------------------
  // WEBSOCKET EVENT HANDLERS (voice, navigation, grading, hints, quiz)
  // Message streaming events are handled by useAttemptMessages hook.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return;

    // User started speaking (voice)
    const handleUserStart = (data: AttemptUserStartEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      const optimisticMessageId = `optimistic-user-voice-${Date.now()}-${Math.random()}`;

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        for (const [id, msg] of newMap.entries()) {
          const msgContent = msg.contents?.[0]?.content || "";
          if (
            id.startsWith("optimistic-user-voice-") &&
            (msgContent === "" || !msg.completed)
          ) {
            newMap.delete(id);
            for (const [itemId, optId] of itemIdToOptimisticIdRef.current.entries()) {
              if (optId === id) {
                itemIdToOptimisticIdRef.current.delete(itemId);
              }
            }
          }
        }
        return newMap;
      });

      itemIdToOptimisticIdRef.current.set(data.item_id, optimisticMessageId);

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(optimisticMessageId, {
          id: optimisticMessageId,
          type: "query",
          created_at: new Date().toISOString(),
          completed: false,
          contents: [{ content: "", name: "You" }],
        });
        return newMap;
      });
    };

    // User transcript delta (voice)
    const handleUserDelta = (data: AttemptUserDeltaEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      transcriptDeltasRef.current.set(data.item_id, data.transcript);
      const optimisticMessageId = itemIdToOptimisticIdRef.current.get(data.item_id);

      if (optimisticMessageId) {
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);
          const existingMessage = newMap.get(optimisticMessageId);
          if (existingMessage) {
            newMap.set(optimisticMessageId, {
              ...existingMessage,
              contents: [{ content: data.transcript, name: "You" }],
            });
          }
          return newMap;
        });
      }
    };

    // Assistant audio chunk
    const handleAssistantAudio = (data: AttemptAssistantAudioEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;
      voiceInputRef.current?.enqueue_audio_delta(data.audio);
    };

    // Chat ended
    const handleChatEnded = async (data: AttemptChatEndedEvent) => {
      if (data.chat_id === currentChatIdRef.current) {
        freshlyCompletedChatsRef.current.add(data.chat_id);
        await router.refresh();

        if (data.next_chat_id && !data.is_attempt_finished) {
          pendingNextChatIdRef.current = data.next_chat_id;
          const nextChatExists = chats?.some((c) => c.id === data.next_chat_id);
          if (nextChatExists) {
            const sortedChats = [...(chats || [])].sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0)
            );
            const nextIndex = sortedChats.findIndex((c) => c.id === data.next_chat_id);
            if (nextIndex !== -1) {
              setCurrentChatIndex(nextIndex);
              pendingNextChatIdRef.current = null;
            }
          }
        }
      }
    };

    // Attempt ended
    const handleAttemptEnded = async (data: AttemptEndedEvent) => {
      if (data.attempt_id === attempt_id) {
        router.refresh();
      }

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    // Grading progress
    const handleGrading = (data: AttemptGradingProgressEvent) => {
      const isCurrentChat = data.chat_id === currentChatIdRef.current;

      if (isCurrentChat) {
        if (data.type === "start") {
          isGradingRef.current = true;
          setIsGrading(true);
          const initialTotal = data.total_count ?? (data.standards_graded as number | undefined);
          if (initialTotal !== undefined) {
            const initialProgress = {
              completed: 0,
              total: initialTotal,
              displayedProgress: 0,
              phase: "tools" as const,
            };
            gradingProgressRef.current = initialProgress;
            setGradingProgress(initialProgress);
          }
        } else if (
          data.type === "standard_graded" &&
          data.completed_count !== undefined &&
          data.total_count !== undefined
        ) {
          isGradingRef.current = true;
          setIsGrading(true);
          const completedCount = data.completed_count;
          const totalCount = data.total_count;
          setGradingProgress((prev) => {
            const allToolsComplete = completedCount === totalCount;
            const newPhase = allToolsComplete ? "summary" : prev?.phase || "tools";

            let displayedProgress: number;
            if (newPhase === "tools") {
              displayedProgress = Math.min((completedCount / totalCount) * 90, 90);
            } else {
              displayedProgress = 95;
            }

            if (!prev) {
              const newProgress = {
                completed: completedCount,
                total: totalCount,
                displayedProgress,
                phase: newPhase,
              };
              gradingProgressRef.current = newProgress;
              return newProgress;
            }

            const updatedProgress = {
              ...prev,
              completed: completedCount,
              total: totalCount,
              phase: newPhase,
              displayedProgress,
            };
            gradingProgressRef.current = updatedProgress;
            return updatedProgress;
          });
        } else if (data.type === "summary_recorded") {
          setGradingProgress((prev) => {
            if (!prev) return null;
            const updatedProgress = {
              ...prev,
              phase: "summary" as const,
              displayedProgress: 95,
            };
            gradingProgressRef.current = updatedProgress;
            return updatedProgress;
          });
        } else if (data.type === "complete") {
          setGradingProgress((prev) => {
            if (!prev) return null;
            return { ...prev, displayedProgress: 100 };
          });
          setTimeout(() => {
            isGradingRef.current = false;
            setIsGrading(false);
            setGradingProgress(null);
            gradingProgressRef.current = null;
          }, 300);
        }
      } else if (isGrading && gradingProgress) {
        isGradingRef.current = false;
        setIsGrading(false);
        setGradingProgress(null);
        gradingProgressRef.current = null;
      }

      if (
        data.type === "standard_graded" &&
        data.standard_group_name &&
        data.score !== undefined &&
        rubricStructure
      ) {
        const standardGroupsMapping = rubricStructure.standard_groups_mapping || {};
        const standardGroups = rubricStructure.standard_groups || {};
        const standardsMapping = rubricStructure.standards_mapping || {};

        const groupEntry = Object.entries(standardGroupsMapping).find(
          ([, meta]) => meta.name === data.standard_group_name
        );

        if (groupEntry) {
          const [groupId, groupMeta] = groupEntry;
          const standardIds = standardGroups[groupId] || [];

          const matchingStandard = standardIds.find((stdId: string) => {
            const standard = standardsMapping[stdId];
            return standard && standard.points === data.score;
          });

          if (matchingStandard) {
            const passPoints = groupMeta.pass_points || 0;
            const isPassed = (data.score || 0) >= passPoints;

            setOptimisticGradingStates((prev) => {
              const currentState = prev[data.chat_id] || {
                achieved_standards: null,
                passed_standards: null,
                feedback_by_standard_id: null,
              };

              const newAchieved = {
                ...(currentState.achieved_standards || {}),
                [matchingStandard]: true,
              };
              const newPassed = {
                ...(currentState.passed_standards || {}),
                [matchingStandard]: isPassed,
              };
              const newFeedback = {
                ...(currentState.feedback_by_standard_id || {}),
                ...(data.feedback_preview ? { [matchingStandard]: data.feedback_preview } : {}),
              };

              return {
                ...prev,
                [data.chat_id]: {
                  achieved_standards: newAchieved,
                  passed_standards: newPassed,
                  feedback_by_standard_id: Object.keys(newFeedback).length > 0 ? newFeedback : null,
                },
              };
            });
          }
        }
      }
    };

    // Grading complete
    const handleGraded = (data: AttemptGradedEvent) => {
      if (data.chat_id === currentChatIdRef.current) {
        isGradingRef.current = false;
        setIsGrading(false);
        setGradingProgress(null);
        gradingProgressRef.current = null;
        router.refresh();
      }
    };

    // Hint generation
    const handleHint = (data: AttemptHintProgressEvent) => {
      if (data.type === "complete" && data.message_id && data.hints_count) {
        let hints: HintsByMessage["hints"] = [];

        if (data.hints && data.hints.length > 0) {
          hints = data.hints.map((h, index) => ({
            hint: typeof h["hint"] === "string" ? h["hint"] : "",
            idx: typeof h["idx"] === "number" ? h["idx"] : index,
          }));
        }

        setOptimisticHints((prev) => {
          const chatHints = prev[data.chat_id] || [];
          const existingIndex = chatHints.findIndex((h) => h.message_id === data.message_id);

          const newHintGroup: HintsByMessage = {
            message_id: data.message_id,
            hints,
          };

          if (existingIndex >= 0) {
            const updated = [...chatHints];
            updated[existingIndex] = newHintGroup;
            return { ...prev, [data.chat_id]: updated };
          }
          return { ...prev, [data.chat_id]: [...chatHints, newHintGroup] };
        });

        setMessagesWithNewHints((prev) => {
          const newSet = new Set(prev);
          newSet.add(data.message_id);
          return newSet;
        });

        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    };

    // Quiz result
    const handleQuizResult = (data: AttemptResponseResultEvent) => {
      if (data.success) {
        router.refresh();
      } else {
        toast.error(data.message || "Failed to process quiz");
      }
    };

    // Subscribe to events
    socket.on("attempt_assistant_audio", handleAssistantAudio);
    socket.on("attempt_user_start", handleUserStart);
    socket.on("attempt_user_delta", handleUserDelta);
    socket.on("attempt_chat_ended", handleChatEnded);
    socket.on("attempt_ended", handleAttemptEnded);
    socket.on("attempt_grading_progress", handleGrading);
    socket.on("attempt_graded", handleGraded);
    socket.on("attempt_hint_progress", handleHint);
    socket.on("attempt_response_result", handleQuizResult);

    return () => {
      socket.off("attempt_assistant_audio", handleAssistantAudio);
      socket.off("attempt_user_start", handleUserStart);
      socket.off("attempt_user_delta", handleUserDelta);
      socket.off("attempt_chat_ended", handleChatEnded);
      socket.off("attempt_ended", handleAttemptEnded);
      socket.off("attempt_grading_progress", handleGrading);
      socket.off("attempt_graded", handleGraded);
      socket.off("attempt_hint_progress", handleHint);
      socket.off("attempt_response_result", handleQuizResult);
    };
  }, [
    socket,
    setOptimisticMessages,
    router,
    attempt_id,
    chats,
    rubricStructure,
    isGrading,
    gradingProgress,
  ]);

  // ---------------------------------------------------------------------------
  // COMPONENT PROPS
  // ---------------------------------------------------------------------------

  const chatHeaderProps: ChatHeaderProps = useMemo(() => {
    const chatDocuments = resolvedChat?.documents || [];
    const hasContent = chatDocuments.length > 0;
    const currentChatData = attemptData?.views?.simulation_chats?.[currentChatIndex];
    const hasVideoQuestions = (resolvedChat?.questions?.length ?? 0) > 0;
    return {
      timer: attemptData?.timer ? displayTimer : undefined,
      show_documents: showDocuments,
      show_objectives: showObjectives,
      show_rubric: showGrades,
      show_responses: showResponses,
      has_documents: hasContent,
      has_video_questions: hasVideoQuestions,
      on_toggle_documents: setShowDocuments,
      on_toggle_objectives: setShowObjectives,
      on_toggle_rubric: handleToggleGrades,
      on_toggle_responses: setShowResponses,
      objectives:
        (resolvedChat?.objectives || [])
          .map((o) => o.objective)
          .filter(Boolean) as string[],
      scenario_title: scenario?.problem_statement || scenario?.name || null,
      attempt: attemptData?.attempt || null,
      simulation: attemptData?.simulation || null,
      current_dynamic_rubric: (() => {
        const chatData = attemptData?.views?.simulation_chats?.[currentChatIndex];
        const grade = chatData?.grade;
        if (!grade || !chatData?.id) return null;
        return {
          chat_id: chatData.id,
          score: grade.score ?? 0,
          total_possible_points: grade.total_points ?? 0,
          passed: grade.passed ?? false,
        };
      })(),
      expected_chat_count: attemptData?.expected_chat_count || 1,
      chats:
        attemptData?.views?.simulation_chats?.map((c) => ({
          id: c.id || "",
          completed: c.completed ?? null,
        })) || [],
      display_chat: currentChat
        ? {
          id: currentChat.id,
          completed: currentChat.completed ?? null,
        }
        : null,
    };
  }, [
    attemptData,
    currentChatIndex,
    currentChat,
    resolvedChat,
    scenario,
    displayTimer,
    showDocuments,
    showObjectives,
    showGrades,
    showResponses,
  ]);

  const chatAreaProps = useMemo(() => {
    const currentChatData = attemptData?.views?.simulation_chats?.[currentChatIndex];
    const resolvedMessages =
      (currentChat?.id ? messagesByChat[String(currentChat.id)] : null) || [];

    if (chatAreaViewMode === "messages") {
      const props: MessagesViewProps = {
        // Pass server messages directly - they already match MessageData type
        messages: resolvedMessages,
        streaming_content: streamingContent,
        optimistic_messages: optimisticMessages,
        current_chat: currentChat
          ? { id: currentChat.id, completed: currentChat.completed ?? null }
          : null,
        new_hint_message_ids: newHintMessageIds,
        send_message: handleSendMessage,
        is_sending_message: isSendingMessage,
        is_active: isActive,
        disabled: !isAttemptOwner || !currentChat || currentChat.completed,
        is_attempt_owner: isAttemptOwner,
        chat_id: currentChat?.id,
      };
      return props;
    } else if (chatAreaViewMode === "graded-messages") {
      const props: MessagesViewProps = {
        // Pass server messages directly - they already match MessageData type
        messages: resolvedMessages || [],
        current_chat: currentChat
          ? { id: currentChat.id, completed: currentChat.completed ?? null }
          : null,
        send_message: handleSendMessage,
        is_sending_message: isSendingMessage,
        is_active: isActive,
        disabled: !isAttemptOwner || !currentChat || currentChat.completed,
        is_attempt_owner: isAttemptOwner,
        chat_id: currentChat?.id,
      };
      return props;
    } else if (chatAreaViewMode === "video") {
      // VideoView - with markers/locking for taking mode, plain for completed
      const isCompleted = currentChat?.completed;
      const props: VideoViewProps = {
        video: resolvedChat?.video ?? null,
        // Pass empty questions/responses when completed to show plain video
        questions: isCompleted ? [] : (resolvedChat?.questions || []),
        responses: isCompleted ? [] : (currentChatData?.responses || []),
        onNavigateToQuestion: isCompleted ? undefined : setQuestionIndex,
        // Allow video to fill available space when completed (no questions input below)
        allowFullHeight: isCompleted ?? false,
      };
      return props;
    } else if (chatAreaViewMode === "graded-video") {
      // QuestionReviewView - shows all questions with full feedback
      const props: QuestionReviewViewProps = {
        questions: resolvedChat?.questions || [],
        responses: currentChatData?.responses || [],
      };
      return props;
    } else {
      // Rubric view
      const serverGradingState =
        (currentChat?.id && mergedGradingStates[currentChat.id]) ||
        currentChatData?.grading_state;

      const props: RubricViewProps = {
        // Pass rubric structure directly - it already matches RubricStructureData type
        rubric_structure: attemptData?.rubric_structure || {},
        grading_state: serverGradingState,
        analyses: currentChatData?.analyses,
      };
      return props;
    }
  }, [
    attemptData,
    currentChatIndex,
    currentChat,
    resolvedChat,
    scenario,
    chatAreaViewMode,
    streamingContent,
    optimisticMessages,
    messagesByChat,
    mergedGradingStates,
    newHintMessageIds,
    handleSendMessage,
    handleQuizResponse,
    isSendingMessage,
    isActive,
    isAttemptOwner,
    setQuestionIndex,
  ]);

  const documentAreaProps: DocumentAreaProps | undefined = useMemo(() => {
    if (!showDocuments) return undefined;
    return {
      visible: showDocuments,
      documents: resolvedChat?.documents || [],
      selected_document_id: selectedDocumentId,
      on_select_document: setSelectedDocumentId,
    };
  }, [showDocuments, resolvedChat, selectedDocumentId]);

  const inputAreaProps = useMemo(() => {
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const currentChatData = attemptData?.views?.simulation_chats?.[currentChatIndex];
    const hasVideoQuestions =
      resolvedChat?.questions && resolvedChat.questions.length > 0;

    // Use QuestionTakingInput for video questions (only in taking mode, not graded-video)
    if (hasVideoQuestions && chatAreaViewMode !== "graded-video") {
      const props: QuestionTakingInputProps = {
        // Pass questions directly - they already match QuestionEntry type
        questions: resolvedChat?.questions || [],
        // Pass responses directly - they already match QuizResponse type (for "Your answer" display)
        responses: currentChatData?.responses || [],
        on_submit: handleQuizResponse,
        disabled: currentChat?.completed ?? false,
        // Controlled navigation (synced with VideoView markers)
        questionIndex,
        onQuestionIndexChange: setQuestionIndex,
      };
      return props;
    } else {
      // Use HybridInput for all text/audio scenarios
      const props: HybridInputProps = {
        text_enabled: textEnabled,
        audio_enabled: audioEnabled,
        enabled: !currentChat?.completed ?? true,
        is_connected: isConnected,
        disabled: false,
        is_attempt_owner: true,
        current_chat: currentChat
          ? {
              id: currentChat.id,
              completed: currentChat.completed ?? null,
            }
          : null,
        // Text input props
        copy_paste_allowed:
          scenario?.copy_paste_allowed ??
          attemptData?.simulation?.copy_paste_allowed ??
          false,
        on_send_message: handleSendMessage,
        on_stop_message: handleStopMessage,
        is_sending_message: isSendingMessage,
        is_stopping_message: isStoppingMessage,
        on_height_change: setInputPanelHeight,
        // Voice input props
        on_voice_start: handleVoiceStart,
        on_voice_stop: handleVoiceStop,
        on_pcm16_data: handlePcm16Data,
        on_mic_mute: handleMicMute,
      };
      return props;
    }
  }, [
    scenario,
    attemptData,
    currentChatIndex,
    currentChat,
    resolvedChat,
    chatAreaViewMode,
    questionIndex,
    isSendingMessage,
    isStoppingMessage,
    isConnected,
    handleSendMessage,
    handleStopMessage,
    handleQuizResponse,
    handleVoiceStart,
    handleVoiceStop,
    handlePcm16Data,
    handleMicMute,
  ]);

  // ---------------------------------------------------------------------------
  // COMPONENT SELECTION
  // ---------------------------------------------------------------------------

  const ChatAreaComponent = useMemo(() => {
    switch (chatAreaViewMode) {
      case "messages":
        return MessagesView;
      case "graded-messages":
        return MessagesView;
      case "video":
        return VideoView;
      case "graded-video":
        return QuestionReviewView;
      case "rubric":
        return RubricView;
      default:
        return MessagesView;
    }
  }, [chatAreaViewMode]);

  const InputAreaComponent = useMemo(() => {
    const hasVideoQuestions =
      resolvedChat?.questions && resolvedChat.questions.length > 0;

    // Use QuestionTakingInput for video questions (only when not in graded-video mode)
    if (hasVideoQuestions && chatAreaViewMode !== "graded-video") {
      return QuestionTakingInput;
    } else {
      // Use HybridInput for all text/audio scenarios
      return HybridInput;
    }
  }, [chatAreaViewMode, resolvedChat]);

  const inputAreaRef = useMemo(() => {
    // HybridInput always needs the ref for audio playback
    if (InputAreaComponent === HybridInput) {
      return voiceInputRef;
    }
    return undefined;
  }, [InputAreaComponent]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  // Lobby state: server says is_lobby (inter-chat interstitial), OR no chats yet with training context
  if (attemptData.is_lobby || (chats.length === 0 && attemptData.training_bundle_entry_id)) {
    const practice = attemptData?.attempt?.practice ?? false;
    return (
      <AttemptLobby
        attemptId={attempt_id}
        trainingBundleEntryId={attemptData.training_bundle_entry_id ?? ""}
        simulationName={attemptData?.simulation?.name ?? null}
        mode={practice ? "practice" : "home"}
        draftId={draftIdProp ?? null}
        infiniteMode={infiniteModeProp}
        userInstructions={userInstructionsProp}
        continuationOptions={attemptData?.available_continuation_options ?? null}
      />
    );
  }

  // Build pagination footer - show in graded view modes OR completed video chats
  const isGradedViewMode = chatAreaViewMode === "rubric" || chatAreaViewMode === "graded-messages" || chatAreaViewMode === "graded-video" || (chatAreaViewMode === "video" && currentChat?.completed);
  const paginationFooter = isGradedViewMode && chats.length > 0 ? (
    <div className="border-t px-4 py-3 flex items-center bg-background relative">
      {/* Left Side - First and Previous Buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentChatIndex(0)}
          disabled={currentChatIndex === 0}
        >
          <span className="sr-only">Go to first chat</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentChatIndex(currentChatIndex - 1)}
          disabled={currentChatIndex === 0}
        >
          <span className="sr-only">Go to previous chat</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Center - Current Chat Info - Badge + Name + Count */}
      <div className="flex items-center gap-2 px-4 absolute left-1/2 -translate-x-1/2">
        {(() => {
          const chat = chats[currentChatIndex];
          if (!chat) return null;

          const rubricResult = allDynamicRubrics.find(
            (rubric) => rubric.chat_id === chat.id
          );

          return (
            <>
              {chat.completed && !rubricResult ? (
                <Badge variant="secondary" className="text-xs">
                  Incomplete
                </Badge>
              ) : rubricResult ? (
                <Badge
                  variant={rubricResult.passed ? "default" : "destructive"}
                  className={`text-xs ${
                    rubricResult.passed
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  }`}
                >
                  {rubricResult.passed ? "Pass" : "Fail"}
                </Badge>
              ) : null}
              <span className="text-sm font-medium">
                {chat.scenario?.name ||
                  attemptData?.resources?.scenarios?.[String(chat.scenario_id)]?.name ||
                  `Chat ${currentChatIndex + 1}`}
              </span>
              <span className="text-sm text-muted-foreground">
                ({currentChatIndex + 1} of {chats.length})
              </span>
            </>
          );
        })()}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Side - Next and Last Buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentChatIndex(currentChatIndex + 1)}
          disabled={currentChatIndex >= chats.length - 1}
        >
          <span className="sr-only">Go to next chat</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => setCurrentChatIndex(chats.length - 1)}
          disabled={currentChatIndex >= chats.length - 1}
        >
          <span className="sr-only">Go to last chat</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  ) : null;

  return (
      <GenericChatInterface
      chat_header={AttemptChatHeader}
      chat_area={ChatAreaComponent}
      document_area={AttemptDocumentArea}
      input_area={InputAreaComponent}
      chat_area_view_mode={chatAreaViewMode}
      on_send_message={handleSendMessage}
      on_stop_message={handleStopMessage}
      show_documents={showDocuments}
      show_document_modal={showDocumentModal}
      show_objectives_modal={showObjectivesModal}
      input_panel_height={inputPanelHeight}
      hide_input_area={chatAreaViewMode === "video" && currentChat?.completed}
      input_area_ref={inputAreaRef}
      pagination_footer={paginationFooter}
      background_image={
        resolvedChat?.background_image || resolvedChat?.images?.[0] || null
      }
      chat_header_props={chatHeaderProps}
      chat_area_props={chatAreaProps}
      document_area_props={documentAreaProps}
      input_area_props={inputAreaProps}
    />
  );
}
