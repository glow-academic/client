/**
 * Attempts schemas for v2 API
 */

import { z } from "zod";
import { DocumentItemSchema } from "./documents";

export const BulkArchiveAttemptsRequestSchema = z.object({
  attemptIds: z.array(z.string()),
  archived: z.boolean(),
});

export const BulkArchiveAttemptsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  count: z.number(),
});

export type BulkArchiveAttemptsRequest = z.infer<
  typeof BulkArchiveAttemptsRequestSchema
>;
export type BulkArchiveAttemptsResponse = z.infer<
  typeof BulkArchiveAttemptsResponseSchema
>;

export const UpdateChatCreatedAtRequestSchema = z.object({
  chatId: z.string(),
  createdAt: z.string(),
});

export const UpdateChatCompletedAtRequestSchema = z.object({
  chatId: z.string(),
  completedAt: z.string(),
});

export const UpdateChatTimestampResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateChatCreatedAtRequest = z.infer<
  typeof UpdateChatCreatedAtRequestSchema
>;
export type UpdateChatCompletedAtRequest = z.infer<
  typeof UpdateChatCompletedAtRequestSchema
>;
export type UpdateChatTimestampResponse = z.infer<
  typeof UpdateChatTimestampResponseSchema
>;

export const AttemptFullResponseSchema = z.object({
  attempt: z.object({
    id: z.string(),
    createdAt: z.string(),
    simulationId: z.string(),
    infiniteMode: z.boolean(),
    archived: z.boolean(),
  }),
  simulation: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    departmentId: z.string(),
    active: z.boolean(),
    defaultSimulation: z.boolean(),
    practiceSimulation: z.boolean(),
    hintsEnabled: z.boolean(),
    objectivesEnabled: z.boolean(),
    inputGuardrailActive: z.boolean(),
    outputGuardrailActive: z.boolean(),
    imageInputActive: z.boolean(),
    copyPasteAllowed: z.boolean(),
    timeLimit: z.number().nullable(),
    rubricId: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  attemptProfiles: z.array(
    z.object({
      profileId: z.string(),
      attemptId: z.string(),
      active: z.boolean(),
    })
  ),
  chats: z.array(
    z.object({
      chat: z.object({
        id: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
        title: z.string(),
        scenarioId: z.string(),
        attemptId: z.string(),
        completed: z.boolean(),
        completedAt: z.string().nullable(),
        traceId: z.string().nullable(),
        documentIds: z.array(z.string()),
      }),
      scenario: z
        .object({
          id: z.string(),
          name: z.string(),
          problemStatement: z.string(),
          departmentId: z.string(),
          active: z.boolean(),
          personaId: z.string().nullable(),
          createdAt: z.string(),
          updatedAt: z.string(),
          generated: z.boolean(),
          defaultScenario: z.boolean(),
          copyPasteAllowed: z.boolean(),
          objectives: z.array(z.string()).optional(),
        })
        .nullable(),
      messages: z.array(
        z.object({
          id: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          chatId: z.string(),
          content: z.string(),
          type: z.enum(["query", "response"]),
          completed: z.boolean(),
        })
      ),
      hints: z.array(
        z.object({
          messageId: z.string(),
          hints: z.array(
            z.object({
              simulationMessageId: z.string(),
              hint: z.string(),
              idx: z.number(),
              createdAt: z.string(),
            })
          ),
        })
      ),
      grade: z
        .object({
          id: z.string(),
          createdAt: z.string(),
          simulationChatId: z.string(),
          rubricId: z.string(),
          description: z.string(),
          passed: z.boolean(),
          score: z.number(),
          timeTaken: z.number(),
        })
        .nullable(),
      feedbacks: z.array(
        z.object({
          id: z.string(),
          createdAt: z.string(),
          standardId: z.string(),
          simulationChatGradeId: z.string(),
          total: z.number(),
          feedback: z.string().nullable(),
        })
      ),
      dynamicRubric: z
        .object({
          chatId: z.string(),
          score: z.number(),
          passed: z.boolean(),
          timeTaken: z.number(),
          skillScores: z.record(z.string(), z.number()),
          skillFeedbacks: z.record(z.string(), z.string()),
          totalPossiblePoints: z.number(),
        })
        .nullable(),
      gradingState: z
        .object({
          achievedStandards: z.record(z.string(), z.boolean()),
          passedStandards: z.record(z.string(), z.boolean()),
          gradeDescription: z.string().optional(),
          feedbackByStandardId: z.record(z.string(), z.string()).optional(),
        })
        .nullable(),
      previousChats: z.array(
        z.object({
          chatId: z.string(),
          attemptId: z.string(),
          score: z.number().nullable(),
          passed: z.boolean().nullable(),
          createdAt: z.string(),
          title: z.string(),
          timeTaken: z.number().nullable(),
          totalPossiblePoints: z.number().nullable(),
          percentage: z.number().nullable(),
        })
      ),
    })
  ),
  scenarioDocuments: z.array(DocumentItemSchema),
  allSimulationScenarios: z.array(
    z.object({
      scenarioId: z.string(),
      position: z.number(),
      scenarioName: z.string().nullable(),
      previousChats: z.array(
        z.object({
          chatId: z.string(),
          attemptId: z.string(),
          score: z.number().nullable(),
          passed: z.boolean().nullable(),
          createdAt: z.string(),
          title: z.string(),
          timeTaken: z.number().nullable(),
          totalPossiblePoints: z.number().nullable(),
          percentage: z.number().nullable(),
        })
      ),
    })
  ),
  aggregatedResults: z
    .object({
      totalChats: z.number(),
      passedChats: z.number(),
      averageScore: z.number(),
      totalTime: z.number(),
      overallPassed: z.boolean(),
    })
    .nullable(),
  timer: z.object({
    elapsed: z.number(),
    remaining: z.number().nullable(),
    expired: z.boolean(),
  }),
  currentChatIndex: z.number(),
  expectedChatCount: z.number(),
  isSingleChatAttempt: z.boolean(),
  isLastAttempt: z.boolean(),
  showResults: z.boolean(),
  shouldShowControls: z.boolean(),
  isActive: z.boolean(),
  rubricStructure: z
    .object({
      standardGroups: z.record(z.string(), z.array(z.string())),
      standardGroupsMapping: z.record(
        z.string(),
        z.object({
          name: z.string(),
          description: z.string(),
          points: z.number(),
          passPoints: z.number(),
        })
      ),
      standardsMapping: z.record(
        z.string(),
        z.object({
          name: z.string(),
          description: z.string(),
          points: z.number(),
        })
      ),
    })
    .nullable(),
});

export type AttemptFullResponse = z.infer<typeof AttemptFullResponseSchema>;
