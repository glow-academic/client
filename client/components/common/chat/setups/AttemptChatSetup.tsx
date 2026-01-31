/**
 * AttemptChatSetup.tsx
 * Setup file that wires components together (like Persona.tsx)
 * Handles WebSocket orchestration and passes components/data to GenericChatInterface
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { GradedMessagesViewProps } from "../chatAreas/GradedMessagesView";
import { GradedMessagesView } from "../chatAreas/GradedMessagesView";
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

// Explicit, self-contained types for setup props
export interface AttemptChatSetupProps {
  attempt_id: string;

  // Explicit attempt data type - self-contained
  // Note: API returns chats_entry, scenario_documents_junction but pages map to chats, scenario_documents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attempt_data: any;
}

type OptimisticGradingState = {
  achieved_standards: Array<{
    standard_id: string | null;
    achieved: boolean | null;
  }> | null;
  passed_standards: Array<{
    standard_id: string | null;
    passed: boolean | null;
  }> | null;
  grade_description: string | null;
  feedback_by_standard_id: Array<{
    standard_id: string | null;
    feedback: string | null;
  }> | null;
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

export function AttemptChatSetup({
  attempt_id,
  attempt_data: initialAttemptData,
}: AttemptChatSetupProps) {
  const router = useRouter();
  const { socket, isConnected } = useProfile();

  // State management
  const [attemptData, setAttemptData] = useState(initialAttemptData);
  const [currentChatIndex, setCurrentChatIndex] = useState(
    initialAttemptData.current_chat_index ?? 0
  );
  const [showDocuments, setShowDocuments] = useState(true);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);
  const [showGrades, setShowGrades] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
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
    Map<
      string,
      {
        id: string;
        type: "query" | "response";
        content: string;
        created_at: string;
        completed: boolean;
        persona_id?: string | null;
      }
    >
  >(new Map());

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

  useEffect(() => {
    if (!initialAttemptData) return;

    setAttemptData(initialAttemptData);

    if (initialAttemptData.current_chat_index !== undefined) {
      if (!hasInitializedFromServerRef.current) {
        setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        hasInitializedFromServerRef.current = true;
      } else if (initialAttemptData.chats) {
        const currentChatId =
          attemptData?.chats?.[currentChatIndex]?.chat?.id;
        const currentChatStillExists = initialAttemptData.chats.some(
          (c) => c.chat?.id === currentChatId
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
          const chatData = initialAttemptData.chats?.find(
            (c) => c.chat?.id === chatId
          );
          if (!chatData?.grading_state) {
            updated[chatId] = optimisticState;
          }
        });
        return updated;
      });

      setOptimisticHints((prev) => {
        const updated: Record<string, HintsByMessage[]> = {};
        Object.entries(prev).forEach(([chatId, optimisticChatHints]) => {
          const chatData = initialAttemptData.chats?.find(
            (c) => c.chat?.id === chatId
          );
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
              if (!serverHint) {
                return true;
              }
              const serverHintCount = (serverHint.hints || []).length;
              const optimisticHintCount = (optimisticHint.hints || []).length;
              if (serverHintCount !== optimisticHintCount) {
                return true;
              }
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
      .map((c) => c.chat)
      .filter((chat): chat is NonNullable<typeof chat> => chat !== null)
      .sort(
        (a, b) =>
          new Date(a.created_at || "").getTime() -
          new Date(b.created_at || "").getTime()
      );
    const nextIndex = sortedChats.findIndex((c) => c.id === nextChatId);
    if (nextIndex !== -1) {
      setCurrentChatIndex(nextIndex);
      pendingNextChatIdRef.current = null;
    }
  }, [attemptData]);

  // Current chat data
  const currentChat = useMemo(() => {
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    const chatData = attemptData.chats[currentChatIndex];
    return chatData?.chat || attemptData.chats[0]?.chat || null;
  }, [attemptData, currentChatIndex]);

  const scenario = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    return chatData?.scenario ?? null;
  }, [attemptData, currentChat]);

  const chats = useMemo(
    () =>
      attemptData?.chats
        ?.map((c) => c.chat)
        .filter((chat): chat is NonNullable<typeof chat> => chat !== null) ||
      [],
    [attemptData]
  );
  const rubricStructure = attemptData?.rubric_structure || null;

  useEffect(() => {
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);

  useEffect(() => {
    if (!isConnected || !currentChat?.id || !socket) return;
    if (currentRoomRef.current === currentChat.id) return;

    if (currentRoomRef.current) {
      socket.emit("simulation_leave", {
        chat_id: currentRoomRef.current,
        chat_type: "simulation",
      });
    }

    socket.emit("simulation_join", {
      chat_id: currentChat.id,
      chat_type: "simulation",
    });
    currentRoomRef.current = currentChat.id;
    currentChatIdRef.current = currentChat.id;

    return () => {
      if (currentRoomRef.current && socket) {
        socket.emit("simulation_leave", {
          chat_id: currentRoomRef.current,
          chat_type: "simulation",
        });
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
            if (streaming && msg.content.length >= streaming.length) {
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

  // Determine view mode
  const chatAreaViewMode: ChatAreaViewMode = useMemo(() => {
    if (showGrades) return "rubric";
    const currentChatData = attemptData?.chats?.[currentChatIndex];
    if (currentChatData?.video?.upload_id) return "video";
    // Check if we have grading data
    const hasGradingData =
      currentChatData?.grading_state ||
      currentChatData?.messages?.some(
        (m) => m.feedbacks && m.feedbacks.length > 0
      );
    if (hasGradingData && currentChat?.completed) return "graded-messages";
    return "messages";
  }, [showGrades, attemptData, currentChatIndex, currentChat]);

  const mergedGradingStates = useMemo(() => {
    const map: Record<string, OptimisticGradingState> = {};
    attemptData?.chats?.forEach((chatData) => {
      const chatId = chatData.chat?.id;
      if (chatId && chatData.grading_state) {
        map[chatId] = chatData.grading_state;
      }
    });

    Object.entries(optimisticGradingStates).forEach(
      ([chatId, optimisticState]) => {
        const existingState = map[chatId];
        if (existingState) {
          map[chatId] = {
            achieved_standards:
              optimisticState.achieved_standards ??
              existingState.achieved_standards,
            passed_standards:
              optimisticState.passed_standards ?? existingState.passed_standards,
            grade_description:
              optimisticState.grade_description ??
              existingState.grade_description,
            feedback_by_standard_id:
              optimisticState.feedback_by_standard_id ??
              existingState.feedback_by_standard_id,
          };
        } else {
          map[chatId] = optimisticState;
        }
      }
    );

    return map;
  }, [attemptData, optimisticGradingStates]);

  const mergedCurrentChatHints = useMemo(() => {
    if (!currentChat?.id) return [];
    const optimisticChatHints = optimisticHints[currentChat.id] || [];
    const serverHints =
      attemptData?.chats?.find((c) => c.chat?.id === currentChat.id)?.hints ||
      [];

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
      const hasContent = mappedHints.hints.some(
        (h) => h.hint && h.hint.trim().length > 0
      );

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

  const normalizeMessageContent = (content: string) =>
    content.trim().toLowerCase();

  // WebSocket handlers
  const handleSendMessage = useCallback(
    async (message: string, _isRetry?: boolean) => {
      if (!message.trim() || !currentChat || isSendingMessage || !socket)
        return;

      setIsSendingMessage(true);
      try {
        socket.emit("member_progress", {
          chat_id: currentChat.id,
          message: message,
          voice_mode: false,
          upload_id: undefined,
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
      socket.emit("simulation_text_stop", {
        chat_id: currentChat.id,
      });
    } catch (error) {
      toast.error(`Failed to stop message: ${error}`);
      setIsStoppingMessage(false);
    }
  }, [currentChat, isStoppingMessage, socket]);

  const handleVoiceStart = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) {
      toast.error("Cannot enable voice mode: chat or connection not available");
      return;
    }

    socket.emit("simulation_voice_start", { chat_id: currentChat.id });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("simulation_voice_start_response", handleStartResponse);
        socket.off("simulation_voice_start_error", handleStartError);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session start"));
      }, 10000);

      const handleStartResponse = (data: { success: boolean; message: string }) => {
        clearTimeout(timeout);
        cleanup();
        if (data.success) {
          resolve();
        } else {
          reject(new Error(data.message || "Failed to start voice session"));
        }
      };

      const handleStartError = (data: { success: boolean; message: string }) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(data.message || "Failed to start voice session"));
      };

      socket.once("simulation_voice_start_response", handleStartResponse);
      socket.once("simulation_voice_start_error", handleStartError);
    });
  }, [currentChat?.id, isConnected, socket]);

  const handleVoiceStop = useCallback(async () => {
    if (!currentChat?.id || !socket || !isConnected) {
      return;
    }

    socket.emit("simulation_voice_stop", { chat_id: currentChat.id });

    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        socket.off("simulation_voice_stop_response", handleStopResponse);
        socket.off("simulation_voice_stop_error", handleStopError);
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for voice session stop"));
      }, 10000);

      const handleStopResponse = (data: { success: boolean; message: string }) => {
        clearTimeout(timeout);
        cleanup();
        if (data.success) {
          resolve();
        } else {
          reject(new Error(data.message || "Failed to stop voice session"));
        }
      };

      const handleStopError = (data: { success: boolean; message: string }) => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error(data.message || "Failed to stop voice session"));
      };

      socket.once("simulation_voice_stop_response", handleStopResponse);
      socket.once("simulation_voice_stop_error", handleStopError);
    });
  }, [currentChat?.id, isConnected, socket]);

  const handlePcm16Data = useCallback(
    (data: ArrayBuffer) => {
      if (!socket || !isConnected) return;
      socket.emit("audio_frame_send", {
        audio: data,
      });
    },
    [socket, isConnected]
  );

  const handleMicMute = useCallback(
    (muted: boolean) => {
      if (!socket || !isConnected) return;
      socket.emit("mic.set_muted", { muted });
    },
    [socket, isConnected]
  );

  useEffect(() => {
    if (!socket) return;

    const handleSimulationMessageToken = (data: {
      message_id: string;
      chat_id: string;
      token: string;
      accumulated_content: string;
    }) => {
      if (
        data.chat_id === currentChatIdRef.current &&
        data.accumulated_content !== undefined
      ) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.accumulated_content);
          return newMap;
        });
      }
    };

    const handleSimulationMessageComplete = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
      completed?: boolean;
      audio?: boolean;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      if (data.final_content !== undefined) {
        setStreamingContent((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.message_id, data.final_content);
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

    const handleSimulationNewMessage = (data: {
      message_id: string;
      chat_id: string;
      role: string;
      content: string;
      completed: boolean;
      created_at: string;
      persona_id?: string;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      const type = data.role === "user" ? "query" : "response";

      if (type === "response") {
        setIsSendingMessage(true);
      }

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        let matchedOptimisticId: string | null = null;

        if (type === "query") {
          const normalizedContent = normalizeMessageContent(data.content);

          for (const [tempId, optMsg] of newMap.entries()) {
            if (
              optMsg.type === "query" &&
              (tempId.startsWith("optimistic-user-") ||
                tempId.startsWith("optimistic-user-voice-"))
            ) {
              const optNormalized = normalizeMessageContent(optMsg.content);
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
                if (
                  !matchedOptimisticId ||
                  tempId.startsWith("optimistic-user-voice-")
                ) {
                  matchedOptimisticId = tempId;
                }
              }
            }
          }

          if (!matchedOptimisticId) {
            for (const [tempId, optMsg] of newMap.entries()) {
              if (
                optMsg.type === "query" &&
                tempId.startsWith("optimistic-user-voice-")
              ) {
                matchedOptimisticId = tempId;
                break;
              }
            }
          }

          if (matchedOptimisticId) {
            newMap.delete(matchedOptimisticId);
            let matchedItemId: string | null = null;
            for (const [
              itemId,
              optId,
            ] of itemIdToOptimisticIdRef.current.entries()) {
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
        }

        newMap.set(data.message_id, {
          id: data.message_id,
          type,
          content: data.content,
          created_at: data.created_at,
          completed: data.completed,
          persona_id: data.persona_id,
        });

        return newMap;
      });
    };

    const handleVoiceSpeechStarted = (data: {
      chat_id: string;
      item_id: string;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      const optimisticMessageId = `optimistic-user-voice-${Date.now()}-${Math.random()}`;

      setOptimisticMessages((prev) => {
        const newMap = new Map(prev);
        for (const [id, msg] of newMap.entries()) {
          if (
            id.startsWith("optimistic-user-voice-") &&
            (msg.content === "" || !msg.completed)
          ) {
            newMap.delete(id);
            for (const [
              itemId,
              optId,
            ] of itemIdToOptimisticIdRef.current.entries()) {
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
          content: "",
          created_at: new Date().toISOString(),
          completed: false,
        });
        return newMap;
      });
    };

    const handleVoiceTranscriptComplete = (data: {
      chat_id: string;
      item_id: string;
      transcript: string;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;

      transcriptDeltasRef.current.delete(data.item_id);
      const optimisticMessageId = itemIdToOptimisticIdRef.current.get(
        data.item_id
      );

      if (optimisticMessageId) {
        setOptimisticMessages((prev) => {
          const newMap = new Map(prev);
          const existingMessage = newMap.get(optimisticMessageId);
          if (existingMessage) {
            newMap.set(optimisticMessageId, {
              ...existingMessage,
              content: data.transcript,
              completed: true,
            });
          }
          return newMap;
        });
      }
    };

    const handleAssistantAudioDelta = (data: {
      chat_id: string;
      message_id?: string | null;
      audio: ArrayBuffer | string;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;
      voiceInputRef.current?.enqueue_audio_delta(data.audio);
    };

    const handleMessageSent = (_data: {
      message_id: string;
      chat_id: string;
      message: string;
      created_at: string;
    }) => {};

    const handleSimulationRunComplete = (data: { chat_id: string }) => {
      if (data.chat_id !== currentChatIdRef.current) return;
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsSendingMessage(false);
    };

    const handleSimulationMessageCancelled = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
    }) => {
      if (data.chat_id !== currentChatIdRef.current) return;
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsSendingMessage(false);
      setIsStoppingMessage(false);
    };

    const handleSimulationMessageError = (data: {
      chat_id: string;
      error: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        if (sendingMessageTimeoutRef.current) {
          clearTimeout(sendingMessageTimeoutRef.current);
          sendingMessageTimeoutRef.current = null;
        }
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }
      toast.error(`Simulation error: ${data.error}`);
    };

    const handleSimulationStopped = (data: {
      chat_id: string;
      success: boolean;
      message: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        setIsStoppingMessage(false);
        setIsSendingMessage(false);
      }

      if (data.success && data.message) {
        toast.success(data.message);
      } else if (!data.success) {
        toast.error(data.message);
      }
    };

    const handleSimulationContinued = async (data: {
      success: boolean;
      message: string;
      completed_chat_id: string;
      next_chat_id: string | null;
      is_attempt_finished: boolean | null;
      simulation_grade_id?: string | null;
    }) => {
      if (data.completed_chat_id === currentChatIdRef.current) {
        freshlyCompletedChatsRef.current.add(data.completed_chat_id);
        await router.refresh();

        if (data.next_chat_id && !data.is_attempt_finished) {
          pendingNextChatIdRef.current = data.next_chat_id;
          const nextChatExists = chats?.some((c) => c.id === data.next_chat_id);
          if (nextChatExists) {
            const sortedChats = [...(chats || [])].sort(
              (a, b) =>
                new Date(a.created_at || "").getTime() -
                new Date(b.created_at || "").getTime()
            );
            const nextIndex = sortedChats.findIndex(
              (c) => c.id === data.next_chat_id
            );
            if (nextIndex !== -1) {
              setCurrentChatIndex(nextIndex);
              pendingNextChatIdRef.current = null;
            }
          }
        }
      }
    };

    const handleEndAllCompleted = async (data: {
      success: boolean;
      message: string;
      attempt_id: string;
    }) => {
      if (data.attempt_id === attempt_id) {
        router.refresh();
      }

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleMemberProgressError = (data: {
      success: boolean;
      message: string;
    }) => {
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsSendingMessage(false);
      setIsStoppingMessage(false);
      toast.error(data.message);
    };

    const handleStopSimulationError = (data: {
      success: boolean;
      message: string;
    }) => {
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
        sendingMessageTimeoutRef.current = null;
      }
      setIsStoppingMessage(false);
      setIsSendingMessage(false);
      toast.error(data.message);
    };

    const handleContinueSimulationError = (data: {
      success: boolean;
      message: string;
    }) => {
      toast.error(data.message);
    };

    const handleSimulationGradingProgress = (data: {
      type: string;
      chat_id: string;
      standard_group_name?: string;
      standard_group_short_name?: string;
      score?: number;
      feedback_preview?: string;
      completed_count?: number;
      total_count?: number;
      message?: string;
      grade_id?: string;
      total_score?: number;
      passed?: boolean;
      standards_graded?: number;
      time_taken?: number;
      summary?: string;
    }) => {
      const isCurrentChat = data.chat_id === currentChatIdRef.current;

      if (isCurrentChat) {
        if (data.type === "start") {
          isGradingRef.current = true;
          setIsGrading(true);
          const initialTotal =
            data.total_count ?? (data.standards_graded as number | undefined);
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
            const newPhase = allToolsComplete
              ? "summary"
              : prev?.phase || "tools";

            let displayedProgress: number;
            if (newPhase === "tools") {
              displayedProgress = Math.min(
                (completedCount / totalCount) * 90,
                90
              );
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
            return {
              ...prev,
              displayedProgress: 100,
            };
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
        const standardGroupsMapping =
          rubricStructure.standard_groups_mapping || [];
        const standardGroupEntry = standardGroupsMapping.find(
          (group) => group.name === data.standard_group_name
        );

        if (standardGroupEntry) {
          const groupId = standardGroupEntry.standard_group_id;
          const standardGroups = rubricStructure.standard_groups || [];
          const groupEntry = standardGroups.find(
            (g) => g.standard_group_id === groupId
          );
          const standardIds = groupEntry?.standard_ids || [];

          const standardsMapping = rubricStructure.standards_mapping || [];
          const matchingStandard = standardIds.find((stdId: string | null) => {
            if (!stdId) return false;
            const standard = standardsMapping.find(
              (s) => s.standard_id === stdId
            );
            return standard && standard.points === data.score;
          });

          if (matchingStandard) {
            const passPoints = standardGroupEntry.pass_points || 0;
            const isPassed = (data.score || 0) >= passPoints;

            setOptimisticGradingStates((prev) => {
              const currentState = prev[data.chat_id] || {
                achieved_standards: null,
                passed_standards: null,
                feedback_by_standard_id: null,
                grade_description: null,
              };

              const achievedMap = new Map<string, boolean>();
              const passedMap = new Map<string, boolean>();
              const feedbackMap = new Map<string, string>();

              if (currentState.achieved_standards) {
                currentState.achieved_standards.forEach((item) => {
                  if (item.standard_id) {
                    achievedMap.set(item.standard_id, item.achieved ?? false);
                  }
                });
              }
              if (currentState.passed_standards) {
                currentState.passed_standards.forEach((item) => {
                  if (item.standard_id) {
                    passedMap.set(item.standard_id, item.passed ?? false);
                  }
                });
              }
              if (currentState.feedback_by_standard_id) {
                currentState.feedback_by_standard_id.forEach((item) => {
                  if (item.standard_id && item.feedback) {
                    feedbackMap.set(item.standard_id, item.feedback);
                  }
                });
              }

              achievedMap.set(matchingStandard, true);
              passedMap.set(matchingStandard, isPassed);
              if (data.feedback_preview) {
                feedbackMap.set(matchingStandard, data.feedback_preview);
              }

              return {
                ...prev,
                [data.chat_id]: {
                  achieved_standards: Array.from(achievedMap.entries()).map(
                    ([standard_id, achieved]) => ({
                      standard_id,
                      achieved,
                    })
                  ),
                  passed_standards: Array.from(passedMap.entries()).map(
                    ([standard_id, passed]) => ({
                      standard_id,
                      passed,
                    })
                  ),
                  feedback_by_standard_id: Array.from(
                    feedbackMap.entries()
                  ).map(([standard_id, feedback]) => ({
                    standard_id,
                    feedback,
                  })),
                  grade_description: currentState.grade_description,
                },
              };
            });
          }
        }
      }

      if (data.type === "summary_recorded" && "summary_preview" in data) {
        const summaryPreview = (data as { summary_preview?: string })
          .summary_preview;
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

    const handleHintGenerationProgress = (data: {
      type: string;
      message: string;
      error?: string;
      chat_id: string;
      message_id: string;
      hint_ids?: string[];
      hints_count?: number;
      hints?: Array<{ idx: number; hint: string }>;
    }) => {
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
              const idx =
                parts.length > 1 && lastPart ? parseInt(lastPart, 10) : index;
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
          const existingIndex = chatHints.findIndex(
            (h) => h.message_id === data.message_id
          );

          const newHintGroup: HintsByMessage = {
            message_id: data.message_id,
            hints,
          };

          if (existingIndex >= 0) {
            const updated = [...chatHints];
            updated[existingIndex] = newHintGroup;
            return {
              ...prev,
              [data.chat_id]: updated,
            };
          }
          return {
            ...prev,
            [data.chat_id]: [...chatHints, newHintGroup],
          };
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

    const handleQuizCompleteResponse = (data: {
      success: boolean;
      message: string;
      allCorrect: boolean;
    }) => {
      if (data.success) {
        router.refresh();
      } else {
        toast.error(data.message || "Failed to complete quiz");
      }
    };

    const handleQuizCompleteError = (data: {
      success: boolean;
      message: string;
    }) => {
      toast.error(data.message || "Failed to complete quiz");
    };

    const handleQuizSubmitResponseResponse = (data: {
      success: boolean;
      message: string;
      isCorrect: boolean;
    }) => {
      if (data.success) {
        router.refresh();
      } else {
        toast.error(data.message || "Failed to submit quiz response");
      }
    };

    const handleQuizSubmitResponseError = (data: {
      success: boolean;
      message: string;
    }) => {
      toast.error(data.message || "Failed to submit quiz response");
    };

    socket.on("simulation_text_message_token", handleSimulationMessageToken);
    socket.on(
      "simulation_text_message_complete",
      handleSimulationMessageComplete
    );
    socket.on("simulation_text_new_message", handleSimulationNewMessage);
    socket.on("simulation_voice_user_start", handleVoiceSpeechStarted);
    socket.on("simulation_voice_user_complete", handleVoiceTranscriptComplete);
    socket.on("simulation_voice_assistant_delta", handleAssistantAudioDelta);
    socket.on("simulation_text_message_sent", handleMessageSent);
    socket.on("simulation_text_run_complete", handleSimulationRunComplete);
    socket.on(
      "simulation_text_message_cancelled",
      handleSimulationMessageCancelled
    );
    socket.on("simulation_text_message_error", handleSimulationMessageError);
    socket.on("simulation_text_stopped", handleSimulationStopped);
    socket.on("simulation_text_ended", handleSimulationContinued);
    socket.on("simulation_text_end_all_completed", handleEndAllCompleted);
    socket.on("member_progress_error", handleMemberProgressError);
    socket.on("simulation_text_stop_error", handleStopSimulationError);
    socket.on("simulation_text_end_error", handleContinueSimulationError);
    socket.on(
      "simulation_text_grading_progress",
      handleSimulationGradingProgress
    );
    socket.on(
      "simulation_text_hint_generation_progress",
      handleHintGenerationProgress
    );
    socket.on("quiz_complete_response", handleQuizCompleteResponse);
    socket.on("quiz_complete_error", handleQuizCompleteError);
    socket.on(
      "quiz_submit_response_response",
      handleQuizSubmitResponseResponse
    );
    socket.on("quiz_submit_response_error", handleQuizSubmitResponseError);
    socket.on("simulation_error", (data: { success: boolean; message: string }) => {
      toast.error(data.message);
      setIsSendingMessage(false);
      setIsStoppingMessage(false);
    });

    return () => {
      socket.off("simulation_text_message_token", handleSimulationMessageToken);
      socket.off(
        "simulation_text_message_complete",
        handleSimulationMessageComplete
      );
      socket.off("simulation_text_new_message", handleSimulationNewMessage);
      socket.off("simulation_voice_user_start", handleVoiceSpeechStarted);
      socket.off("simulation_voice_user_complete", handleVoiceTranscriptComplete);
      socket.off("simulation_voice_assistant_delta", handleAssistantAudioDelta);
      socket.off("simulation_text_message_sent", handleMessageSent);
      socket.off("simulation_text_run_complete", handleSimulationRunComplete);
      socket.off(
        "simulation_text_message_cancelled",
        handleSimulationMessageCancelled
      );
      socket.off("simulation_text_message_error", handleSimulationMessageError);
      socket.off("simulation_text_stopped", handleSimulationStopped);
      socket.off("simulation_text_ended", handleSimulationContinued);
      socket.off("simulation_text_end_all_completed", handleEndAllCompleted);
      socket.off("member_progress_error", handleMemberProgressError);
      socket.off("simulation_text_stop_error", handleStopSimulationError);
      socket.off("simulation_text_end_error", handleContinueSimulationError);
      socket.off(
        "simulation_text_grading_progress",
        handleSimulationGradingProgress
      );
      socket.off(
        "simulation_text_hint_generation_progress",
        handleHintGenerationProgress
      );
      socket.off("quiz_complete_response", handleQuizCompleteResponse);
      socket.off("quiz_complete_error", handleQuizCompleteError);
      socket.off(
        "quiz_submit_response_response",
        handleQuizSubmitResponseResponse
      );
      socket.off("quiz_submit_response_error", handleQuizSubmitResponseError);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
      }
    };
  }, [socket, router, attempt_id, chats, rubricStructure, isGrading, gradingProgress]);

  // Prepare props for each component
  const chatHeaderProps: ChatHeaderProps = useMemo(() => {
    const timer = attemptData?.timer;
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
      on_toggle_documents: setShowDocuments,
      on_toggle_objectives: setShowObjectives,
      on_toggle_rubric: setShowGrades,
      objectives: scenario?.objectives || [],
      scenario_title: scenario?.problem_statement || scenario?.name || null,
      attempt: attemptData?.attempt || null,
      simulation: attemptData?.simulation || null,
      current_dynamic_rubric:
        attemptData?.chats?.[currentChatIndex]?.dynamic_rubric || null,
      expected_chat_count: attemptData?.expected_chat_count || 1,
      chats:
        attemptData?.chats?.map((c) => ({
          id: c.chat?.id || "",
          completed: c.chat?.completed ?? null,
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
        messages: currentChatData?.messages?.map((m) => ({
          id: m.id,
          // API returns "query" or "response" directly
          type: m.type === "query" ? "query" : "response",
          content: m.content,
          created_at: m.created_at,
          completed: m.completed ?? null,
          persona_id: m.persona_id ?? null,
        })),
        streaming_content: streamingContent,
        optimistic_messages: optimisticMessages,
        personas: currentChatData?.personas || [],
        scenario: scenario
          ? {
              persona_name: scenario.persona_name ?? null,
              persona_icon: scenario.persona_icon ?? null,
              persona_color: scenario.persona_color ?? null,
            }
          : null,
        current_chat: currentChat
          ? {
              id: currentChat.id,
              completed: currentChat.completed ?? null,
            }
          : null,
        current_chat_hints: mergedCurrentChatHints,
        new_hint_message_ids: newHintMessageIds,
        send_message: handleSendMessage,
        is_sending_message: isSendingMessage,
        is_active: !(attemptData?.timer?.exceeded ?? false),
        simulation: attemptData?.simulation
          ? {
              time_limit: attemptData.simulation.time_limit ?? null,
              practice_simulation:
                attemptData.simulation.practice_simulation ?? null,
            }
          : null,
        background_image: scenario?.background_image ?? null,
        chat_id: currentChat?.id,
        is_attempt_owner: true, // Would be determined from profile context
      };
      return props;
    } else if (chatAreaViewMode === "graded-messages") {
      const props: GradedMessagesViewProps = {
        messages:
          currentChatData?.messages?.map((m) => ({
            id: m.id,
            // API returns "query" or "response" directly
            type: m.type === "query" ? "query" : "response",
            content: m.content,
            created_at: m.created_at,
            completed: m.completed ?? null,
            persona_id: m.persona_id ?? null,
            feedbacks: m.feedbacks,
          })) || [],
        personas: currentChatData?.personas || [],
        scenario: scenario
          ? {
              persona_name: scenario.persona_name ?? null,
              persona_icon: scenario.persona_icon ?? null,
              persona_color: scenario.persona_color ?? null,
            }
          : null,
        grade: { id: "graded" },
      };
      return props;
    } else if (chatAreaViewMode === "video") {
      const props: VideoViewProps = {
        video_data: {
          id: currentChatData?.video?.id || "",
          upload_id: currentChatData?.video?.upload_id ?? null,
        },
        video_questions: currentChatData?.video?.questions,
      };
      return props;
    } else {
      const props: RubricViewProps = {
        rubric_data: {
          standard_groups: attemptData?.rubric_structure?.standard_groups || [],
          standard_groups_mapping:
            attemptData?.rubric_structure?.standard_groups_mapping || [],
          standards_mapping:
            attemptData?.rubric_structure?.standards_mapping || [],
        },
        grading_state:
          (currentChat?.id && mergedGradingStates[currentChat.id]) ||
          currentChatData?.grading_state,
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
    mergedCurrentChatHints,
    mergedGradingStates,
    newHintMessageIds,
    handleSendMessage,
    isSendingMessage,
  ]);

  const documentAreaProps: DocumentAreaProps | undefined = useMemo(() => {
    if (!showDocuments) return undefined;
    return {
      visible: showDocuments,
      documents: attemptData?.scenario_documents || [],
      selected_document_id: selectedDocumentId,
      on_select_document: setSelectedDocumentId,
      current_chat: currentChat
        ? {
            document_ids: currentChat.document_ids ?? null,
          }
        : null,
    };
  }, [
    showDocuments,
    attemptData?.scenario_documents,
    selectedDocumentId,
    currentChat,
  ]);

  const inputAreaProps = useMemo(() => {
    // Determine input mode based on scenario settings
    const textEnabled = scenario?.text_enabled !== false;
    const audioEnabled = scenario?.audio_enabled === true;
    const hasVideoQuestions =
      attemptData?.chats?.[currentChatIndex]?.video?.questions &&
      attemptData.chats[currentChatIndex].video?.questions.length > 0;

    if (hasVideoQuestions) {
      const props: QuestionResponsesInputProps = {
        enabled: !currentChat?.completed ?? true,
        questions: attemptData.chats[currentChatIndex].video?.questions || [],
        selected_answers: new Map(),
        on_answer_change: () => {},
        on_submit: () => {},
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
    handleVoiceStart,
    handleVoiceStop,
    handlePcm16Data,
    handleMicMute,
  ]);

  // Determine which components to use
  const ChatAreaComponent = useMemo(() => {
    switch (chatAreaViewMode) {
      case "messages":
        return MessagesView;
      case "graded-messages":
        return GradedMessagesView;
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
    const hasVideoQuestions =
      attemptData?.chats?.[currentChatIndex]?.video?.questions &&
      attemptData.chats[currentChatIndex].video?.questions.length > 0;

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
      input_area_ref={inputAreaRef}
      chat_header_props={chatHeaderProps}
      chat_area_props={chatAreaProps}
      document_area_props={documentAreaProps}
      input_area_props={inputAreaProps}
    />
  );
}
