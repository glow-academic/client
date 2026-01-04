/**
 * AttemptChat.tsx
 * Used to display the attempt chat. Will wrap the AttemptInput and AttemptMessages components, creating the unified look. This page will add the header, and timer, as well as toggle the TableRubric in the correct mode. The simulation-context.tsx will be the one that wraps this with the necessary functions to call websocket events.
 * @AshokSaravanan222 & @siladiea
 * 06/27/2025
 */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// UI Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImperativePanelGroupHandle } from "react-resizable-panels";

import type { AttemptFullOut } from "@/app/(main)/home/a/[attemptId]/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ActiveAttemptView from "./ActiveAttemptView";
import GradedAttemptView from "./GradedAttemptView";

// ContentItem type - derived from ChatData
// Questions now come from scenario.questions, not video.questions
type AttemptFullResponse = AttemptFullOut;
type ChatsArray = NonNullable<AttemptFullResponse["chats"]>;
type ChatDataType = ChatsArray extends Array<infer T> ? T : never;
export type ContentItem = ChatDataType;

interface AttemptChatProps {
  attemptId: string;
  attemptData: AttemptFullOut;
}

export default function AttemptChat({
  attemptId,
  attemptData: initialAttemptData,
}: AttemptChatProps) {
  const router = useRouter();
  const { effectiveProfile, activeProfile, socket, isConnected } = useProfile();

  // Infer types from the API response
  type Chat = ChatDataType["chat"];

  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Initialize state from server snapshot
  const [attemptData, setAttemptData] = useState<AttemptFullResponse | null>(
    initialAttemptData
  );

  // Simulation state management
  // Track if we've initialized from server data to prevent overwriting user's current view
  const hasInitializedFromServerRef = useRef(false);
  const [currentChatIndex, setCurrentChatIndex] = useState(
    initialAttemptData.current_chat_index ?? 0
  );

  // Content index state - tracks which content item (chat/video) is currently displayed
  // Note: currentContentIndex is not currently used but kept for future video support
  const [_currentContentIndex, setCurrentContentIndex] = useState(0);

  // Update state when initial prop changes (from router.refresh())
  useEffect(() => {
    // Preserve attemptData during refresh transitions - only update if initialAttemptData is valid
    // During router.refresh(), initialAttemptData may temporarily be null/undefined
    if (initialAttemptData) {
      setAttemptData(initialAttemptData);
    }
    // Sync currentChatIndex from server data ONLY on initial load
    // After that, preserve user's current view during refresh to prevent chat switching
    // This prevents messages from disappearing when server's currentChatIndex changes
    // (e.g., due to branching creating new chats)
    if (initialAttemptData?.current_chat_index !== undefined) {
      if (!hasInitializedFromServerRef.current) {
        // Initial load: sync from server
        setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        hasInitializedFromServerRef.current = true;
      } else if (initialAttemptData.chats) {
        // Subsequent refreshes: only sync if current chat no longer exists or is invalid
        // This preserves user's view while still handling edge cases
        // Use attemptData (current state) to check current chat, not initialAttemptData
        const currentChatId = attemptData?.chats?.[currentChatIndex]?.chat?.id;
        const currentChatStillExists = initialAttemptData.chats.some(
          (c) => c.chat?.id === currentChatId
        );
        if (!currentChatStillExists && initialAttemptData.chats.length > 0) {
          // Current chat no longer exists, sync to server's suggestion
          setCurrentChatIndex(initialAttemptData.current_chat_index ?? 0);
        }
        // Otherwise, keep current index to preserve user's view
      }
    }
    // Sync currentContentIndex - ensure it's within valid bounds
    if (initialAttemptData?.chats) {
      const contentLength = initialAttemptData.chats.length;
      setCurrentContentIndex((prevIndex) => {
        // Clamp to valid range
        if (prevIndex >= contentLength) {
          return Math.max(0, contentLength - 1);
        }
        return prevIndex;
      });
    }
    // Clear optimistic states for chats that now have server data
    // This ensures server data takes precedence after refresh
    // Only clear if we have valid server data (not during refresh transition)
    if (initialAttemptData?.chats) {
      setOptimisticGradingStates((prev) => {
        const updated: Record<string, OptimisticGradingState> = {};
        Object.entries(prev).forEach(([chatId, optimisticState]) => {
          // Keep optimistic state only if server doesn't have grading state for this chat
          const chatData = initialAttemptData?.chats?.find(
            (c) => c.chat?.id === chatId
          );
          if (!chatData?.grading_state) {
            updated[chatId] = optimisticState;
          }
        });
        return updated;
      });
      // Clear optimistic hints for chats that now have server hints with actual content
      setOptimisticHints((prev) => {
        const updated: Record<string, HintsByMessage[]> = {};
        Object.entries(prev).forEach(([chatId, optimisticChatHints]) => {
          const chatData = initialAttemptData?.chats?.find(
            (c) => c.chat?.id === chatId
          );
          const serverHints = chatData?.hints || [];

          // Keep optimistic hints only if server doesn't have complete hints for all messages
          // A hint is "complete" if it has hints with non-empty text
          const serverHintsMap = new Map<string, HintsByMessage>();
          serverHints.forEach((h) => {
            if (h.message_id) {
              serverHintsMap.set(h.message_id, h);
            }
          });

          const missingOrIncompleteHints = optimisticChatHints.filter(
            (optimisticHint) => {
              const serverHint = optimisticHint.message_id ? serverHintsMap.get(optimisticHint.message_id) : undefined;
              // Keep optimistic hint if:
              // 1. Server doesn't have hints for this messageId, OR
              // 2. Server hints exist but don't have the same count as optimistic, OR
              // 3. Server hints exist but don't have actual content (empty strings)
              if (!serverHint) {
                return true; // Server doesn't have this hint yet
              }
              // Check if server hints have the same count as optimistic hints
              const serverHintCount = (serverHint.hints || []).length;
              const optimisticHintCount = (optimisticHint.hints || []).length;
              if (serverHintCount !== optimisticHintCount) {
                return true; // Keep if counts don't match (server data incomplete)
              }
              // Check if server hints have actual content (non-empty hint text)
              const hasContent = (serverHint.hints || []).some(
                (h: { hint: string | null }) => h.hint && h.hint.trim().length > 0
              );
              return !hasContent; // Keep if server hints don't have content yet
            }
          );

          if (missingOrIncompleteHints.length > 0) {
            updated[chatId] = missingOrIncompleteHints;
          }
        });
        return updated;
      });
    }
  }, [initialAttemptData, attemptData, currentChatIndex]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [showResults, setShowResults] = useState(
    initialAttemptData.show_results ?? false
  );
  const [showGrades, setShowGrades] = useState(false);
  const [showDocuments, setShowDocuments] = useState(true);
  const [userHasManuallyToggledGrades, setUserHasManuallyToggledGrades] =
    useState(false);

  // Grading progress state
  const [gradingProgress, setGradingProgress] = useState<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const gradingProgressRef = useRef<{
    completed: number;
    total: number;
    displayedProgress: number;
    phase: "tools" | "summary" | null;
  } | null>(null);
  const isGradingRef = useRef(false);

  // Refs for WebSocket and chat management
  const currentRoomRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const freshlyCompletedChatsRef = useRef<Set<string>>(new Set());
  const simulationRef = useRef<typeof simulation | null>(null);
  const pendingNextChatIdRef = useRef<string | null>(null);
  const dataFetchedAtRef = useRef<number>(Date.now());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendingMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [localElapsedOffset, setLocalElapsedOffset] = useState(0);

  // Extract data from v3 response
  const chats = useMemo(
    () => attemptData?.chats?.map((c) => c.chat).filter((chat): chat is NonNullable<typeof chat> => chat !== null) || [],
    [attemptData]
  );
  const attempt = attemptData?.attempt || null;
  const simulation = attemptData?.simulation || null;

  // Derive content array from chats
  // Questions now come from scenario.questions, not video.questions
  // Note: content is not currently used but kept for future video support
  // const content = useMemo<ContentItem[]>(() => {
  //   if (!attemptData?.chats) return [];
  //   return attemptData.chats;
  // }, [attemptData]);

  // Current chat based on index (client-controlled, defaults to server's suggestion)
  const currentChat = useMemo(() => {
    if (!attemptData?.chats || attemptData.chats.length === 0) return null;
    const chatData = attemptData.chats[currentChatIndex];
    return chatData?.chat || attemptData.chats[0]?.chat || null;
  }, [attemptData, currentChatIndex]);

  // Get scenario, documents from v3 data
  const scenario = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    return chatData?.scenario ?? null;
  }, [attemptData, currentChat]);

  const scenarioDocuments = useMemo(
    () => attemptData?.scenario_documents || [],
    [attemptData?.scenario_documents]
  );
  const attemptProfiles = useMemo(
    () => attemptData?.attempt_profiles || [],
    [attemptData?.attempt_profiles]
  );
  const attemptProfileId = useMemo(() => {
    const activeProfile = attemptProfiles.find((ap) => ap["active"]);
    return activeProfile?.["profile_id"] || null;
  }, [attemptProfiles]);

  // Scenarios map - map chatId -> scenario for all chats
  const scenariosByChatId = useMemo(() => {
    if (!attemptData?.chats) return {};
    const map: Record<string, ChatDataType["scenario"]> = {};
    attemptData.chats.forEach((chatData) => {
      if (chatData.chat?.id) {
        map[chatData.chat.id] = chatData.scenario;
      }
    });
    return map;
  }, [attemptData]);

  // Rubric structure
  const rubricStructure = attemptData?.rubric_structure ?? null;

  // Optimistic grading states - updated in realtime from WebSocket events
  // Use camelCase Records for compatibility with TableRubric component
  type OptimisticGradingState = {
    achieved_standards: Array<{ standard_id: string | null; achieved: boolean | null }> | null;
    passed_standards: Array<{ standard_id: string | null; passed: boolean | null }> | null;
    grade_description: string | null;
    feedback_by_standard_id: Array<{ standard_id: string | null; feedback: string | null }> | null;
  };
  const [optimisticGradingStates, setOptimisticGradingStates] = useState<
    Record<string, OptimisticGradingState>
  >({});

  // Optimistic hints - updated in realtime from WebSocket events
  // Structure: Record<chatId, Array<{ messageId: string, hints: Array<...> }>>
  type HintsByMessage = NonNullable<ChatDataType["hints"]>[number];
  const [optimisticHints, setOptimisticHints] = useState<
    Record<string, HintsByMessage[]>
  >({});


  // Grading states map - map chatId -> grading state (merged from server + optimistic)
  const gradingStatesByChatId = useMemo(() => {
    const map: Record<string, NonNullable<ChatDataType["grading_state"]>> = {};

    // First, add server data (keep server type structure)
    if (attemptData?.chats) {
      attemptData.chats.forEach((chatData) => {
        if (chatData.grading_state && chatData.chat?.id) {
          map[chatData.chat.id] = chatData.grading_state;
        }
      });
    }

    // Then, merge/override with optimistic updates (optimistic takes precedence for realtime display)
    Object.entries(optimisticGradingStates).forEach(
      ([chatId, optimisticState]) => {
        // Merge with existing server state if present
        const existingState = map[chatId];
        if (existingState) {
          // Merge: optimistic updates override server data
          map[chatId] = {
            achieved_standards: optimisticState.achieved_standards ?? existingState.achieved_standards,
            passed_standards: optimisticState.passed_standards ?? existingState.passed_standards,
            grade_description: optimisticState.grade_description ?? existingState.grade_description,
            feedback_by_standard_id: optimisticState.feedback_by_standard_id ?? existingState.feedback_by_standard_id,
          };
        } else {
          // Use optimistic state if no server state exists yet
          map[chatId] = optimisticState;
        }
      }
    );

    return map;
  }, [attemptData, optimisticGradingStates]);

  // Messages - get messages for current chat
  const currentMessages = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    const messages = chatData?.messages ?? [];
    // Transform messages to match expected type (personaId: string | null -> optional string)
    return messages.map((msg) => {
      const result: {
        id: string;
        type: string;
        content: string;
        createdAt: string;
        completed?: boolean;
        personaId?: string;
      } = {
        id: msg.id || "",
        type: msg.type || "",
        content: msg.content || "",
        createdAt: msg.created_at || "",
        completed: msg.completed ?? false,
      };
      if (msg.persona_id) {
        result.personaId = msg.persona_id;
      }
      return result;
    });
  }, [attemptData, currentChat]);

  // Personas - get personas for current chat
  const currentPersonas = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    const personas = chatData?.personas ?? [];
    // Transform personas to match expected type (icon/color optional -> required but nullable)
    // Filter out personas with null ids/names and ensure types match
    return personas
      .filter((p): p is typeof p & { id: string; name: string } => 
        p.id !== null && p.name !== null
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon ?? null,
        color: p.color ?? null,
      }));
  }, [attemptData, currentChat]);

  // Hints - get hints for current chat (merged from server + optimistic)
  const currentChatHints = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    const serverHints = chatData?.hints || [];
    const optimisticChatHints = currentChat.id
      ? optimisticHints[currentChat.id] || []
      : [];

    // Merge server hints with optimistic hints
    // Prefer server hints when they have content, use optimistic hints as fallback
    const hintsMap = new Map<string, HintsByMessage>();

    // First add optimistic hints (as fallback for when server doesn't have them yet)
    optimisticChatHints.forEach((hintGroup) => {
      hintsMap.set(hintGroup.message_id || "", hintGroup);
    });

    // Then add/override with server hints (server hints take precedence when they have content)
    serverHints.forEach((hintGroup) => {
      const existingOptimistic = hintsMap.get(hintGroup.message_id || "");

      // Check if server hints have actual content
      const serverHasContent = (hintGroup.hints || []).some(
        (h) => h.hint && h.hint.trim().length > 0
      );

      if (serverHasContent) {
        // Server has content, use it
        hintsMap.set(hintGroup.message_id || "", hintGroup);
      } else if (existingOptimistic) {
        // Server doesn't have content yet, keep optimistic hints
        // (optimistic hints already in map, no need to override)
      } else {
        // No optimistic hints, use server hints even if empty (better than nothing)
        hintsMap.set(hintGroup.message_id || "", hintGroup);
      }
    });

    return Array.from(hintsMap.values());
  }, [attemptData, currentChat, optimisticHints]);

  // Get computed data from v3 response (server-side computations)
  const currentDynamicRubric = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat?.id === currentChat.id
    );
    return chatData?.dynamic_rubric;
  }, [attemptData, currentChat]);

  const allDynamicRubrics = useMemo(
    () =>
      attemptData?.chats
        ?.map((c) => c.dynamic_rubric)
        .filter(
          (r): r is NonNullable<ChatDataType["dynamic_rubric"]> => r !== null
        ) || [],
    [attemptData?.chats]
  );

  const aggregatedResults = attemptData?.aggregated_results || null;

  // Metadata from v3
  const expectedChatCount = attemptData?.expected_chat_count || 1;
  const isSingleChatAttempt = attemptData?.is_single_chat_attempt ?? true;

  // Timer from v3 (server computed baseline) - convert backend format to frontend format
  const serverTimer = useMemo(() => {
    const backendTimer = attemptData?.timer;
    if (!backendTimer) {
      return {
        elapsed: 0,
        remaining: null as number | null,
        expired: false,
      };
    }
    return {
      elapsed: backendTimer.elapsed ?? 0,
      remaining: backendTimer.limit !== null && backendTimer.elapsed !== null
        ? backendTimer.limit - backendTimer.elapsed
        : null,
      expired: backendTimer.exceeded ?? false,
    };
  }, [attemptData?.timer]);

  // Update baseline when server data changes
  useEffect(() => {
    dataFetchedAtRef.current = Date.now();
    setLocalElapsedOffset(0);
  }, [attemptData?.timer?.elapsed]);

  // Tick timer every second for active simulations
  useEffect(() => {
    if (!currentChat || currentChat.completed || showResults) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const secondsSinceFetch = Math.floor(
        (now - dataFetchedAtRef.current) / 1000
      );
      setLocalElapsedOffset(secondsSinceFetch);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentChat, showResults]);

  // Compute display timer
  const timer = useMemo(() => {
    const displayElapsed = serverTimer.elapsed + localElapsedOffset;
    const displayRemaining =
      serverTimer.remaining !== null
        ? serverTimer.remaining - localElapsedOffset
        : null;

    return {
      elapsed: displayElapsed,
      remaining: displayRemaining,
      expired:
        serverTimer.expired ||
        (displayRemaining !== null && displayRemaining <= 0),
    };
  }, [serverTimer, localElapsedOffset]);

  // Update simulation ref when simulation changes
  useEffect(() => {
    simulationRef.current = simulation;
  }, [simulation]);

  // Initialize to first incomplete chat when data loads
  useEffect(() => {
    if (chats && chats.length > 0 && currentChatIndex === 0) {
      const sortedChats = [...chats].sort(
        (a, b) =>
          new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
      );

      const firstIncompleteIndex = sortedChats.findIndex(
        (chat) => !chat.completed
      );

      if (
        firstIncompleteIndex !== -1 &&
        firstIncompleteIndex !== currentChatIndex
      ) {
        setCurrentChatIndex(firstIncompleteIndex);
      }
    }
  }, [chats, currentChatIndex]);

  // Check if current chat is completed and move to next or show results
  useEffect(() => {
    let timerTimeout: NodeJS.Timeout | null = null;

    if (currentChat?.completed && !showResults && currentChat.id) {
      const isFresh = freshlyCompletedChatsRef.current.has(currentChat.id);

      if (isFresh) {
        if (
          !isSingleChatAttempt &&
          currentChatIndex < (chats?.length || 0) - 1
        ) {
          timerTimeout = setTimeout(() => {
            setCurrentChatIndex((prev) => {
              const nextIndex = prev + 1;
              toast.success(
                `Moving to chat ${nextIndex + 1} of ${chats?.length || 0}`
              );
              return nextIndex;
            });
          }, 2000);
        } else {
          setShowResults(true);
        }
      }

      freshlyCompletedChatsRef.current = new Set();
    }

    return () => {
      if (timerTimeout) clearTimeout(timerTimeout);
    };
  }, [
    currentChat?.completed,
    currentChat?.id,
    currentChatIndex,
    chats?.length,
    showResults,
    isSingleChatAttempt,
  ]);

  // Check if all chats are completed and show results
  useEffect(() => {
    if (chats && chats.length > 0 && !showResults) {
      const totalExpectedChats = chats.length;
      const completedChats = chats.filter((chat) => chat.completed).length;

      if (completedChats === totalExpectedChats) {
        setShowResults(true);
      }
    }
  }, [chats, showResults]);

  // Join/leave chat rooms when currentChat changes
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

  // Update the ref whenever currentChat changes
  useEffect(() => {
    const newChatId = currentChat?.id || null;
    currentChatIdRef.current = newChatId;
  }, [currentChat?.id]);

  // WebSocket-based message handler
  const sendMessage = useCallback(
    async (message: string, _isRetry?: boolean) => {
      if (!message.trim() || !currentChat || isSendingMessage || !socket)
        return;

      setIsSendingMessage(true);

      try {
        // Emit directly to member_progress (voice_mode=false for text mode)
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

  // Stop message function
  const stopMessage = useCallback(async () => {
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

  // Set up WebSocket event handlers for simulation events
  useEffect(() => {
    if (!socket) return;

    const handleSimulationNewMessage = async (data: {
      message_id: string;
      chat_id: string;
      role: string;
      content: string;
      completed: boolean;
      created_at: string;
      persona_id?: string;
    }) => {
      // Handle message start for assistant messages
      if (
        (data.role === "assistant" || data.role === "response") &&
        data.chat_id === currentChatIdRef.current
      ) {
        setIsSendingMessage(true);
      }

      // No refresh needed - optimistic messages handle immediate display
      // Refresh will happen on completion to sync final state
    };

    const handleMessageSent = async (_data: {
      message_id: string;
      chat_id: string;
      message: string;
      created_at: string;
    }) => {
      // No refresh needed - optimistic messages handle immediate display
      // The message is already visible via simulation_new_message event
    };

    const handleSimulationMessageComplete = async (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
      completed?: boolean;
      audio?: boolean;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        // Set up fallback timeout to reset isSendingMessage if simulation_run_complete is delayed
        // This ensures the stop button doesn't get stuck even if the event is delayed or lost
        if (sendingMessageTimeoutRef.current) {
          clearTimeout(sendingMessageTimeoutRef.current);
        }
        sendingMessageTimeoutRef.current = setTimeout(() => {
          // Fallback: reset sending state after 2 seconds if simulation_run_complete hasn't fired
          if (currentChatIdRef.current === data.chat_id) {
            setIsSendingMessage(false);
          }
          sendingMessageTimeoutRef.current = null;
        }, 2000); // 2 second fallback timeout

        // Debounce refresh to prevent multiple rapid refreshes
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current);
        }
        refreshTimeoutRef.current = setTimeout(() => {
          router.refresh();
          refreshTimeoutRef.current = null;
        }, 500); // 500ms debounce
      }
    };

    const handleSimulationRunComplete = (data: { chat_id: string }) => {
      if (data.chat_id === currentChatIdRef.current) {
        // Global run complete - turn off stop button (all persona tool calls finished)
        // Clear fallback timeout since we got the real event
        if (sendingMessageTimeoutRef.current) {
          clearTimeout(sendingMessageTimeoutRef.current);
          sendingMessageTimeoutRef.current = null;
        }
        // Reset sending state immediately - this is reliable even during refresh transitions
        setIsSendingMessage(false);
      }
    };

    const handleSimulationMessageCancelled = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        // Clear fallback timeout since message was cancelled
        if (sendingMessageTimeoutRef.current) {
          clearTimeout(sendingMessageTimeoutRef.current);
          sendingMessageTimeoutRef.current = null;
        }
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }
    };

    const handleSimulationMessageError = (data: {
      chat_id: string;
      error: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        // Clear fallback timeout since there was an error
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

        // Server-side Redis cache is already invalidated by the WebSocket handler
        // Wait for router refresh to complete before checking for next chat
        await router.refresh();

        // Set pending next chat ID for navigation
        if (data.next_chat_id && !data.is_attempt_finished) {
          pendingNextChatIdRef.current = data.next_chat_id;

          // Try immediate navigation if chat already exists in current chats
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
      // already doing so in simulation controls
      // if (data.success) {
      //   toast.success(data.message);
      // } else {
      //   toast.error(data.message);
      // }
    };

    const handleEndAllCompleted = async (data: {
      success: boolean;
      message: string;
      attempt_id: string;
    }) => {
      if (data.attempt_id === attemptId) {
        // Server-side Redis cache is already invalidated by the WebSocket handler
        router.refresh();
        setShowResults(true);
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
      // Clear fallback timeout since there was an error
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
      // Clear fallback timeout since stop was requested
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
      // Determine if this event is for the current chat
      const isCurrentChat = data.chat_id === currentChat?.id;

      // Handle grading progress UI for current chat only
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
      } else {
        // For other chats, just reset grading state if we were grading current chat
        if (isGrading && gradingProgress) {
          isGradingRef.current = false;
          setIsGrading(false);
          setGradingProgress(null);
          gradingProgressRef.current = null;
        }
      }

      // Update optimistic grading state for realtime display (for any chat, not just current)
      if (
        data.type === "standard_graded" &&
        data.standard_group_name &&
        data.score !== undefined &&
        rubricStructure
      ) {
        // Find the standard group by name (since shortName is not in the type)
        const standardGroupsMapping = rubricStructure.standard_groups_mapping || [];
        const standardGroupEntry = standardGroupsMapping.find(
          (group) => group.name === data.standard_group_name
        );

        if (standardGroupEntry) {
          const groupId = standardGroupEntry.standard_group_id;
          const standardGroups = rubricStructure.standard_groups || [];
          const groupEntry = standardGroups.find((g) => g.standard_group_id === groupId);
          const standardIds = groupEntry?.standard_ids || [];

          // Find the standard with matching points (score)
          const standardsMapping = rubricStructure.standards_mapping || [];
          const matchingStandard = standardIds.find((stdId: string | null) => {
            if (!stdId) return false;
            const standard = standardsMapping.find((s) => s.standard_id === stdId);
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

              // Convert current state arrays to maps for easier merging
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

              // Update with new values
              achievedMap.set(matchingStandard, true);
              passedMap.set(matchingStandard, isPassed);
              if (data.feedback_preview) {
                feedbackMap.set(matchingStandard, data.feedback_preview);
              }

              // Convert back to arrays
              return {
                ...prev,
                [data.chat_id]: {
                  achieved_standards: Array.from(achievedMap.entries()).map(([standard_id, achieved]) => ({
                    standard_id,
                    achieved,
                  })),
                  passed_standards: Array.from(passedMap.entries()).map(([standard_id, passed]) => ({
                    standard_id,
                    passed,
                  })),
                  feedback_by_standard_id: Array.from(feedbackMap.entries()).map(([standard_id, feedback]) => ({
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

      // Update grade description if summary is provided (for any chat)
      // Note: summary_preview is not in the type but may be present in the event
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

      // Update final grade description if summary is provided (for any chat)
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
      // Only handle "complete" events to add optimistic hints
      if (data.type === "complete" && data.message_id && data.hints_count) {
        // Use hints from event if available (includes hint text), otherwise fall back to hint_ids
        let hints: HintsByMessage["hints"] = [];

        if (data.hints && data.hints.length > 0) {
          // Use hint text from event for immediate display
          hints = data.hints.map((h) => ({
            simulation_message_id: data.message_id,
            hint: h.hint, // Use actual hint text from event
            idx: h.idx,
            created_at: new Date().toISOString(),
          }));
        } else {
          // Fallback: Parse hint_ids to extract messageId and create hint entries
          // hint_ids format: "messageId_0", "messageId_1", "messageId_2"
          const hintIds = data.hint_ids || [];
          hints = hintIds
            .map((hintId, index) => {
              // Extract idx from hintId (format: "messageId_idx")
              const parts = hintId.split("_");
              const lastPart = parts[parts.length - 1];
              const idx =
                parts.length > 1 && lastPart ? parseInt(lastPart, 10) : index;

              // Create placeholder hint (will be replaced by server data on refresh)
              return {
                simulation_message_id: data.message_id,
                hint: "", // Placeholder - will be replaced by server data
                idx: isNaN(idx) ? index : idx,
                created_at: new Date().toISOString(),
              };
            })
            .filter((h) => !isNaN(h.idx)); // Filter out invalid entries
        }

        // Add optimistic hints for this chat
        setOptimisticHints((prev) => {
          const chatHints = prev[data.chat_id] || [];
          // Check if we already have hints for this messageId
          const existingIndex = chatHints.findIndex(
            (h) => h.message_id === data.message_id
          );

          const newHintGroup: HintsByMessage = {
            message_id: data.message_id,
            hints: hints,
          };

          if (existingIndex >= 0) {
            // Update existing hints
            const updated = [...chatHints];
            updated[existingIndex] = newHintGroup;
            return {
              ...prev,
              [data.chat_id]: updated,
            };
          } else {
            // Add new hints
            return {
              ...prev,
              [data.chat_id]: [...chatHints, newHintGroup],
            };
          }
        });
      }
    };

    socket.on("simulations_text_new_message", handleSimulationNewMessage);
    socket.on("simulations_text_message_sent", handleMessageSent);
    socket.on(
      "simulations_text_message_complete",
      handleSimulationMessageComplete
    );
    socket.on("simulations_text_run_complete", handleSimulationRunComplete);
    socket.on(
      "simulations_text_message_cancelled",
      handleSimulationMessageCancelled
    );
    socket.on("simulations_text_message_error", handleSimulationMessageError);
    socket.on("simulations_text_stopped", handleSimulationStopped);
    socket.on("simulations_text_ended", handleSimulationContinued);
    socket.on("simulations_text_end_all_completed", handleEndAllCompleted);
    socket.on("member_progress_error", handleMemberProgressError);
    socket.on("simulations_text_stop_error", handleStopSimulationError);
    socket.on("simulations_text_end_error", handleContinueSimulationError);
    socket.on(
      "simulations_text_grading_progress",
      handleSimulationGradingProgress
    );
    socket.on(
      "simulations_text_hint_generation_progress",
      handleHintGenerationProgress
    );

    // Quiz event handlers
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

    socket.on("quiz_complete_response", handleQuizCompleteResponse);
    socket.on("quiz_complete_error", handleQuizCompleteError);
    socket.on(
      "quiz_submit_response_response",
      handleQuizSubmitResponseResponse
    );
    socket.on("quiz_submit_response_error", handleQuizSubmitResponseError);

    return () => {
      socket.off("simulations_text_new_message", handleSimulationNewMessage);
      socket.off("simulations_text_message_sent", handleMessageSent);
      socket.off(
        "simulation_message_complete",
        handleSimulationMessageComplete
      );
      socket.off("simulation_run_complete", handleSimulationRunComplete);
      socket.off(
        "simulation_message_cancelled",
        handleSimulationMessageCancelled
      );
      socket.off("simulation_message_error", handleSimulationMessageError);
      socket.off("simulations_text_stopped", handleSimulationStopped);
      socket.off("simulations_text_ended", handleSimulationContinued);
      socket.off("simulations_text_end_all_completed", handleEndAllCompleted);
      socket.off("member_progress_error", handleMemberProgressError);
      socket.off("simulation_text_stop_error", handleStopSimulationError);
      socket.off("simulations_text_end_error", handleContinueSimulationError);
      socket.off(
        "simulation_grading_progress",
        handleSimulationGradingProgress
      );
      socket.off(
        "simulations_text_hint_generation_progress",
        handleHintGenerationProgress
      );
      socket.off("quiz_complete_response", handleQuizCompleteResponse);
      socket.off("quiz_complete_error", handleQuizCompleteError);
      socket.off(
        "quiz_submit_response_response",
        handleQuizSubmitResponseResponse
      );
      socket.off("quiz_submit_response_error", handleQuizSubmitResponseError);

      // Clean up refresh timeout on unmount
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      // Clean up sending message timeout on unmount
      if (sendingMessageTimeoutRef.current) {
        clearTimeout(sendingMessageTimeoutRef.current);
      }
    };
  }, [
    socket,
    currentChat?.id,
    attemptId,
    router,
    isGrading,
    gradingProgress,
    chats,
    rubricStructure,
  ]);

  // Update ref when grading state changes
  useEffect(() => {
    isGradingRef.current = isGrading;
  }, [isGrading]);

  // After chats refresh, jump to the next chat if one was provided by the server
  useEffect(() => {
    if (!chats || chats.length === 0) return undefined;
    const desiredNextId = pendingNextChatIdRef.current;
    if (!desiredNextId) return undefined;

    const sortedChats = [...chats].sort(
      (a, b) =>
        new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    );
    const idx = sortedChats.findIndex((c) => c.id === desiredNextId);
    if (idx !== -1) {
      setCurrentChatIndex(idx);
      pendingNextChatIdRef.current = null;
      return undefined;
    }

    // Chat not found yet - might need another refresh, retry after a short delay
    const retryTimeout = setTimeout(() => {
      // Server-side Redis cache is already invalidated by the WebSocket handler
      router.refresh();
    }, 500);

    return () => clearTimeout(retryTimeout);
  }, [chats, attemptId, router]);

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [inputPanelHeight, setInputPanelHeight] = useState<number>(70); // Default height in pixels
  const [showObjectives, setShowObjectives] = useState<boolean>(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);

  // Create a ref for the panel group
  const inputPanelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  // Track which chats have had their timestamps reset to prevent infinite loops
  const resetChatTimestampsRef = useRef<Set<string>>(new Set());

  // Check if current user is the owner of this attempt (activeProfile, effectiveProfile, and attempt.profileId must all match)
  const isAttemptOwner = useMemo(() => {
    if (!activeProfile?.id || !effectiveProfile?.id || !attemptProfileId) {
      return false;
    }
    return (
      (activeProfile.id === effectiveProfile.id &&
        activeProfile.id === attemptProfileId) ||
      activeProfile.role === "guest"
    );
  }, [
    activeProfile?.id,
    effectiveProfile?.id,
    attemptProfileId,
    activeProfile?.role,
  ]);

  // Set breadcrumb context when attempt data is loaded
  useEffect(() => {
    if (simulation?.title && attemptId) {
      const displayName = `${simulation.title}`;
      setEntityMetadata({
        entityId: attemptId,
        entityName: displayName,
        entityType: "attempt",
      });
    }
    return () => clearEntityMetadata();
  }, [simulation?.title, attemptId, setEntityMetadata, clearEntityMetadata]);

  // Get current chat
  const displayChat = chats[currentChatIndex];

  // Chat picker component - reusable Select component for chat selection
  const chatPicker = useMemo(() => {
    if (isSingleChatAttempt) return null;

    return (
      <Select
        value={chats[currentChatIndex]?.id || ""}
        onValueChange={(chatId) => {
          const chatIndex = chats.findIndex((chat) => chat?.id === chatId);
          if (chatIndex !== undefined && chatIndex >= 0) {
            setCurrentChatIndex(chatIndex);
          }
        }}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select chat to view results" />
        </SelectTrigger>
        <SelectContent>
          {chats?.map((chat: Chat | null) => {
            if (!chat?.id) return null;
            // Find rubric result for this chat
            const rubricResult = allDynamicRubrics.find(
              (rubric) => rubric.chat_id === chat.id
            );

            return (
              <SelectItem key={chat.id} value={chat.id}>
                <div className="flex items-center gap-2">
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
                  <span>{chat.title}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }, [isSingleChatAttempt, chats, currentChatIndex, allDynamicRubrics]);

  // Get selected scenario
  const selectedScenario = useMemo(() => {
    if (!displayChat?.id) {
      return scenario;
    }
    return scenariosByChatId[displayChat.id] || scenario;
  }, [displayChat?.id, scenariosByChatId, scenario]);

  // Helper function to calculate time taken from chat timestamps
  const calculateChatTimeTaken = useCallback((chat: Chat | null): number => {
    if (!chat?.completed || !chat.completed_at) return 0;

    const startTime = new Date(chat.created_at || "").getTime();
    const endTime = new Date(chat.completed_at || "").getTime();
    const timeTakenSeconds = Math.floor((endTime - startTime) / 1000);

    return timeTakenSeconds;
  }, []);

  // Helper function to calculate adjusted time limit for multi-simulation attempts
  const calculateAdjustedTimeLimit = useCallback(
    (_chat: Chat | null): number => {
      if (!simulation?.time_limit || !chats) {
        return 0;
      }

      const totalTimeLimitSeconds = simulation.time_limit * 60;
      const totalChats = chats.length;

      // For multi-simulation attempts, split time evenly
      if (totalChats > 1) {
        return Math.floor(totalTimeLimitSeconds / totalChats);
      }

      // For single simulation attempts, use the full time limit
      return totalTimeLimitSeconds;
    },
    [simulation?.time_limit, chats]
  );

  // Helper function to calculate how much time was exceeded for a chat
  const calculateTimeExceeded = useCallback(
    (chat: Chat | null): number => {
      if (!chat?.completed) return 0;

      const timeTaken = calculateChatTimeTaken(chat);
      const adjustedTimeLimit = calculateAdjustedTimeLimit(chat);

      return Math.max(0, timeTaken - adjustedTimeLimit);
    },
    [calculateChatTimeTaken, calculateAdjustedTimeLimit]
  );

  // Reset createdAt timestamp when chat is first loaded (if createdAt and updatedAt are the same)
  useEffect(() => {
    const resetChatTimestamp = async () => {
      if (!currentChat || !isAttemptOwner) return;

      const chat = currentChat;

      // Don't reset timestamps for completed chats
      if (chat.completed) return;

      // Check if we've already reset timestamps for this chat to prevent infinite loops
      if (!chat.id || resetChatTimestampsRef.current.has(chat.id)) return;

      const createdAt = new Date(chat.created_at ?? 0);
      const updatedAt = new Date(chat.updated_at ?? 0);

      // Check if createdAt and updatedAt are the same (within 1 second tolerance)
      const timeDiff = Math.abs(createdAt.getTime() - updatedAt.getTime());
      if (timeDiff <= 1000) {
        // Mark this chat as processed to prevent infinite loops
        if (chat.id) {
          resetChatTimestampsRef.current.add(chat.id);
        }

        // Reset createdAt to current time ONLY - never update updatedAt
        const now = new Date();

        try {
          if (chat.id && socket && isConnected) {
            socket.emit("simulation_enter", {
              chat_id: chat.id,
              created_at: now.toISOString(),
            });
          }
        } catch {
          // Error handling - timestamp reset failed silently
        }
      }
    };

    resetChatTimestamp();
  }, [currentChat, isAttemptOwner, attemptId, socket, isConnected]);

  // Auto-select first chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (showResults && chats && chats.length > 0 && currentChatIndex === 0) {
      // Ensure we're on the first chat
      if (chats[0] && currentChatIndex !== 0) {
        setCurrentChatIndex(0);
      }

      // If all chats are completed, default to showing rubric (only if user hasn't manually toggled)
      const completedChats = chats.filter((chat: Chat | null) => chat?.completed);
      if (
        completedChats.length === chats.length &&
        !userHasManuallyToggledGrades
      ) {
        setShowGrades(true);
      }
    }
  }, [showResults, chats, currentChatIndex, userHasManuallyToggledGrades]);

  // Reset selected document when chat changes - scope to current chat's documents
  useEffect(() => {
    if (!displayChat || !scenarioDocuments) {
      setSelectedDocumentId(null);
      return;
    }

    // Filter documents to only include current chat's documents
    const currentChatDocIds = displayChat.document_ids || [];
    const filteredDocs = scenarioDocuments.filter((doc: { document_id: string | null }) =>
      doc.document_id && currentChatDocIds.includes(doc.document_id)
    );

    // Set to first document of current chat, or null if no documents
    if (filteredDocs.length > 0) {
      // Only update if current selection is not valid for this chat
      if (
        !selectedDocumentId ||
        !currentChatDocIds.includes(selectedDocumentId)
      ) {
        const firstDoc = filteredDocs[0];
        if (firstDoc) {
          setSelectedDocumentId(firstDoc.document_id);
        }
      }
    } else {
      setSelectedDocumentId(null);
    }
  }, [displayChat, currentChatIndex, scenarioDocuments, selectedDocumentId]);

  if (!chats || chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Attempt Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The attempt you're looking for doesn't exist or has no chats
              available.
            </p>
            <Button onClick={() => router.push("/home")}>
              Return To Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In infinite mode, force chat view until time has expired OR attempt is inactive
  const isAttemptInfinite = Boolean(attempt?.infinite_mode);
  const hasTimeLimit = Boolean(simulation?.time_limit);
  const timeRemaining = timer.remaining;
  const isAttemptActive = attemptData?.is_active ?? true; // Default to true for backwards compatibility
  const shouldForceChatView =
    isAttemptInfinite &&
    isAttemptActive &&
    (!hasTimeLimit || (timeRemaining ?? 1) > 0);

  // Show results screen (but not during active infinite mode)
  if (showResults && !shouldForceChatView) {
    return (
      <GradedAttemptView
        attemptId={attemptId}
        attempt={attempt}
        simulation={simulation}
        scenario={scenario}
        currentChat={currentChat}
        displayChat={displayChat || null}
        chats={chats}
        currentChatIndex={currentChatIndex}
        isSingleChatAttempt={isSingleChatAttempt}
        expectedChatCount={expectedChatCount}
        scenarioDocuments={scenarioDocuments}
        scenariosByChatId={scenariosByChatId}
        allDynamicRubrics={allDynamicRubrics}
        aggregatedResults={aggregatedResults}
        rubricStructure={rubricStructure}
        gradingStatesByChatId={gradingStatesByChatId}
        timer={timer}
        showDocuments={showDocuments}
        showDocumentModal={showDocumentModal}
        showObjectives={showObjectives}
        showObjectivesModal={showObjectivesModal}
        showGrades={showGrades}
        selectedDocumentId={selectedDocumentId}
        currentMessages={currentMessages}
        currentChatHints={currentChatHints.map((hintGroup) => ({
          messageId: hintGroup.message_id || "",
          hints: (hintGroup.hints || []).map((hint) => ({
            simulationMessageId: hint.simulation_message_id || "",
            hint: hint.hint || "",
            idx: hint.idx ?? 0,
            createdAt: hint.created_at || "",
          })),
        }))}
        personas={currentPersonas}
        isAttemptOwner={isAttemptOwner}
        chatPicker={chatPicker}
        selectedScenario={selectedScenario}
        calculateChatTimeTaken={calculateChatTimeTaken}
        calculateAdjustedTimeLimit={calculateAdjustedTimeLimit}
        calculateTimeExceeded={calculateTimeExceeded}
        setCurrentChatIndex={setCurrentChatIndex}
        setShowGrades={setShowGrades}
        setUserHasManuallyToggledGrades={setUserHasManuallyToggledGrades}
        setShowDocuments={setShowDocuments}
        setShowDocumentModal={setShowDocumentModal}
        setShowObjectives={setShowObjectives}
        setShowObjectivesModal={setShowObjectivesModal}
        setSelectedDocumentId={setSelectedDocumentId}
        hideDocuments={false}
      />
    );
  }

  // Extract video and questions from current content item (ChatData)
  // Video and quiz are properties of ChatData, not scenario
  const currentChatData = attemptData?.chats?.[currentChatIndex];
  const scenarioVideo = currentChatData?.video;
  const scenarioQuestions = currentChatData?.video?.questions || [];
  const hasVideo = Boolean(scenarioVideo?.upload_id);

  // If scenario has video, render video view instead of chat
  // Note: Video is now part of scenario, not a separate content type
  if (hasVideo && scenarioVideo && scenario) {
    // For now, we'll render a simplified video view inline
    // TODO: Create a proper video timeline component to replace AttemptInput
    return (
      <div className="flex flex-col h-full">
        {/* Questions at top (replace problem statement) */}
        {scenarioQuestions.length > 0 && (
          <div className="border-b p-4 space-y-4">
            <h2 className="text-lg font-semibold">Questions</h2>
            {scenarioQuestions.map(
              (
                question: {
                  id: string | null;
                  question_text: string | null;
                  type: string | null;
                  allow_multiple: boolean | null;
                  times: number[] | null;
                  options: Array<{
                    id: string | null;
                    option_text: string | null;
                    type: string | null;
                    is_correct: boolean | null;
                  }> | null;
                },
                idx: number
              ) => (
                <div key={question.id || idx} className="space-y-2">
                  <p className="font-medium">{question.question_text || ""}</p>
                  {question.options && question.options.length > 0 && (
                    <div className="space-y-1 pl-4">
                      {question.options.map(
                        (option: {
                          id: string | null;
                          option_text: string | null;
                          type: string | null;
                          is_correct: boolean | null;
                        }) => (
                          <div
                            key={option.id || ""}
                            className={`p-2 rounded border ${
                              option.is_correct
                                ? "bg-green-50 border-green-200"
                                : "bg-muted/50"
                            }`}
                          >
                            {option.option_text || ""}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Video player in main area */}
        <div className="flex-1 bg-black flex items-center justify-center">
          {scenarioVideo?.upload_id ? (
            <video
              src={`/api/v4/videos/${scenarioVideo.id}/stream`}
              controls
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-white">Video not available</div>
          )}
        </div>

        {/* Submit button below video */}
        {scenarioQuestions.length > 0 && (
          <div className="border-t p-4">
            <Button
              onClick={() => {
                // Handle question submission
                toast.info("Question submission will be handled here");
              }}
              className="w-full"
            >
              Submit Answers
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Default to ActiveAttemptView for scenario content type
  return (
    <ActiveAttemptView
      attemptId={attemptId}
      attempt={attempt}
      simulation={simulation}
      scenario={scenario}
      currentChat={currentChat}
      displayChat={displayChat || null}
      chats={chats}
      expectedChatCount={expectedChatCount}
      scenarioDocuments={scenarioDocuments}
      scenariosByChatId={scenariosByChatId}
      currentDynamicRubric={currentDynamicRubric ?? null}
      timer={timer}
      showDocuments={showDocuments}
      showDocumentModal={showDocumentModal}
      showObjectives={showObjectives}
      showObjectivesModal={showObjectivesModal}
      showGrades={showGrades}
      selectedDocumentId={selectedDocumentId}
      inputPanelHeight={inputPanelHeight}
      inputPanelGroupRef={
        inputPanelGroupRef as React.RefObject<ImperativePanelGroupHandle>
      }
      currentMessages={currentMessages}
      currentChatHints={currentChatHints.map((hintGroup) => ({
        messageId: hintGroup.message_id || "",
        hints: (hintGroup.hints || []).map((hint) => ({
          simulationMessageId: hint.simulation_message_id || "",
          hint: hint.hint || "",
          idx: hint.idx ?? 0,
          createdAt: hint.created_at || "",
        })),
      }))}
      personas={currentPersonas}
      isAttemptOwner={isAttemptOwner}
      isSendingMessage={isSendingMessage}
      isStoppingMessage={isStoppingMessage}
      isConnected={isConnected}
      sendMessage={sendMessage}
      stopMessage={stopMessage}
      setShowDocuments={setShowDocuments}
      setShowDocumentModal={setShowDocumentModal}
      setShowObjectives={setShowObjectives}
      setShowObjectivesModal={setShowObjectivesModal}
      setSelectedDocumentId={setSelectedDocumentId}
      onHeightChange={setInputPanelHeight}
    />
  );
}
