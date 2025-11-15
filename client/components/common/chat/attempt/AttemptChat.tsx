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

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import {
  CheckCircle2,
  Clock,
  FileText,
  Infinity as InfinityIcon,
  ListChecks,
  Table,
} from "lucide-react";

// Tooltip
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import DocumentSelect from "@/components/common/chat/DocumentSelect";
import DocumentViewer from "@/components/common/chat/viewers/DocumentViewer";
import { formatTime } from "@/utils/time";

import type {
  AttemptFullOut,
  UpdateChatCreatedAtIn,
  UpdateChatCreatedAtOut,
} from "@/app/(main)/home/a/[attemptId]/page";
import TableRubric from "@/components/common/rubric/TableRubric";
import { Progress } from "@/components/ui/progress";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AttemptInput from "./AttemptInput";
import AttemptMessages from "./AttemptMessages";

type UpdateChatCreatedAtBody = UpdateChatCreatedAtIn extends { body: infer B }
  ? B
  : never;

interface AttemptChatProps {
  attemptId: string;
  attemptData: AttemptFullOut;
  updateChatCreatedAtAction?: (
    input: UpdateChatCreatedAtIn
  ) => Promise<UpdateChatCreatedAtOut>;
  revalidateAttemptAction?: (attemptId: string) => Promise<void>;
}

