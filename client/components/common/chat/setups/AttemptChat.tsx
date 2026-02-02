/**
 * AttemptChat.tsx
 * Full chat component with unified attempt_* event contract.
 * Uses strongly typed socket events from OpenAPI-generated types.
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { components } from "@/lib/api/schema";
import type { OutputOf } from "@/lib/api/types";
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
import type { QuestionResponsesInputProps } from "../inputAreas/QuestionResponsesInput";
import { QuestionResponsesInput } from "../inputAreas/QuestionResponsesInput";
import type { TextInputProps } from "../inputAreas/TextInput";
import { TextInput } from "../inputAreas/TextInput";
import type { VoiceInputHandle, VoiceInputProps } from "../inputAreas/VoiceInput";
import { VoiceInput } from "../inputAreas/VoiceInput";

// ============================================================================
// TYPES
// ============================================================================

/** Attempt data from server - strongly typed from OpenAPI */
type AttemptData = OutputOf<"/api/v4/attempt/get", "post">;

/** Message data from OpenAPI schema - used for optimistic messages */
type MessageData = components["schemas"]["MessageData"];

// Socket event payload types (auto-generated from server OpenAPI schema)
// Client-to-Server payloads
type AttemptJoinPayload = Parameters<ClientToServerEvents["attempt_join"]>[0];
type AttemptLeavePayload = Parameters<ClientToServerEvents["attempt_leave"]>[0];
type AttemptSendPayload = Parameters<ClientToServerEvents["attempt_send"]>[0];
type AttemptStopPayload = Parameters<ClientToServerEvents["attempt_stop"]>[0];
type AttemptAudioStartPayload = Parameters<ClientToServerEvents["attempt_audio_start"]>[0];
type AttemptAudioStopPayload = Parameters<ClientToServerEvents["attempt_audio_stop"]>[0];
type AttemptAudioFramePayload = Parameters<ClientToServerEvents["attempt_audio_frame"]>[0];
type AttemptMicMutePayload = Parameters<ClientToServerEvents["attempt_mic_mute"]>[0];
type AttemptResponseSubmitPayload = Parameters<ClientToServerEvents["attempt_response_submit"]>[0];

// Server-to-Client event payloads
type AttemptJoinedEvent = Parameters<ServerToClientEvents["attempt_joined"]>[0];
type AttemptUserStartEvent = Parameters<ServerToClientEvents["attempt_user_start"]>[0];
type AttemptUserDeltaEvent = Parameters<ServerToClientEvents["attempt_user_delta"]>[0];
type AttemptUserCompleteEvent = Parameters<ServerToClientEvents["attempt_user_complete"]>[0];
type AttemptAssistantStartEvent = Parameters<ServerToClientEvents["attempt_assistant_start"]>[0];
type AttemptAssistantDeltaEvent = Parameters<ServerToClientEvents["attempt_assistant_delta"]>[0];
type AttemptAssistantAudioEvent = Parameters<ServerToClientEvents["attempt_assistant_audio"]>[0];
type AttemptAssistantCompleteEvent = Parameters<ServerToClientEvents["attempt_assistant_complete"]>[0];
type AttemptTurnCompleteEvent = Parameters<ServerToClientEvents["attempt_turn_complete"]>[0];
type AttemptStoppedEvent = Parameters<ServerToClientEvents["attempt_stopped"]>[0];
type AttemptChatEndedEvent = Parameters<ServerToClientEvents["attempt_chat_ended"]>[0];
type AttemptEndedEvent = Parameters<ServerToClientEvents["attempt_ended"]>[0];
type AttemptAudioReadyEvent = Parameters<ServerToClientEvents["attempt_audio_ready"]>[0];
type AttemptAudioEndedEvent = Parameters<ServerToClientEvents["attempt_audio_ended"]>[0];
type AttemptGradingProgressEvent = Parameters<ServerToClientEvents["attempt_grading_progress"]>[0];
type AttemptHintProgressEvent = Parameters<ServerToClientEvents["attempt_hint_progress"]>[0];
type AttemptResponseResultEvent = Parameters<ServerToClientEvents["attempt_response_result"]>[0];
type AttemptErrorEvent = Parameters<ServerToClientEvents["attempt_error"]>[0];

