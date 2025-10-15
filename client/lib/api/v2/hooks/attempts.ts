/**
 * V2 API hooks for attempts
 * Server-side computed data for simulation attempts
 */

import { api } from "@/lib/api/fetcher";
import { useQuery } from "@tanstack/react-query";

export interface AttemptFullResponse {
  attempt: {
    id: string;
    createdAt: string;
    simulationId: string;
    infiniteMode: boolean;
    infiniteModeTimeLimit: number | null;
    archived: boolean;
  };
  simulation: {
    id: string;
    title: string;
    description: string;
    departmentId: string;
    active: boolean;
    defaultSimulation: boolean;
    practiceSimulation: boolean;
    hintsEnabled: boolean;
    inputGuardrailActive: boolean;
    outputGuardrailActive: boolean;
    imageInputActive: boolean;
    timeLimit: number | null;
    rubricId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  attemptProfiles: Array<{
    profileId: string;
    attemptId: string;
    active: boolean;
  }>;
  chats: Array<{
    chat: {
      id: string;
      createdAt: string;
      updatedAt: string;
      title: string;
      scenarioId: string;
      attemptId: string;
      completed: boolean;
      completedAt: string | null;
      traceId: string | null; // Add missing field
    };
    scenario: {
      id: string;
      name: string;
      problemStatement: string;
      departmentId: string;
      active: boolean;
      personaId: string | null;
      createdAt: string;
      updatedAt: string;
      generated: boolean; // Add missing field
      defaultScenario: boolean; // Add missing field
    } | null;
    messages: Array<{
      id: string;
      createdAt: string;
      updatedAt: string;
      chatId: string;
      content: string;
      type: "query" | "response";
      completed: boolean;
    }>;
    hints: Array<{
      messageId: string;
      hints: Array<{
        id: string;
        simulationMessageId: string;
        hint: string;
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
      feedback: string | null;
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
  }>;
  scenarioDocuments: Array<{
    id: string;
    name: string; // Match expected Document type
    title: string;
    description: string;
    mimeType: string;
    departmentId: string;
    fileSize: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    filePath: string; // Add missing field
    type:
      | "homework"
      | "project"
      | "quiz"
      | "midterm"
      | "lab"
      | "lecture"
      | "syllabus"; // Add missing field
    classified: boolean; // Add missing field
    fileId: string | null; // Add missing field
  }>;
  departmentDocuments: Array<{
    id: string;
    name: string; // Match expected Document type
    title: string;
    description: string;
    mimeType: string;
    departmentId: string;
    fileSize: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    filePath: string; // Add missing field
    type:
      | "homework"
      | "project"
      | "quiz"
      | "midterm"
      | "lab"
      | "lecture"
      | "syllabus"; // Add missing field
    classified: boolean; // Add missing field
    fileId: string | null; // Add missing field
  }>;
  aggregatedResults: {
    totalChats: number;
    passedChats: number;
    averageScore: number;
    totalTime: number;
    overallPassed: boolean;
  } | null;
  timer: {
    elapsed: number;
    remaining: number | null;
    expired: boolean;
  };
  currentChatIndex: number;
  expectedChatCount: number;
  isSingleChatAttempt: boolean;
  isLastAttempt: boolean;
  showResults: boolean;
  isActive: boolean;
}

export function useAttemptFull(attemptId: string) {
  return useQuery<AttemptFullResponse>({
    queryKey: ["v2", "attempts", attemptId, "full"],
    queryFn: () =>
      api<AttemptFullResponse>(`/api/v2/attempts/${attemptId}/full`),
    enabled: Boolean(attemptId),
    staleTime: 1000, // 1 second - allow WebSocket updates to trigger refetch
    refetchOnWindowFocus: false, // Don't refetch on window focus since we have active polling
  });
}