export default function AttemptChat({
  attemptId,
  attemptData: initialAttemptData,
  updateChatCreatedAtAction,
  revalidateAttemptAction,
}: AttemptChatProps) {
  const router = useRouter();
  const { effectiveProfile, activeProfile, socket, isConnected } = useProfile();

  // Infer types from the API response
  type AttemptFullResponse = typeof initialAttemptData;
  type ChatDataType = AttemptFullResponse["chats"][number];
  type Chat = ChatDataType["chat"];

  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Server action handler
  const handleUpdateChatCreatedAt = useCallback(
    async (body: UpdateChatCreatedAtBody) => {
      if (!updateChatCreatedAtAction) {
        throw new Error("updateChatCreatedAtAction is required");
      }
      await updateChatCreatedAtAction({ body });
    },
    [updateChatCreatedAtAction]
  );

  // Wrapper function for compatibility (matching original async signature)
  const updateChatCreatedAt = useCallback(
    async (request: { chatId: string; createdAt: string }) => {
      await handleUpdateChatCreatedAt(request);
    },
    [handleUpdateChatCreatedAt]
  );
  const isMobile = useIsMobile();

  // Initialize state from server snapshot
  const [attemptData, setAttemptData] = useState<AttemptFullResponse | null>(
    initialAttemptData
  );

  // Update state when initial prop changes (from router.refresh())
  useEffect(() => {
    setAttemptData(initialAttemptData);
    // Clear optimistic states for chats that now have server data
    // This ensures server data takes precedence after refresh
    setOptimisticGradingStates((prev) => {
      const updated: Record<string, OptimisticGradingState> = {};
      Object.entries(prev).forEach(([chatId, optimisticState]) => {
        // Keep optimistic state only if server doesn't have grading state for this chat
        const chatData = initialAttemptData?.chats?.find(
          (c) => c.chat.id === chatId
        );
        if (!chatData?.gradingState) {
          updated[chatId] = optimisticState;
        }
      });
      return updated;
    });
  }, [initialAttemptData]);

  // Simulation state management
  const [currentChatIndex, setCurrentChatIndex] = useState(
    initialAttemptData.currentChatIndex ?? 0
  );
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isStoppingMessage, setIsStoppingMessage] = useState(false);
  const [showResults, setShowResults] = useState(
    initialAttemptData.showResults ?? false
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
  const [localElapsedOffset, setLocalElapsedOffset] = useState(0);

  // Extract data from v3 response
  const chats = useMemo(
    () => attemptData?.chats.map((c) => c.chat) || [],
    [attemptData]
  );
  const attempt = attemptData?.attempt || null;
  const simulation = attemptData?.simulation || null;

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
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.scenario ?? null;
  }, [attemptData, currentChat]);

  const scenarioDocuments = useMemo(
    () => attemptData?.scenarioDocuments || [],
    [attemptData?.scenarioDocuments]
  );
  const attemptProfiles = useMemo(
    () => attemptData?.attemptProfiles || [],
    [attemptData?.attemptProfiles]
  );
  const attemptProfileId = useMemo(() => {
    const activeProfile = attemptProfiles.find((ap) => ap["active"]);
    return activeProfile?.["profileId"] || null;
  }, [attemptProfiles]);

  // Scenarios map - map chatId -> scenario for all chats
  const scenariosByChatId = useMemo(() => {
    if (!attemptData?.chats) return {};
    const map: Record<string, ChatDataType["scenario"]> = {};
    attemptData.chats.forEach((chatData) => {
      map[chatData.chat.id] = chatData.scenario;
    });
    return map;
  }, [attemptData]);

  // Rubric structure
  const rubricStructure = attemptData?.rubricStructure ?? null;

  // Optimistic grading states - updated in realtime from WebSocket events
  type OptimisticGradingState = NonNullable<ChatDataType["gradingState"]>;
  const [optimisticGradingStates, setOptimisticGradingStates] = useState<
    Record<string, OptimisticGradingState>
  >({});

  // Grading states map - map chatId -> grading state (merged from server + optimistic)
  const gradingStatesByChatId = useMemo(() => {
    const map: Record<string, NonNullable<ChatDataType["gradingState"]>> = {};

    // First, add server data
    if (attemptData?.chats) {
      attemptData.chats.forEach((chatData) => {
        if (chatData.gradingState) {
          map[chatData.chat.id] = chatData.gradingState;
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
            achievedStandards: {
              ...existingState.achievedStandards,
              ...optimisticState.achievedStandards,
            },
            passedStandards: {
              ...existingState.passedStandards,
              ...optimisticState.passedStandards,
            },
            gradeDescription:
              optimisticState.gradeDescription ??
              existingState.gradeDescription ??
              null,
            feedbackByStandardId: {
              ...(existingState.feedbackByStandardId || {}),
              ...(optimisticState.feedbackByStandardId || {}),
            },
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
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.messages ?? [];
  }, [attemptData, currentChat]);

  // Hints - get hints for current chat
  const currentChatHints = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return [];
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.hints || [];
  }, [attemptData, currentChat]);

  // Get computed data from v3 response (server-side computations)
  const currentDynamicRubric = useMemo(() => {
    if (!attemptData?.chats || !currentChat) return null;
    const chatData = attemptData.chats.find(
      (c) => c.chat.id === currentChat.id
    );
    return chatData?.dynamicRubric;
  }, [attemptData, currentChat]);

  const allDynamicRubrics = useMemo(
    () =>
      attemptData?.chats
        .map((c) => c.dynamicRubric)
        .filter(
          (r): r is NonNullable<ChatDataType["dynamicRubric"]> => r !== null
        ) || [],
    [attemptData]
  );

  const aggregatedResults = attemptData?.aggregatedResults || null;

  // Metadata from v3
  const expectedChatCount = attemptData?.expectedChatCount || 1;
  const isSingleChatAttempt = attemptData?.isSingleChatAttempt ?? true;

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
    const remaining =
      backendTimer.limit !== null
        ? backendTimer.limit - backendTimer.elapsed
        : null;
    return {
      elapsed: backendTimer.elapsed,
      remaining,
      expired: backendTimer.exceeded,
    };
  }, [attemptData?.timer]);

  // Update baseline when server data changes
  useEffect(() => {
    dataFetchedAtRef.current = Date.now();
    setLocalElapsedOffset(0);
  }, [attemptData?.timer.elapsed]);

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
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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

    if (currentChat?.completed && !showResults) {
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
      socket.emit("leave_chat", {
        chat_id: currentRoomRef.current,
        chat_type: "simulation",
      });
    }

    socket.emit("join_chat", {
      chat_id: currentChat.id,
      chat_type: "simulation",
    });
    currentRoomRef.current = currentChat.id;
    currentChatIdRef.current = currentChat.id;

    return () => {
      if (currentRoomRef.current && socket) {
        socket.emit("leave_chat", {
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
    async (message: string, isRetry?: boolean) => {
      if (!message.trim() || !currentChat || isSendingMessage || !socket)
        return;

      setIsSendingMessage(true);

      try {
        socket.emit("send_simulation_message", {
          chat_id: currentChat.id,
          message: message,
          is_retry: isRetry ?? false,
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
      socket.emit("stop_simulation", {
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
    }) => {
      // Handle message start for assistant messages
      if (
        (data.role === "assistant" || data.role === "response") &&
        data.chat_id === currentChatIdRef.current
      ) {
        setIsSendingMessage(true);
      }

      // Refresh when new message arrives for current chat
      if (data.chat_id === currentChatIdRef.current) {
        // Revalidate cache to ensure we get the latest message state
        if (revalidateAttemptAction) {
          await revalidateAttemptAction(attemptId);
        }
        router.refresh();
      }
    };

    const handleMessageSent = async (data: {
      message_id: string;
      chat_id: string;
      message: string;
      created_at: string;
    }) => {
      // Immediately refresh when user message is confirmed by server
      // This provides immediate feedback that the message was received
      if (data.chat_id === currentChatIdRef.current) {
        // Revalidate cache first, then refresh router
        if (revalidateAttemptAction) {
          await revalidateAttemptAction(attemptId);
        }
        router.refresh();
      }
    };

    const handleSimulationMessageComplete = async (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
      completed?: boolean;
      audio?: boolean;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        setIsSendingMessage(false);
        // Revalidate cache first to ensure we get the completed message content
        if (revalidateAttemptAction) {
          await revalidateAttemptAction(attemptId);
        }
        router.refresh();
      }
    };

    const handleSimulationMessageCancelled = (data: {
      message_id: string;
      chat_id: string;
      final_content: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
        setIsSendingMessage(false);
        setIsStoppingMessage(false);
      }
    };

    const handleSimulationMessageError = (data: {
      chat_id: string;
      error: string;
    }) => {
      if (data.chat_id === currentChatIdRef.current) {
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
      next_chat_id: string;
      is_attempt_finished: boolean;
    }) => {
      if (data.completed_chat_id === currentChatIdRef.current) {
        freshlyCompletedChatsRef.current.add(data.completed_chat_id);

        // Revalidate cache first, then refresh
        if (revalidateAttemptAction) {
          await revalidateAttemptAction(attemptId);
        }

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
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
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

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleEndAllCompleted = async (data: {
      success: boolean;
      message: string;
      attempt_id: string;
    }) => {
      if (data.attempt_id === attemptId) {
        // Revalidate cache to ensure we get the final attempt state
        if (revalidateAttemptAction) {
          await revalidateAttemptAction(attemptId);
        }
        router.refresh();
        setShowResults(true);
      }

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    };

    const handleSendSimulationMessageError = (data: {
      success: boolean;
      message: string;
    }) => {
      setIsSendingMessage(false);
      setIsStoppingMessage(false);
      toast.error(data.message);
    };

    const handleStopSimulationError = (data: {
      success: boolean;
      message: string;
    }) => {
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
        const standardGroupEntry = Object.entries(
          rubricStructure.standardGroupsMapping
        ).find(([_, group]) => group.name === data.standard_group_name);

        if (standardGroupEntry) {
          const [groupId, groupInfo] = standardGroupEntry;
          const standardIds = rubricStructure.standardGroups[groupId] || [];

          // Find the standard with matching points (score)
          const matchingStandard = standardIds.find((stdId) => {
            const standard = rubricStructure.standardsMapping[stdId];
            return standard && standard["points"] === data.score;
          });

          if (matchingStandard) {
            const passPoints = groupInfo.passPoints || 0;
            const isPassed = (data.score || 0) >= passPoints;

            setOptimisticGradingStates((prev) => {
              const currentState = prev[data.chat_id] || {
                achievedStandards: {},
                passedStandards: {},
                feedbackByStandardId: {},
              };

              return {
                ...prev,
                [data.chat_id]: {
                  achievedStandards: {
                    ...currentState.achievedStandards,
                    [matchingStandard]: true,
                  },
                  passedStandards: {
                    ...currentState.passedStandards,
                    [matchingStandard]: isPassed,
                  },
                  feedbackByStandardId: {
                    ...currentState.feedbackByStandardId,
                    [matchingStandard]: data.feedback_preview || "",
                  },
                  gradeDescription: currentState.gradeDescription ?? null,
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
              achievedStandards: {},
              passedStandards: {},
              feedbackByStandardId: {},
            };

            return {
              ...prev,
              [data.chat_id]: {
                ...currentState,
                gradeDescription: summaryPreview ?? null,
              },
            };
          });
        }
      }

      // Update final grade description if summary is provided (for any chat)
      if (data.type === "complete" && data.summary) {
        setOptimisticGradingStates((prev) => {
          const currentState = prev[data.chat_id] || {
            achievedStandards: {},
            passedStandards: {},
            feedbackByStandardId: {},
          };

          return {
            ...prev,
            [data.chat_id]: {
              ...currentState,
              gradeDescription: data.summary ?? null,
            },
          };
        });
      }
    };

    socket.on("simulation_new_message", handleSimulationNewMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("simulation_message_complete", handleSimulationMessageComplete);
    socket.on("simulation_message_cancelled", handleSimulationMessageCancelled);
    socket.on("simulation_message_error", handleSimulationMessageError);
    socket.on("simulation_stopped", handleSimulationStopped);
    socket.on("simulation_continued", handleSimulationContinued);
    socket.on("end_all_completed", handleEndAllCompleted);
    socket.on(
      "send_simulation_message_error",
      handleSendSimulationMessageError
    );
    socket.on("stop_simulation_error", handleStopSimulationError);
    socket.on("continue_simulation_error", handleContinueSimulationError);
    socket.on("simulation_grading_progress", handleSimulationGradingProgress);

    return () => {
      socket.off("simulation_new_message", handleSimulationNewMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off(
        "simulation_message_complete",
        handleSimulationMessageComplete
      );
      socket.off(
        "simulation_message_cancelled",
        handleSimulationMessageCancelled
      );
      socket.off("simulation_message_error", handleSimulationMessageError);
      socket.off("simulation_stopped", handleSimulationStopped);
      socket.off("simulation_continued", handleSimulationContinued);
      socket.off("end_all_completed", handleEndAllCompleted);
      socket.off(
        "send_simulation_message_error",
        handleSendSimulationMessageError
      );
      socket.off("stop_simulation_error", handleStopSimulationError);
      socket.off("continue_simulation_error", handleContinueSimulationError);
      socket.off(
        "simulation_grading_progress",
        handleSimulationGradingProgress
      );
    };
  }, [
    socket,
    currentChat?.id,
    attemptId,
    router,
    isGrading,
    gradingProgress,
    revalidateAttemptAction,
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
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const idx = sortedChats.findIndex((c) => c.id === desiredNextId);
    if (idx !== -1) {
      setCurrentChatIndex(idx);
      pendingNextChatIdRef.current = null;
      return undefined;
    }

    // Chat not found yet - might need another refresh, retry after a short delay
    const retryTimeout = setTimeout(() => {
      // Trigger a refresh to get the latest data
      if (revalidateAttemptAction) {
        revalidateAttemptAction(attemptId).then(() => {
          router.refresh();
        });
      }
    }, 500);

    return () => clearTimeout(retryTimeout);
  }, [chats, revalidateAttemptAction, attemptId, router]);

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
          const chatIndex = chats.findIndex((chat) => chat.id === chatId);
          if (chatIndex !== undefined && chatIndex >= 0) {
            setCurrentChatIndex(chatIndex);
          }
        }}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select chat to view results" />
        </SelectTrigger>
        <SelectContent>
          {chats?.map((chat: Chat) => {
            // Find rubric result for this chat
            const rubricResult = allDynamicRubrics.find(
              (rubric) => rubric.chatId === chat.id
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
    if (!chat?.completed || !chat.completedAt) return 0;

    const startTime = new Date(chat.createdAt).getTime();
    const endTime = new Date(chat.completedAt).getTime();
    const timeTakenSeconds = Math.floor((endTime - startTime) / 1000);

    return timeTakenSeconds;
  }, []);

  // Helper function to calculate adjusted time limit for multi-simulation attempts
  const calculateAdjustedTimeLimit = useCallback(
    (_chat: Chat | null): number => {
      if (!simulation?.timeLimit || !chats) {
        return 0;
      }

      const totalTimeLimitSeconds = simulation.timeLimit * 60;
      const totalChats = chats.length;

      // For multi-simulation attempts, split time evenly
      if (totalChats > 1) {
        return Math.floor(totalTimeLimitSeconds / totalChats);
      }

      // For single simulation attempts, use the full time limit
      return totalTimeLimitSeconds;
    },
    [simulation?.timeLimit, chats]
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
      if (resetChatTimestampsRef.current.has(chat.id)) return;

      const createdAt = new Date(chat.createdAt);
      const updatedAt = new Date(chat.updatedAt);

      // Check if createdAt and updatedAt are the same (within 1 second tolerance)
      const timeDiff = Math.abs(createdAt.getTime() - updatedAt.getTime());
      if (timeDiff <= 1000) {
        // Mark this chat as processed to prevent infinite loops
        resetChatTimestampsRef.current.add(chat.id);

        // Reset createdAt to current time ONLY - never update updatedAt
        const now = new Date();

        try {
          await updateChatCreatedAt({
            chatId: chat.id,
            createdAt: now.toISOString(),
          });
        } catch {
          // Error handling - timestamp reset failed silently
        }
      }
    };

    resetChatTimestamp();
  }, [currentChat, isAttemptOwner, attemptId, updateChatCreatedAt]);

  // Auto-select first chat when results show and default to showing rubric if all chats completed
  useEffect(() => {
    if (showResults && chats && chats.length > 0 && currentChatIndex === 0) {
      // Ensure we're on the first chat
      if (chats[0] && currentChatIndex !== 0) {
        setCurrentChatIndex(0);
      }

      // If all chats are completed, default to showing rubric (only if user hasn't manually toggled)
      const completedChats = chats.filter((chat: Chat) => chat.completed);
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
    const currentChatDocIds = displayChat.documentIds || [];
    const filteredDocs = scenarioDocuments.filter((doc) =>
      currentChatDocIds.includes(doc.document_id)
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

  // In infinite mode, force chat view until time has expired
  const isAttemptInfinite = Boolean(attempt?.infiniteMode);
  const hasTimeLimit = Boolean(simulation?.timeLimit);
  const timeRemaining = timer.remaining;
  const shouldForceChatView =
    isAttemptInfinite && (!hasTimeLimit || (timeRemaining ?? 1) > 0);

  // Show results screen (but not during active infinite mode)
  if (showResults && !shouldForceChatView) {
    const isInfiniteMode = attempt?.infiniteMode;
    const infiniteLimitMinutes = simulation?.timeLimit ?? null;
    return (
      <div
        className="h-[calc(100vh-4rem)]"
        data-testid="attempt-chat-container"
        data-attempt-id={attemptId || ""}
      >
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Results Area */}
          <ResizablePanel
            defaultSize={
              showDocuments && scenarioDocuments.length > 0 ? 70 : 100
            }
            className="md:flex-none"
          >
            <Card className="h-full flex flex-col py-4">
              <div className="h-full flex flex-col">
                {/* Timer and Controls Header - consistent with main chat layout */}
                <Collapsible
                  open={showObjectives}
                  onOpenChange={setShowObjectives}
                  className="border-b"
                >
                  <div className="p-4 pt-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        {/* Show scenario information */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {selectedScenario?.problemStatement ||
                              scenario?.problemStatement ||
                              "Session Results"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* Buttons and timer row */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-4">
                            {displayChat && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showGrades ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        setShowGrades(!showGrades);
                                        setUserHasManuallyToggledGrades(true);
                                      }}
                                      className={`p-2 ${showGrades ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <Table className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showGrades
                                        ? "Hide Rubric"
                                        : "Show Rubric"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Documents Toggle - only show if current chat has documents */}
                            {(() => {
                              const currentChatDocIds =
                                displayChat?.documentIds || [];
                              const hasDocumentsForCurrentChat =
                                scenarioDocuments?.some((doc) =>
                                  currentChatDocIds.includes(doc.document_id)
                                );
                              return hasDocumentsForCurrentChat;
                            })() && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (isMobile) {
                                          setShowDocumentModal(true);
                                        } else {
                                          setShowDocuments(!showDocuments);
                                        }
                                      }}
                                      className={`p-2 ${showDocuments ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments
                                        ? "Hide Documents"
                                        : "Show Documents"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Objectives Toggle - only show if simulation has objectives enabled and current chat scenario has objectives, hide in grading mode and results view */}
                            {simulation?.objectivesEnabled &&
                              (() => {
                                const currentScenario = displayChat?.id
                                  ? scenariosByChatId[displayChat.id]
                                  : null;
                                const hasObjectives =
                                  currentScenario?.objectives &&
                                  currentScenario.objectives.length > 0;
                                return hasObjectives;
                              })() &&
                              !showGrades &&
                              !showResults && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant={
                                            showObjectives
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={(e) => {
                                            // Mobile: open modal, Desktop: use collapsible
                                            if (isMobile) {
                                              e.preventDefault();
                                              setShowObjectivesModal(true);
                                            }
                                          }}
                                          className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                        >
                                          <ListChecks className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {showObjectives
                                          ? "Hide Objectives"
                                          : "Show Objectives"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                      displayChat &&
                                      allDynamicRubrics.find(
                                        (rubric) =>
                                          rubric.chatId === displayChat.id
                                      )
                                        ? allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : displayChat && !displayChat.completed
                                          ? "bg-red-100 dark:bg-red-900/30"
                                          : aggregatedResults
                                            ? aggregatedResults.passed
                                              ? "bg-green-100 dark:bg-green-900/30"
                                              : "bg-red-100 dark:bg-red-900/30"
                                            : "bg-muted"
                                    }`}
                                  >
                                    {isInfiniteMode ? (
                                      <InfinityIcon className="h-4 w-4" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        displayChat && displayChat.completed
                                          ? calculateTimeExceeded(displayChat) >
                                              0 && simulation?.timeLimit
                                            ? "text-red-500"
                                            : ""
                                          : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {displayChat && displayChat.completed
                                        ? formatTime(
                                            calculateChatTimeTaken(displayChat)
                                          )
                                        : isInfiniteMode
                                          ? infiniteLimitMinutes
                                            ? formatTime(
                                                infiniteLimitMinutes * 60
                                              )
                                            : formatTime(timer.elapsed || 0)
                                          : simulation?.timeLimit && displayChat
                                            ? formatTime(
                                                calculateAdjustedTimeLimit(
                                                  displayChat
                                                )
                                              )
                                            : "No time limit"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                {displayChat &&
                                showGrades &&
                                allDynamicRubrics.find(
                                  (rubric) => rubric.chatId === displayChat.id
                                ) ? (
                                  <TooltipContent>
                                    <p className="flex items-center flex-wrap gap-x-0">
                                      <span>
                                        {allDynamicRubrics.find(
                                          (rubric) =>
                                            rubric.chatId === displayChat.id
                                        )?.passed
                                          ? "Passed"
                                          : "Failed"}
                                        (
                                        {
                                          allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.score
                                        }
                                        /
                                        {
                                          allDynamicRubrics.find(
                                            (rubric) =>
                                              rubric.chatId === displayChat.id
                                          )?.totalPossiblePoints
                                        }
                                        )
                                      </span>
                                      {calculateTimeExceeded(displayChat) > 0 &&
                                        simulation?.timeLimit && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            +
                                            {formatTime(
                                              calculateTimeExceeded(displayChat)
                                            )}
                                          </span>
                                        )}
                                    </p>
                                  </TooltipContent>
                                ) : displayChat && !displayChat.completed ? (
                                  <TooltipContent>
                                    <p>Incomplete</p>
                                  </TooltipContent>
                                ) : aggregatedResults ? (
                                  <TooltipContent>
                                    <p>
                                      {((
                                        aggregatedResults as {
                                          overallPassed?: boolean;
                                          passed?: boolean;
                                        }
                                      )?.overallPassed ??
                                      (
                                        aggregatedResults as {
                                          overallPassed?: boolean;
                                          passed?: boolean;
                                        }
                                      )?.passed)
                                        ? "Passed"
                                        : "Failed"}{" "}
                                      (
                                      {Math.round(
                                        (
                                          aggregatedResults as {
                                            averageScore?: number;
                                            percentage?: number;
                                          }
                                        )?.averageScore ??
                                          (
                                            aggregatedResults as {
                                              averageScore?: number;
                                              percentage?: number;
                                            }
                                          )?.percentage ??
                                          0
                                      )}
                                      /
                                      {allDynamicRubrics?.[0]
                                        ?.totalPossiblePoints || 100}{" "}
                                      points)
                                    </p>
                                  </TooltipContent>
                                ) : null}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                        {/* Chat picker row - show when multi-chat attempt */}
                        {!isSingleChatAttempt && chatPicker && (
                          <div className="flex justify-end">{chatPicker}</div>
                        )}
                      </div>
                    </div>

                    {/* Objectives Collapsible Content - Desktop Only, hide in grading mode */}
                    {simulation?.objectivesEnabled &&
                      (() => {
                        const currentScenario = displayChat?.id
                          ? scenariosByChatId[displayChat.id]
                          : null;
                        const objectives = currentScenario?.objectives || [];
                        return objectives.length > 0;
                      })() &&
                      !showGrades && (
                        <CollapsibleContent className="pt-2 hidden md:block">
                          <div className="px-4 pb-2">
                            <ul className="space-y-2 list-none">
                              {(() => {
                                const currentScenario = displayChat?.id
                                  ? scenariosByChatId[displayChat.id]
                                  : null;
                                const objectives =
                                  currentScenario?.objectives || [];
                                return objectives.map((objective, index) => (
                                  <li
                                    key={index}
                                    className="font-normal flex items-start gap-2"
                                  >
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                    <span className="flex-1 -mt-0.5">
                                      {objective}
                                    </span>
                                  </li>
                                ));
                              })()}
                            </ul>
                          </div>
                        </CollapsibleContent>
                      )}
                  </div>
                </Collapsible>

                <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                  <ScrollArea className="flex-1 px-4 min-h-0">
                    <div className="space-y-4 py-4">
                      {/* Show rubric when toggle is on */}
                      {showGrades && displayChat && rubricStructure ? (
                        <div className="space-y-4 py-4">
                          <TableRubric
                            standardGroups={
                              rubricStructure?.standardGroups || []
                            }
                            standardGroupsMapping={
                              rubricStructure?.standardGroupsMapping || {}
                            }
                            standardsMapping={
                              (rubricStructure?.standardsMapping ||
                                {}) as Parameters<
                                typeof TableRubric
                              >[0]["standardsMapping"]
                            }
                            {...(displayChat?.id &&
                              gradingStatesByChatId[displayChat.id] && {
                                gradingState: gradingStatesByChatId[
                                  displayChat.id
                                ] as NonNullable<
                                  Parameters<
                                    typeof TableRubric
                                  >[0]["gradingState"]
                                >,
                              })}
                          />
                        </div>
                      ) : displayChat ? (
                        /* Show chat messages for both single and multi-chat attempts */
                        <div className="space-y-4">
                          <AttemptMessages
                            chatId={displayChat.id}
                            isAttemptOwner={isAttemptOwner}
                            messages={currentMessages}
                            currentChat={currentChat}
                            sendMessage={sendMessage}
                            isSendingMessage={isSendingMessage}
                            isActive={!timer.expired && !showResults}
                            simulation={simulation}
                          />
                        </div>
                      ) : (
                        /* Fallback content when no chat is selected */
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">
                            Select a chat to view its conversation and results.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </div>
            </Card>
          </ResizablePanel>

          {/* Right Panel - Documents */}
          {showDocuments &&
            (() => {
              // Filter documents for current chat's scenario
              const currentChatDocIds = displayChat?.documentIds || [];
              const filteredDocs =
                scenarioDocuments.filter((doc) =>
                  currentChatDocIds.includes(doc.document_id)
                ) || [];

              return (
                filteredDocs.length > 0 && (
                  <>
                    <ResizableHandle className="bg-transparent hidden md:block" />
                    <ResizablePanel
                      defaultSize={30}
                      minSize={20}
                      maxSize={50}
                      className="hidden md:block"
                    >
                      <Card className="h-full flex flex-col ml-4 p-0">
                        <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                          {/* Select dropdown directly above document */}
                          {filteredDocs.length > 1 && (
                            <div className="p-3 pb-2 border-b">
                              <DocumentSelect
                                documents={filteredDocs}
                                selectedDocumentId={selectedDocumentId}
                                onDocumentSelect={setSelectedDocumentId}
                              />
                            </div>
                          )}
                          {/* Document viewer with minimal padding */}
                          <div className="flex-1 min-h-0 p-2">
                            {selectedDocumentId &&
                              (() => {
                                const document =
                                  filteredDocs.find(
                                    (doc) =>
                                      doc.document_id === selectedDocumentId
                                  ) || filteredDocs[0];
                                return document ? (
                                  <DocumentViewer
                                    key={selectedDocumentId}
                                    document={document}
                                  />
                                ) : null;
                              })()}
                          </div>
                        </CardContent>
                      </Card>
                    </ResizablePanel>
                  </>
                )
              );
            })()}
        </ResizablePanelGroup>

        {/* Document Modal - Mobile Only */}
        <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
          <DialogContent
            className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>
                {(() => {
                  const currentChatDocIds = displayChat?.documentIds || [];
                  const filteredDocs =
                    scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id)
                    ) || [];
                  return (
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId
                    )?.name ||
                    filteredDocs[0]?.name ||
                    "Document"
                  );
                })()}
              </DialogTitle>
              <DialogDescription>View scenario document</DialogDescription>
            </DialogHeader>

            {/* Document selector (if multiple documents) */}
            {(() => {
              const currentChatDocIds = displayChat?.documentIds || [];
              const filteredDocs =
                scenarioDocuments.filter((doc) =>
                  currentChatDocIds.includes(doc.document_id)
                ) || [];
              return filteredDocs.length > 1 ? (
                <div className="pb-3">
                  <DocumentSelect
                    documents={filteredDocs}
                    selectedDocumentId={selectedDocumentId}
                    onDocumentSelect={setSelectedDocumentId}
                  />
                </div>
              ) : null;
            })()}

            {/* Document viewer */}
            {selectedDocumentId && (
              <div className="flex-1 overflow-auto">
                {(() => {
                  const currentChatDocIds = displayChat?.documentIds || [];
                  const filteredDocs =
                    scenarioDocuments.filter((doc) =>
                      currentChatDocIds.includes(doc.document_id)
                    ) || [];
                  const document =
                    filteredDocs.find(
                      (doc) => doc.document_id === selectedDocumentId
                    ) || filteredDocs[0];
                  return document ? (
                    <DocumentViewer document={document} bare={true} />
                  ) : null;
                })()}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDocumentModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Objectives Modal - Mobile Only */}
        <Dialog
          open={showObjectivesModal}
          onOpenChange={setShowObjectivesModal}
        >
          <DialogContent
            className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader>
              <DialogTitle>Learning Objectives</DialogTitle>
              <DialogDescription>
                View the learning objectives for this scenario
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto py-4">
              {(() => {
                const currentScenario = displayChat?.id
                  ? scenariosByChatId[displayChat.id]
                  : null;
                const objectives = currentScenario?.objectives || [];

                if (objectives.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground italic">
                      No objectives defined for this scenario.
                    </p>
                  );
                }

                return (
                  <ul className="space-y-2 list-none">
                    {objectives.map((objective, index) => (
                      <li
                        key={index}
                        className="font-normal flex items-start gap-2"
                      >
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <span className="flex-1 -mt-0.5">{objective}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowObjectivesModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div
      className="h-[calc(100vh-4rem)]"
      data-testid="attempt-chat-container"
      data-attempt-id={attemptId || ""}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Main Chat Area */}
        <ResizablePanel
          defaultSize={showDocuments && scenarioDocuments.length > 0 ? 70 : 100}
          className="md:flex-none"
        >
          <Card className="h-full flex flex-col py-4">
            <TooltipProvider>
              <ResizablePanelGroup
                ref={inputPanelGroupRef}
                direction="vertical"
                className="h-full"
              >
                <ResizablePanel defaultSize={88} minSize={70}>
                  <div className="h-full flex flex-col">
                    {/* Timer and Controls Header */}
                    <Collapsible
                      open={showObjectives}
                      onOpenChange={setShowObjectives}
                      className="border-b"
                    >
                      <div className="p-4 pt-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex items-start gap-2">
                              <span className="font-medium">
                                {scenario?.problemStatement ||
                                  scenario?.name ||
                                  currentChat?.title}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start justify-end gap-2">
                            <div className="flex items-center gap-4">
                              {/* Hide completed badge logic in infinite mode */}
                              {!attempt?.infiniteMode &&
                                currentChat?.completed &&
                                expectedChatCount ===
                                  chats.filter((chat: Chat) => chat.completed)
                                    .length && (
                                  <Badge variant="default">Completed</Badge>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                              {(() => {
                                const currentChatDocIds =
                                  displayChat?.documentIds || [];
                                const hasDocumentsForCurrentChat =
                                  scenarioDocuments?.some((doc) =>
                                    currentChatDocIds.includes(doc.document_id)
                                  );
                                return hasDocumentsForCurrentChat;
                              })() && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant={
                                        showDocuments ? "default" : "outline"
                                      }
                                      size="sm"
                                      onClick={() => {
                                        // Mobile: open modal, Desktop: toggle panel
                                        if (window.innerWidth < 768) {
                                          setShowDocumentModal(true);
                                        } else {
                                          setShowDocuments(!showDocuments);
                                        }
                                      }}
                                      className={`p-2 ${showDocuments ? "bg-primary text-primary-foreground" : ""}`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {showDocuments
                                        ? "Hide Documents"
                                        : "Show Documents"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Objectives Toggle - only show if simulation has objectives enabled and current chat scenario has objectives */}
                              {simulation?.objectivesEnabled &&
                                (() => {
                                  const currentScenario = displayChat?.id
                                    ? scenariosByChatId[displayChat.id]
                                    : null;
                                  const hasObjectives =
                                    currentScenario?.objectives &&
                                    currentScenario.objectives.length > 0;
                                  return hasObjectives;
                                })() && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant={
                                            showObjectives
                                              ? "default"
                                              : "outline"
                                          }
                                          size="sm"
                                          onClick={(e) => {
                                            // Mobile: open modal, Desktop: use collapsible
                                            if (window.innerWidth < 768) {
                                              e.preventDefault();
                                              setShowObjectivesModal(true);
                                            }
                                          }}
                                          className={`p-2 ${showObjectives ? "bg-primary text-primary-foreground" : ""}`}
                                        >
                                          <ListChecks className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {showObjectives
                                          ? "Hide Objectives"
                                          : "Show Objectives"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                                      !attempt?.infiniteMode &&
                                      currentChat?.completed &&
                                      currentDynamicRubric &&
                                      expectedChatCount ===
                                        chats.filter(
                                          (chat: Chat) => chat.completed
                                        ).length
                                        ? currentDynamicRubric?.passed
                                          ? "bg-green-100 dark:bg-green-900/30"
                                          : "bg-red-100 dark:bg-red-900/30"
                                        : "bg-muted"
                                    }`}
                                  >
                                    {attempt?.infiniteMode ? (
                                      <InfinityIcon className="h-4 w-4" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span
                                      className={`text-sm font-medium ${
                                        attempt?.infiniteMode
                                          ? ""
                                          : simulation?.timeLimit &&
                                              timer.remaining !== null &&
                                              timer.remaining < 0
                                            ? "text-red-500"
                                            : ""
                                      }`}
                                      data-testid="timer"
                                    >
                                      {attempt?.infiniteMode
                                        ? simulation?.timeLimit
                                          ? formatTime(
                                              Math.max(timer.remaining || 0, 0)
                                            )
                                          : formatTime(timer.elapsed)
                                        : simulation?.timeLimit &&
                                            timer.remaining !== null
                                          ? formatTime(timer.remaining)
                                          : formatTime(timer.elapsed)}
                                    </span>
                                    {/* In infinite mode, we don't show negative state; we auto-finish on expiry */}
                                  </div>
                                </TooltipTrigger>
                                {!attempt?.infiniteMode &&
                                  currentChat?.completed &&
                                  currentDynamicRubric &&
                                  expectedChatCount ===
                                    chats.filter((chat: Chat) => chat.completed)
                                      .length && (
                                    <TooltipContent>
                                      <p>
                                        {currentDynamicRubric.passed
                                          ? "Passed"
                                          : "Failed"}
                                        ({currentDynamicRubric?.score}/
                                        {
                                          currentDynamicRubric?.totalPossiblePoints
                                        }
                                        )
                                      </p>
                                    </TooltipContent>
                                  )}
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Objectives Collapsible Content - hide in grading mode */}
                      {simulation?.objectivesEnabled &&
                        (() => {
                          const currentScenario = displayChat?.id
                            ? scenariosByChatId[displayChat.id]
                            : null;
                          const objectives = currentScenario?.objectives || [];
                          return objectives.length > 0;
                        })() &&
                        !showGrades && (
                          <CollapsibleContent className="pt-2">
                            <div className="px-4 pb-2">
                              <ul className="space-y-2 list-none">
                                {(() => {
                                  const currentScenario = displayChat?.id
                                    ? scenariosByChatId[displayChat.id]
                                    : null;
                                  const objectives =
                                    currentScenario?.objectives || [];
                                  return objectives.map((objective, index) => (
                                    <li
                                      key={index}
                                      className="font-normal flex items-start gap-2"
                                    >
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                      <span className="flex-1 -mt-0.5">
                                        {objective}
                                      </span>
                                    </li>
                                  ));
                                })()}
                              </ul>
                            </div>
                          </CollapsibleContent>
                        )}
                    </Collapsible>

                    {/* Messages Area */}
                    {/* Progress Bar at the very top */}
                    {/* Hide progress bar in infinite mode */}
                    {!attempt?.infiniteMode && expectedChatCount > 1 && (
                      <div className="p-0">
                        <Progress
                          value={(() => {
                            // Count unique scenarios with at least one graded chat
                            // A scenario is considered complete only if it has at least one chat with a grade
                            const scenariosWithGrades = new Set<string>();
                            attemptData?.chats?.forEach((chatData) => {
                              if (
                                chatData.chat.completed &&
                                chatData.scenario?.id
                              ) {
                                scenariosWithGrades.add(chatData.scenario.id);
                              }
                            });
                            return (
                              (scenariosWithGrades.size / expectedChatCount) *
                              100
                            );
                          })()}
                          className="w-full bg-transparent rounded-none [&>div]:rounded-none [&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-purple-500"
                        />
                      </div>
                    )}
                    <AttemptMessages
                      isAttemptOwner={isAttemptOwner}
                      messages={currentMessages}
                      currentChat={currentChat}
                      sendMessage={sendMessage}
                      isSendingMessage={isSendingMessage}
                      isActive={!timer.expired && !showResults}
                      simulation={simulation}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle disabled />
                {/* Input Area */}
                <div
                  style={{
                    height: `${inputPanelHeight}px`,
                    minHeight: "70px",
                    maxHeight: "160px",
                  }}
                >
                  <AttemptInput
                    isAttemptOwner={isAttemptOwner}
                    onHeightChange={setInputPanelHeight}
                    currentMessages={currentMessages}
                    currentChatHints={currentChatHints}
                    currentChat={currentChat}
                    sendMessage={sendMessage}
                    stopMessage={stopMessage}
                    isSendingMessage={isSendingMessage}
                    isStoppingMessage={isStoppingMessage}
                    isConnected={isConnected}
                    simulation={simulation}
                    scenario={scenario}
                    readOnly={false}
                  />
                </div>
              </ResizablePanelGroup>
            </TooltipProvider>
          </Card>
        </ResizablePanel>

        {/* Right Panel - Documents */}
        {showDocuments &&
          (() => {
            // Filter documents for current chat's scenario
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];

            return (
              filteredDocs.length > 0 && (
                <>
                  <ResizableHandle className="bg-transparent hidden md:block" />
                  <ResizablePanel
                    defaultSize={30}
                    minSize={20}
                    maxSize={50}
                    className="hidden md:block"
                  >
                    <Card className="h-full flex flex-col ml-4 p-0">
                      <CardContent className="flex-1 p-0 min-h-0 flex flex-col">
                        {/* Select dropdown directly above document */}
                        {filteredDocs.length > 1 && (
                          <div className="p-3 pb-2 border-b">
                            <DocumentSelect
                              documents={filteredDocs}
                              selectedDocumentId={selectedDocumentId}
                              onDocumentSelect={setSelectedDocumentId}
                            />
                          </div>
                        )}
                        {/* Document viewer with minimal padding */}
                        <div className="flex-1 min-h-0 p-2">
                          {selectedDocumentId &&
                            (() => {
                              const document =
                                filteredDocs.find(
                                  (doc) =>
                                    doc.document_id === selectedDocumentId
                                ) || filteredDocs[0];
                              return document ? (
                                <DocumentViewer
                                  key={selectedDocumentId}
                                  document={document}
                                />
                              ) : null;
                            })()}
                        </div>
                      </CardContent>
                    </Card>
                  </ResizablePanel>
                </>
              )
            );
          })()}
      </ResizablePanelGroup>

      {/* Document Modal - Mobile Only */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent
          className="sm:max-w-4xl max-h-[80vh] md:overflow-hidden overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <DialogHeader>
            <DialogTitle>
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                return (
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  )?.name ||
                  filteredDocs[0]?.name ||
                  "Document"
                );
              })()}
            </DialogTitle>
            <DialogDescription>View scenario document</DialogDescription>
          </DialogHeader>

          {/* Document selector (if multiple documents) */}
          {(() => {
            const currentChatDocIds = displayChat?.documentIds || [];
            const filteredDocs =
              scenarioDocuments.filter((doc) =>
                currentChatDocIds.includes(doc.document_id)
              ) || [];
            return filteredDocs.length > 1 ? (
              <div className="pb-3">
                <DocumentSelect
                  documents={filteredDocs}
                  selectedDocumentId={selectedDocumentId}
                  onDocumentSelect={setSelectedDocumentId}
                />
              </div>
            ) : null;
          })()}

          {/* Document viewer */}
          {selectedDocumentId && (
            <div className="flex-1 overflow-auto">
              {(() => {
                const currentChatDocIds = displayChat?.documentIds || [];
                const filteredDocs =
                  scenarioDocuments.filter((doc) =>
                    currentChatDocIds.includes(doc.document_id)
                  ) || [];
                const document =
                  filteredDocs.find(
                    (doc) => doc.document_id === selectedDocumentId
                  ) || filteredDocs[0];
                return document ? (
                  <DocumentViewer document={document} bare={true} />
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDocumentModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Objectives Modal - Mobile Only */}
      <Dialog open={showObjectivesModal} onOpenChange={setShowObjectivesModal}>
        <DialogContent
          className="sm:max-w-2xl max-h-[80vh] overflow-auto flex flex-col"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <DialogHeader>
            <DialogTitle>Learning Objectives</DialogTitle>
            <DialogDescription>
              View the learning objectives for this scenario
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            {(() => {
              const currentScenario = displayChat?.id
                ? scenariosByChatId[displayChat.id]
                : null;
              const objectives = currentScenario?.objectives || [];

              if (objectives.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground italic">
                    No objectives defined for this scenario.
                  </p>
                );
              }

              return (
                <ul className="space-y-2 list-none">
                  {objectives.map((objective, index) => (
                    <li
                      key={index}
                      className="font-medium flex items-start gap-2"
                    >
                      <span className="text-primary mt-1.5 flex-shrink-0">
                        •
                      </span>
                      <span className="flex-1">{objective}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowObjectivesModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