/** Props for the AttemptChat component */
export interface AttemptChatProps {
  attempt_id: string;
  attempt_data: AttemptData;
}

/** Grading state in Record format (matches server response) */
type OptimisticGradingState = {
  achieved_standards: Record<string, boolean> | null;
  passed_standards: Record<string, boolean> | null;
  grade_description: string | null;
  feedback_by_standard_id: Record<string, string> | null;
};

type HintsByMessage = {
  message_id: string;
  hints: Array<{
    simulation_message_id: string;
    hint: string;
    idx: number;
    created_at: string;
  }>;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AttemptChat({
  attempt_id,
  attempt_data: initialAttemptData,
}: AttemptChatProps) {
  const router = useRouter();
  const { socket, isConnected } = useProfile();

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
  const [userHasManuallyToggledGrades, setUserHasManuallyToggledGrades] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [messagesWithNewHints, setMessagesWithNewHints] = useState<Set<string>>(
    new Set()
  );

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

  // Streaming and optimistic state
  const [streamingContent, setStreamingContent] = useState<Map<string, string>>(
    new Map()
  );
  const [optimisticMessages, setOptimisticMessages] = useState<
    Map<string, MessageData>
  >(new Map());

  // Refs
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const hasInitializedFromServerRef = useRef(false);
  const pendingNextChatIdRef = useRef<string | null>(null);
  const freshlyCompletedChatsRef = useRef<Set<string>>(new Set());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendingMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptDeltasRef = useRef<Map<string, string>>(new Map());
  const itemIdToOptimisticIdRef = useRef<Map<string, string>>(new Map());
  const voiceInputRef = useRef<VoiceInputHandle | null>(null);
  const gradingProgressRef = useRef<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);
  const isGradingRef = useRef(false);

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
      } else if (initialAttemptData.chats) {
        const currentChatId = attemptData?.chats?.[currentChatIndex]?.id;
        const currentChatStillExists = initialAttemptData.chats.some(
          (c) => c.id === currentChatId
        );
        if (!currentChatStillExists && initialAttemptData.chats.length > 0) {
          setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        }
      }
    }

    if (initialAttemptData.chats) {
      setOptimisticGradingStates((prev) => {
        const updated: Record<string, OptimisticGradingState> = {};
        Object.entries(prev).forEach(([chatId, optimisticState]) => {
          const chatData = initialAttemptData.chats?.find((c) => c.id === chatId);
          if (!chatData?.grading_state) {
            updated[chatId] = optimisticState;
          }
        });
        return updated;
      });

      setOptimisticHints((prev) => {
        const updated: Record<string, HintsByMessage[]> = {};
        Object.entries(prev).forEach(([chatId, optimisticChatHints]) => {
          const chatData = initialAttemptData.chats?.find((c) => c.id === chatId);
          const serverHints = chatData?.hints || [];

          const serverHintsMap = new Map<string, HintsByMessage>();
          serverHints.forEach((h) => {
            if (h.message_id) {
              serverHintsMap.set(h.message_id, {
                message_id: h.message_id,
                hints: (h.hints || []).map((hint) => ({
                  simulation_message_id: hint.simulation_message_id || "",
                  hint: hint.hint || "",
                  idx: hint.idx ?? 0,
                  created_at: hint.created_at || "",
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
  }, [attemptData, currentChatIndex, initialAttemptData]);

  useEffect(() => {
    if (!pendingNextChatIdRef.current || !attemptData?.chats) return;
    const nextChatId = pendingNextChatIdRef.current;
    const sortedChats = [...attemptData.chats]
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
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    return attemptData.chats[currentChatIndex] || attemptData.chats[0] || null;
  }, [attemptData, currentChatIndex]);

  const scenario = useMemo(() => {
    if (!currentChat) return null;
    const firstImageUploadId = currentChat.images?.[0]?.upload_id ?? null;
    const firstPersona = currentChat.personas?.[0] ?? null;
    const problemStatementText = currentChat.problem_statement?.problem_statement ?? null;
    return {
      persona_name: firstPersona?.name ?? null,
      persona_icon: firstPersona?.icon ?? null,
      persona_color: firstPersona?.color ?? null,
      objectives: currentChat.objectives?.map((o) => ({
        id: o.objective_id,
        objective: o.objective,
      })) ?? [],
      problem_statement: problemStatementText,
      name: currentChat.scenario_name ?? null,
      background_image: firstImageUploadId,
      copy_paste_allowed: currentChat.copy_paste_allowed ?? null,
      text_enabled: currentChat.text_enabled ?? true,
      audio_enabled: currentChat.audio_enabled ?? false,
    };
  }, [currentChat]);

  const chats = useMemo(
    () =>
      attemptData?.chats?.filter(
        (chat): chat is NonNullable<typeof chat> => chat !== null
      ) || [],
    [attemptData]
  );
  const rubricStructure = attemptData?.rubric_structure || null;
  const isActive = attemptData?.is_active ?? true;
  const isAttemptOwner = true;

  // Check if this is a single chat attempt (no pagination needed)
  const isSingleChatAttempt = chats.length <= 1;

  // Get dynamic rubrics for all chats (for pass/fail badges in pagination)
  const allDynamicRubrics = useMemo(() => {
    return chats
      .map((chat) => chat.dynamic_rubric)
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
      setStreamingContent(new Map());
      setOptimisticMessages(new Map());
      setMessagesWithNewHints(new Set());
      transcriptDeltasRef.current.clear();
      itemIdToOptimisticIdRef.current = new Map();
    }
    prevChatIdRef.current = chatId;
  }, [currentChat?.id]);

  useEffect(() => {
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    const propMessages = currentChatData?.messages;
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
  }, [attemptData, currentChatIndex]);

  // Auto-show grades/rubric when all chats are completed
  useEffect(() => {
    const showResults = attemptData?.show_results ?? false;
    const chats = attemptData?.chats ?? [];

    if (showResults && chats.length > 0 && !userHasManuallyToggledGrades) {
      const allCompleted = chats.every((chat) => chat.completed);
      if (allCompleted) {
        setShowGrades(true);
      }
    }
  }, [attemptData?.show_results, attemptData?.chats, userHasManuallyToggledGrades]);

  // Auto-select first document/template when chat changes or content becomes available
  useEffect(() => {
    const chatDocuments = currentChat?.documents || [];
    const chatTemplates = currentChat?.templates || [];

    // Create unified list with prefixed IDs (documents first, then templates)
    const allItems: { id: string; type: "document" | "template" }[] = [
      ...chatDocuments
        .filter((doc) => doc.document_id)
        .map((doc) => ({ id: `doc:${doc.document_id}`, type: "document" as const })),
      ...chatTemplates
        .filter((t) => t.template_id)
        .map((t) => ({ id: `template:${t.template_id}`, type: "template" as const })),
    ];

    if (allItems.length > 0) {
      // Check if current selection is valid (support both prefixed and non-prefixed IDs)
      const currentSelectionValid = selectedDocumentId && allItems.some((item) => {
        if (item.id === selectedDocumentId) return true;
        // Check non-prefixed for backwards compatibility
        if (item.type === "document" && item.id === `doc:${selectedDocumentId}`) return true;
        if (item.type === "template" && item.id === `template:${selectedDocumentId}`) return true;
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
  }, [currentChat?.documents, currentChat?.templates, currentChat?.id, selectedDocumentId]);

  // ---------------------------------------------------------------------------
  // VIEW MODE
  // ---------------------------------------------------------------------------

  const chatAreaViewMode: ChatAreaViewMode = useMemo(() => {
    if (showGrades) return "rubric";
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    const hasVideo = currentChatData?.videos?.some((v) => v.upload_id);
    if (hasVideo) return "video";
    const hasGradingData =
      currentChatData?.grading_state ||
      currentChatData?.messages?.some((m) => m.feedbacks && m.feedbacks.length > 0);
    if (hasGradingData && currentChat?.completed) return "graded-messages";
    return "messages";
  }, [showGrades, attemptData, currentChatIndex, currentChat]);

  // ---------------------------------------------------------------------------
  // MERGED STATES
  // ---------------------------------------------------------------------------

  const mergedGradingStates = useMemo(() => {
    const map: Record<string, OptimisticGradingState> = {};
    attemptData?.chats?.forEach((chatData) => {
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
          grade_description:
            optimisticState.grade_description ?? existingState.grade_description,
          feedback_by_standard_id:
            optimisticState.feedback_by_standard_id ?? existingState.feedback_by_standard_id,
        };
      } else {
        map[chatId] = optimisticState;
      }
    });

    return map;
  }, [attemptData, optimisticGradingStates]);

  const mergedCurrentChatHints = useMemo(() => {
    if (!currentChat?.id) return [];
    const optimisticChatHints = optimisticHints[currentChat.id] || [];
    const serverHints =
      attemptData?.chats?.find((c) => c.id === currentChat.id)?.hints || [];

    const hintMap = new Map<string, HintsByMessage>();
    optimisticChatHints.forEach((hintGroup) => {
      hintMap.set(hintGroup.message_id, hintGroup);
    });

    serverHints.forEach((hintGroup) => {
      if (!hintGroup.message_id) return;
      const mappedHints: HintsByMessage = {
        message_id: hintGroup.message_id,
        hints: (hintGroup.hints || []).map((hint) => ({
          simulation_message_id: hint.simulation_message_id || "",
          hint: hint.hint || "",
          idx: hint.idx ?? 0,
          created_at: hint.created_at || "",
        })),
      };

      const optimisticHint = hintMap.get(hintGroup.message_id);
      const serverHintCount = mappedHints.hints.length;
      const optimisticHintCount = optimisticHint?.hints.length ?? 0;
      const hasContent = mappedHints.hints.some((h) => h.hint && h.hint.trim().length > 0);

      if (!optimisticHint || hasContent || serverHintCount !== optimisticHintCount) {
        hintMap.set(hintGroup.message_id, mappedHints);
      }
    });

    return Array.from(hintMap.values());
  }, [attemptData, currentChat, optimisticHints]);

  const newHintMessageIds = useMemo(
    () => Array.from(messagesWithNewHints),
    [messagesWithNewHints]
  );

  const normalizeMessageContent = (content: string) => content.trim().toLowerCase();

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
      if (!message.trim() || !currentChat || isSendingMessage || !socket) return;

      setIsSendingMessage(true);
      try {
        socket.emit("attempt_send", {
          chat_id: currentChat.id,
          content: message,
          voice_mode: false,
        });
      } catch (err) {
        toast.error(`Failed to send message: ${err}`);
        setIsSendingMessage(false);
      }
    },
    [currentChat, isSendingMessage, socket]
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

    socket.emit("attempt_audio_start", { chat_id: currentChat.id });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("attempt_audio_ready", handleStartResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session start"));
      }, 10000);

      const handleStartResponse = (data: AttemptAudioReadyEvent) => {
        if (data.chat_id !== currentChat.id) return;
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

    socket.emit("attempt_audio_stop", { chat_id: currentChat.id });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("attempt_audio_ended", handleStopResponse);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session stop"));
      }, 10000);

      const handleStopResponse = (data: AttemptAudioEndedEvent) => {
        if (data.chat_id !== currentChat.id) return;
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
  // WEBSOCKET EVENT HANDLERS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return;

    // Assistant message streaming (text delta)
    const handleAssistantDelta = (data: AttemptAssistantDeltaEvent) => {
      if (data.chat_id === currentChatIdRef.current && data.content !== undefined) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.content);
          return newMap;
        });
      }
    };

    // Assistant message complete
    const handleAssistantComplete = (data: AttemptAssistantCompleteEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      if (data.content !== undefined) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.content);
          return newMap;
        });
      }

      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
      }
      sendingMessageTimeoutRef.current = setTimeout(() => {
        if (currentChatIdRef.current === data.chat_id) {
          setIsSendingMessage(false);
        }
        sendingMessageTimeoutRef.current = null;
      }, 2000);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
        refreshTimeoutRef.current = null;
      }, 500);
    };

    // User message complete (unified for text and voice)
    const handleUserComplete = (data: AttemptUserCompleteEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        let matchedOptimisticId: string | null = null;

        const normalizedContent = normalizeMessageContent(data.content);

        for (const [tempId, optMsg] of newMap.entries()) {
          if (
            optMsg.type === "query" &&
            (tempId.startsWith("optimistic-user-") ||
              tempId.startsWith("optimistic-user-voice-"))
          ) {
            // Get content from first contents entry
            const optContent = optMsg.contents?.[0]?.content || "";
            const optNormalized = normalizeMessageContent(optContent);
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

        newMap.set(data.message_id, {
          id: data.message_id,
          type: "query",
          created_at: data.created_at,
          completed: true,
          contents: [{ content: data.content, name: "You" }],
        });

        return newMap;
      });
    };

    // Assistant message started
    const handleAssistantStart = (data: AttemptAssistantStartEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      setIsSendingMessage(true);

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        newMap.set(data.message_id, {
          id: data.message_id,
          type: "response",
          created_at: data.created_at,
          completed: false,
          contents: [{ content: "" }],
        });
        return newMap;
      });
    };

    // User started speaking (voice)
    const handleUserStart = (data: AttemptUserStartEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      const optimisticMessageId = `optimistic-user-voice-${Date.now()}-${Math.random()}`;

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        for (const [id, msg] of newMap.entries()) {
          // Get content from first contents entry
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

    // Turn complete
    const handleTurnComplete = (data: AttemptTurnCompleteEvent) => {
      if (data.chat_id !== currentChatIdRef.current) return;
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsSendingMessage(false);
    };

    // Response stopped
    const handleStopped = (data: AttemptStoppedEvent) => {
      if (data.chat_id === currentChatIdRef.current) {
        if (sendingMessageTimeoutRef.current) {
          clearTimeout(sendingMessageTimeoutRef.current);
          sendingMessageTimeoutRef.current = null;
        }
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }

      if (data.success && data.message) {
        toast.success(data.message);
      } else if (!data.success) {
        toast.error(data.message);
      }
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
                grade_description: null,
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
                  grade_description: currentState.grade_description,
                },
              };
            });
          }
        }
      }

      if (data.type === "summary_recorded" && "summary_preview" in data) {
        const summaryPreview = (data as { summary_preview?: string }).summary_preview;
        if (summaryPreview) {
          setOptimisticGradingStates((prev) => {
            const currentState = prev[data.chat_id] || {
              achieved_standards: null,
              passed_standards: null,
              feedback_by_standard_id: null,
              grade_description: null,
            };

            return {
              ...prev,
              [data.chat_id]: {
                ...currentState,
                grade_description: summaryPreview ?? null,
              },
            };
          });
        }
      }

      if (data.type === "complete" && data.summary) {
        setOptimisticGradingStates((prev) => {
          const currentState = prev[data.chat_id] || {
            achieved_standards: null,
            passed_standards: null,
            feedback_by_standard_id: null,
            grade_description: null,
          };

          return {
            ...prev,
            [data.chat_id]: {
              ...currentState,
              grade_description: data.summary ?? null,
            },
          };
        });
      }
    };

    // Hint generation
    const handleHint = (data: AttemptHintProgressEvent) => {
      if (data.type === "complete" && data.message_id && data.hints_count) {
        let hints: HintsByMessage["hints"] = [];

        if (data.hints && data.hints.length > 0) {
          hints = data.hints.map((h) => ({
            simulation_message_id: data.message_id,
            hint: h.hint,
            idx: h.idx,
            created_at: new Date().toISOString(),
          }));
        } else {
          const hintIds = data.hint_ids || [];
          hints = hintIds
            .map((hintId, index) => {
              const parts = hintId.split("_");
              const lastPart = parts[parts.length - 1];
              const idx = parts.length > 1 && lastPart ? parseInt(lastPart, 10) : index;
              return {
                simulation_message_id: data.message_id,
                hint: "",
                idx: isNaN(idx) ? index : idx,
                created_at: new Date().toISOString(),
              };
            })
            .filter((h) => !isNaN(h.idx));
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

    // Unified error
    const handleError = (data: AttemptErrorEvent) => {
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsSendingMessage(false);
      setIsStoppingMessage(false);
      toast.error(data.message);
    };

    // Subscribe to events
    socket.on("attempt_assistant_delta", handleAssistantDelta);
    socket.on("attempt_assistant_complete", handleAssistantComplete);
    socket.on("attempt_assistant_start", handleAssistantStart);
    socket.on("attempt_assistant_audio", handleAssistantAudio);
    socket.on("attempt_user_start", handleUserStart);
    socket.on("attempt_user_delta", handleUserDelta);
    socket.on("attempt_user_complete", handleUserComplete);
    socket.on("attempt_turn_complete", handleTurnComplete);
    socket.on("attempt_stopped", handleStopped);
    socket.on("attempt_chat_ended", handleChatEnded);
    socket.on("attempt_ended", handleAttemptEnded);
    socket.on("attempt_grading_progress", handleGrading);
    socket.on("attempt_hint_progress", handleHint);
    socket.on("attempt_response_result", handleQuizResult);
    socket.on("attempt_error", handleError);

    return () => {
      socket.off("attempt_assistant_delta", handleAssistantDelta);
      socket.off("attempt_assistant_complete", handleAssistantComplete);
      socket.off("attempt_assistant_start", handleAssistantStart);
      socket.off("attempt_assistant_audio", handleAssistantAudio);
      socket.off("attempt_user_start", handleUserStart);
      socket.off("attempt_user_delta", handleUserDelta);
      socket.off("attempt_user_complete", handleUserComplete);
      socket.off("attempt_turn_complete", handleTurnComplete);
      socket.off("attempt_stopped", handleStopped);
      socket.off("attempt_chat_ended", handleChatEnded);
      socket.off("attempt_ended", handleAttemptEnded);
      socket.off("attempt_grading_progress", handleGrading);
      socket.off("attempt_hint_progress", handleHint);
      socket.off("attempt_response_result", handleQuizResult);
      socket.off("attempt_error", handleError);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
      }
    };
  }, [socket, router, attempt_id, chats, rubricStructure, isGrading, gradingProgress]);

  // ---------------------------------------------------------------------------
  // COMPONENT PROPS
  // ---------------------------------------------------------------------------

  const chatHeaderProps: ChatHeaderProps = useMemo(() => {
    const timer = attemptData?.timer;
    const chatDocuments = currentChat?.documents || [];
    const chatTemplates = currentChat?.templates || [];
    const hasContent = chatDocuments.length > 0 || chatTemplates.length > 0;
    return {
      timer: timer
        ? {
            elapsed: timer.elapsed ?? 0,
            remaining:
              timer.limit !== null && timer.elapsed !== null
                ? timer.limit - timer.elapsed
                : null,
            expired: timer.exceeded ?? false,
          }
        : undefined,
      show_documents: showDocuments,
      show_objectives: showObjectives,
      show_rubric: showGrades,
      has_documents: hasContent,
      on_toggle_documents: setShowDocuments,
      on_toggle_objectives: setShowObjectives,
      on_toggle_rubric: handleToggleGrades,
      objectives: scenario?.objectives || [],
      scenario_title: scenario?.problem_statement || scenario?.name || null,
      attempt: attemptData?.attempt || null,
      simulation: attemptData?.simulation || null,
      current_dynamic_rubric:
        attemptData?.chats?.[currentChatIndex]?.dynamic_rubric || null,
      expected_chat_count: attemptData?.expected_chat_count || 1,
      chats:
        attemptData?.chats?.map((c) => ({
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
    scenario,
    showDocuments,
    showObjectives,
    showGrades,
  ]);

  const chatAreaProps = useMemo(() => {
    const currentChatData = attemptData?.chats?.[currentChatIndex];

    if (chatAreaViewMode === "messages") {
      const props: MessagesViewProps = {
        // Pass server messages directly - they already match MessageData type
        messages: currentChatData?.messages,
        streaming_content: streamingContent,
        optimistic_messages: optimisticMessages,
        current_chat: currentChat
          ? { id: currentChat.id, completed: currentChat.completed ?? null }
          : null,
        new_hint_message_ids: newHintMessageIds,
        send_message: handleSendMessage,
        is_sending_message: isSendingMessage,
        is_active: isActive,
        background_image: scenario?.background_image ?? null,
        disabled: !isAttemptOwner || !currentChat || currentChat.completed,
        is_attempt_owner: isAttemptOwner,
        chat_id: currentChat?.id,
      };
      return props;
    } else if (chatAreaViewMode === "graded-messages") {
      const props: MessagesViewProps = {
        // Pass server messages directly - they already match MessageData type
        messages: currentChatData?.messages || [],
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
      const firstVideo = currentChatData?.videos?.[0];

      const props: VideoViewProps = {
        video: {
          id: firstVideo?.video_id || "",
          upload_id: firstVideo?.upload_id || "",
        },
        // Pass questions directly - they already match QuestionEntry type
        questions: currentChatData?.questions || [],
        // Pass responses directly - they already match QuizResponse type
        responses: currentChatData?.responses || [],
        on_submit_response: handleQuizResponse,
        disabled: currentChat?.completed ?? false,
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
      };
      return props;
    }
  }, [
    attemptData,
    currentChatIndex,
    currentChat,
    scenario,
    chatAreaViewMode,
    streamingContent,
    optimisticMessages,
    mergedGradingStates,
    newHintMessageIds,
    handleSendMessage,
    handleQuizResponse,
    isSendingMessage,
    isActive,
    isAttemptOwner,
  ]);

  const documentAreaProps: DocumentAreaProps | undefined = useMemo(() => {
    if (!showDocuments) return undefined;
    return {
      visible: showDocuments,
      documents: currentChat?.documents || [],
      templates: currentChat?.templates || [],
      selected_document_id: selectedDocumentId,
      on_select_document: setSelectedDocumentId,
    };
  }, [showDocuments, currentChat, selectedDocumentId]);

  const inputAreaProps = useMemo(() => {
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    const hasVideoQuestions =
      currentChatData?.questions && currentChatData.questions.length > 0;

    if (hasVideoQuestions) {
      const props: QuestionResponsesInputProps = {
        // Pass questions directly - they already match QuestionEntry type
        questions: currentChatData?.questions || [],
        // Pass responses directly - they already match QuizResponse type
        responses: currentChatData?.responses || [],
        on_submit: handleQuizResponse,
        disabled: currentChat?.completed ?? false,
      };
      return props;
    } else if (audioEnabled && !textEnabled) {
      const props: VoiceInputProps = {
        enabled: !currentChat?.completed ?? true,
        on_voice_start: handleVoiceStart,
        on_voice_stop: handleVoiceStop,
        on_pcm16_data: handlePcm16Data,
        on_mic_mute: handleMicMute,
        current_chat: currentChat ? { id: currentChat.id } : null,
        is_connected: isConnected,
      };
      return props;
    } else {
      const props: TextInputProps = {
        enabled: !currentChat?.completed ?? true,
        copy_paste_allowed:
          scenario?.copy_paste_allowed ??
          attemptData?.simulation?.copy_paste_allowed ??
          false,
        on_send_message: handleSendMessage,
        on_stop_message: handleStopMessage,
        is_sending_message: isSendingMessage,
        is_stopping_message: isStoppingMessage,
        is_connected: isConnected,
        current_chat: currentChat
          ? {
              id: currentChat.id,
              completed: currentChat.completed ?? null,
            }
          : null,
        is_attempt_owner: true,
        on_height_change: setInputPanelHeight,
      };
      return props;
    }
  }, [
    scenario,
    attemptData,
    currentChatIndex,
    currentChat,
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
      case "rubric":
        return RubricView;
      default:
        return MessagesView;
    }
  }, [chatAreaViewMode]);

  const InputAreaComponent = useMemo(() => {
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    const hasVideoQuestions =
      currentChatData?.questions && currentChatData.questions.length > 0;

    if (hasVideoQuestions) {
      return QuestionResponsesInput;
    } else if (audioEnabled && !textEnabled) {
      return VoiceInput;
    } else {
      return TextInput;
    }
  }, [scenario, attemptData, currentChatIndex]);

  const inputAreaRef = useMemo(() => {
    if (InputAreaComponent === VoiceInput) {
      return voiceInputRef;
    }
    return undefined;
  }, [InputAreaComponent]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
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
          input_area_ref={inputAreaRef}
          chat_header_props={chatHeaderProps}
          chat_area_props={chatAreaProps}
          document_area_props={documentAreaProps}
          input_area_props={inputAreaProps}
        />
      </div>

      {/* Pagination Footer - Chat Navigation */}
      {!isSingleChatAttempt && chats.length > 0 && (
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
                    {chat.problem_statement?.problem_statement || `Chat ${currentChatIndex + 1}`}
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
      )}
    </div>
  );
}
