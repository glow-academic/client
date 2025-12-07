/**
 * EvalResultView.tsx
 * View for displaying eval run results using GradedAttemptView
 * @AshokSaravanan222 & @siladiea
 * 01/30/2025
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import GradedAttemptView from "@/components/common/chat/attempt/GradedAttemptView";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define types manually since /runs/full endpoint may not be in OpenAPI schema yet
// These match the structure from server/app/api/v3/runs/full.py
type RunFullResponse = {
  run: {
    id: string;
    createdAt: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    keyId: string | null;
    agentId: string | null;
  };
  simulation: null;
  attemptProfiles: never[];
  chats: Array<{
    chat: {
      id: string;
      createdAt: string;
      updatedAt: string;
      title: string;
      scenarioId: string;
      parentScenarioId: string;
      attemptId: string | null;
      completed: boolean;
      completedAt: string | null;
      traceId: string | null;
      documentIds: string[];
    };
    scenario: {
      id: string;
      name: string;
      problemStatement: string;
      departmentId: string | null;
      active: boolean;
      personaId: string | null;
      personaName: string | null;
      personaIcon: string | null;
      personaColor: string | null;
      createdAt: string;
      updatedAt: string;
      generated: boolean;
      defaultScenario: boolean;
      copyPasteAllowed: boolean;
      objectives: string[] | null;
    } | null;
    messages: Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
      chatId: string;
      content: string;
      type: string;
      completed: boolean;
    }>;
    hints: Array<{
      messageId: string;
      hints: Array<{
        simulationMessageId: string;
        hint: string;
        idx: number;
        createdAt: string;
      }>;
    }>;
    grade: {
      id: string;
      createdAt: string;
      simulationChatId: string;
      rubricId: string;
      description: string;
      passed: boolean;
      score: number;
      timeTaken: number;
    } | null;
    feedbacks: Array<{
      id: string;
      createdAt: string;
      standardId: string;
      simulationChatGradeId: string;
      total: number;
      feedback: string;
    }>;
    dynamicRubric: {
      chatId: string;
      score: number;
      passed: boolean;
      timeTaken: number;
      skillScores: Record<string, number>;
      skillFeedbacks: Record<string, string>;
      totalPossiblePoints: number;
    } | null;
    gradingState: {
      achievedStandards: Record<string, boolean>;
      passedStandards: Record<string, boolean>;
      feedbackByStandardId: Record<string, string>;
      gradeDescription: string;
    } | null;
    previousChats: never[];
  }>;
  scenarioDocuments: Array<{
    document_id: string;
    name: string;
    type: string;
    updatedAt: string;
    extension: string;
    scenario_ids: string[];
    can_edit: boolean;
    can_delete: boolean;
    active: boolean;
    department_ids: string[] | null;
    file_path: string;
    mime_type: string;
    parameter_item_ids: string[];
  }>;
  aggregatedResults: {
    totalScore: number;
    totalPossiblePoints: number;
    percentage: number;
    passed: boolean;
    chatsCompleted: number;
    totalChats: number;
  } | null;
  timer: {
    elapsed: number;
    limit: number | null;
    exceeded: boolean;
    formatted: string;
  };
  currentChatIndex: number;
  expectedChatCount: number;
  isSingleChatAttempt: boolean;
  isLastAttempt: boolean;
  showResults: boolean;
  shouldShowControls: boolean;
  remainingScenariosCount: number;
  isLastRemainingScenario: boolean;
  canPickMultipleAlternatives: boolean;
  isActive: boolean;
  rubricStructure: {
    standardGroups: Record<string, string[]>;
    standardGroupsMapping: Record<
      string,
      {
        name: string;
        description: string;
        points: number;
        passPoints: number;
      }
    >;
    standardsMapping: Record<string, Record<string, unknown>>;
  } | null;
  allSimulationScenarios: never[];
};

interface EvalResultViewProps {
  runId: string;
  profileId?: string | null;
}

export default function EvalResultView({
  runId,
  profileId,
}: EvalResultViewProps) {
  const [runData, setRunData] = useState<RunFullResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Infer types from the API response
  type ChatDataType = RunFullResponse["chats"][number];
  type Chat = ChatDataType["chat"];

  // Fetch run data
  useEffect(() => {
    const fetchRunData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Use fetch directly since the endpoint may not be in OpenAPI schema yet
        const response = await fetch("/api/v3/runs/full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId, profileId: profileId || null }),
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch run data: ${response.statusText}`);
        }
        const data = (await response.json()) as RunFullResponse;
        setRunData(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load run data",
        );
      } finally {
        setLoading(false);
      }
    };

    if (runId) {
      fetchRunData();
    }
  }, [runId, profileId]);

  // Extract data from response
  const chats = useMemo(
    () => runData?.chats.map((c) => c.chat) || [],
    [runData],
  );

  // Current chat based on index (default to first chat)
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const currentChat = useMemo(() => {
    if (!runData?.chats || runData.chats.length === 0) return null;
    const chatData = runData.chats[currentChatIndex];
    return chatData?.chat || runData.chats[0]?.chat || null;
  }, [runData, currentChatIndex]);

  // Get scenario, documents from data
  const scenario = useMemo(() => {
    if (!runData?.chats || !currentChat) return null;
    const chatData = runData.chats.find((c) => c.chat.id === currentChat.id);
    return chatData?.scenario ?? null;
  }, [runData, currentChat]);

  // Evals don't have documents, so always use empty array
  const scenarioDocuments = useMemo(() => [], []);

  // Scenarios map - map chatId -> scenario for all chats
  const scenariosByChatId = useMemo(() => {
    if (!runData?.chats) return {};
    const map: Record<string, ChatDataType["scenario"]> = {};
    runData.chats.forEach((chatData) => {
      map[chatData.chat.id] = chatData.scenario;
    });
    return map;
  }, [runData]);

  // Rubric structure
  const rubricStructure = runData?.rubricStructure ?? null;

  // Grading states map - map chatId -> grading state
  const gradingStatesByChatId = useMemo(() => {
    const map: Record<string, NonNullable<ChatDataType["gradingState"]>> = {};

    if (runData?.chats) {
      runData.chats.forEach((chatData) => {
        if (chatData.gradingState) {
          map[chatData.chat.id] = chatData.gradingState;
        }
      });
    }

    return map;
  }, [runData]);

  // Messages - get messages for current chat
  const currentMessages = useMemo(() => {
    if (!runData?.chats || !currentChat) return [];
    const chatData = runData.chats.find((c) => c.chat.id === currentChat.id);
    return chatData?.messages ?? [];
  }, [runData, currentChat]);

  // Hints - get hints for current chat
  const currentChatHints = useMemo(() => {
    if (!runData?.chats || !currentChat) return [];
    const chatData = runData.chats.find((c) => c.chat.id === currentChat.id);
    return chatData?.hints || [];
  }, [runData, currentChat]);

  // Get computed data from response
  const allDynamicRubrics = useMemo(
    () =>
      runData?.chats
        .map((c) => c.dynamicRubric)
        .filter(
          (r): r is NonNullable<ChatDataType["dynamicRubric"]> => r !== null,
        ) || [],
    [runData],
  );

  const aggregatedResults = runData?.aggregatedResults || null;

  // Metadata from response
  const expectedChatCount = runData?.expectedChatCount || 1;
  const isSingleChatAttempt = runData?.isSingleChatAttempt ?? true;

  // Timer from response
  const timer = useMemo(() => {
    const backendTimer = runData?.timer;
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
  }, [runData?.timer]);

  // UI state (no documents for evals)
  const [showGrades, setShowGrades] = useState(false);
  const [userHasManuallyToggledGrades, setUserHasManuallyToggledGrades] =
    useState(false);
  const [showObjectives, setShowObjectives] = useState(false);
  const [showObjectivesModal, setShowObjectivesModal] = useState(false);

  // Get current chat
  const displayChat = chats[currentChatIndex];

  // Chat picker component
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
            const rubricResult = allDynamicRubrics.find(
              (rubric) => rubric.chatId === chat.id,
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
  const calculateChatTimeTaken = useCallback(
    (
      chat: {
        completed?: boolean;
        completedAt?: string | null;
        createdAt?: string;
      } | null,
    ): number => {
      if (!chat?.completed || !chat.completedAt || !chat.createdAt) return 0;

      const startTime = new Date(chat.createdAt).getTime();
      const endTime = new Date(chat.completedAt).getTime();
      const timeTakenSeconds = Math.floor((endTime - startTime) / 1000);

      return timeTakenSeconds;
    },
    [],
  );

  // Helper function to calculate adjusted time limit (not applicable for runs)
  const calculateAdjustedTimeLimit = useCallback(
    (
      _chat: {
        completed?: boolean;
        completedAt?: string | null;
        createdAt?: string;
      } | null,
    ): number => {
      return 0; // Runs don't have time limits
    },
    [],
  );

  // Helper function to calculate how much time was exceeded (not applicable for runs)
  const calculateTimeExceeded = useCallback(
    (
      _chat: {
        completed?: boolean;
        completedAt?: string | null;
        createdAt?: string;
      } | null,
    ): number => {
      return 0; // Runs don't have time limits
    },
    [],
  );

  // Auto-select first chat when data loads
  useEffect(() => {
    if (runData && chats && chats.length > 0 && currentChatIndex === 0) {
      setCurrentChatIndex(0);
    }
  }, [runData, chats, currentChatIndex]);

  // Auto-show rubric if all chats completed
  useEffect(() => {
    if (chats && chats.length > 0) {
      const completedChats = chats.filter((chat: Chat) => chat.completed);
      if (
        completedChats.length === chats.length &&
        !userHasManuallyToggledGrades
      ) {
        setShowGrades(true);
      }
    }
  }, [chats, userHasManuallyToggledGrades]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading run data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground">No chats found for this run.</p>
        </div>
      </div>
    );
  }

  return (
    <GradedAttemptView
      attemptId={runId} // Use runId as attemptId for compatibility
      attempt={null} // Runs don't have attempts
      simulation={null} // Runs don't have simulations
      scenario={scenario}
      currentChat={
        currentChat
          ? { ...currentChat, attemptId: currentChat.attemptId || "" }
          : null
      }
      displayChat={
        displayChat
          ? { ...displayChat, attemptId: displayChat.attemptId || "" }
          : null
      }
      chats={chats.map((chat) => ({
        ...chat,
        attemptId: chat.attemptId || "",
      }))}
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
      showDocuments={false}
      showDocumentModal={false}
      showObjectives={showObjectives}
      showObjectivesModal={showObjectivesModal}
      showGrades={showGrades}
      selectedDocumentId={null}
      currentMessages={currentMessages}
      currentChatHints={currentChatHints}
      isAttemptOwner={true} // Always true for eval results (read-only)
      chatPicker={chatPicker}
      selectedScenario={selectedScenario}
      calculateChatTimeTaken={calculateChatTimeTaken}
      calculateAdjustedTimeLimit={calculateAdjustedTimeLimit}
      calculateTimeExceeded={calculateTimeExceeded}
      setCurrentChatIndex={setCurrentChatIndex}
      setShowGrades={setShowGrades}
      setUserHasManuallyToggledGrades={setUserHasManuallyToggledGrades}
      setShowDocuments={() => {}} // No-op since no documents
      setShowDocumentModal={() => {}} // No-op since no documents
      setShowObjectives={setShowObjectives}
      setShowObjectivesModal={setShowObjectivesModal}
      setSelectedDocumentId={() => {}} // No-op since no documents
      hideDocuments={true} // Always hide documents for evals
    />
  );
}
