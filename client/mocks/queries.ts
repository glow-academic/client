// Centralized mock module for all query functions
// This file is imported once in test setup and contains all vi.mock() calls for queries

import { vi } from "vitest";

// Mock all query modules with vi.mock() calls
vi.mock("@/utils/queries/accounts/get-account-by-id", () => ({
  getAccountById: vi.fn(),
}));

vi.mock("@/utils/queries/accounts/get-accounts", () => ({
  getAccounts: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agent-by-id", () => ({
  getAgentById: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents", () => ({
  getAgents: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-by-profile-id", () => ({
  getAgentsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-by-scenario-id", () => ({
  getAgentsByScenarioId: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-by-simulation-id", () => ({
  getAgentsBySimulationId: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-by-user-id", () => ({
  getAgentsByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-with-profiles", () => ({
  getAgentsWithProfiles: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-agents-with-scenarios", () => ({
  getAgentsWithScenarios: vi.fn(),
}));

vi.mock("@/utils/queries/app_feedback/get-app-feedback", () => ({
  getAppFeedback: vi.fn(),
}));

vi.mock("@/utils/queries/app_feedback/get-app-feedback-by-id", () => ({
  getAppFeedbackById: vi.fn(),
}));

vi.mock("@/utils/queries/app_feedback/get-app-feedback-by-profile-id", () => ({
  getAppFeedbackByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/app_feedback/get-app-feedback-by-user-id", () => ({
  getAppFeedbackByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/app_logs/get-app-logs", () => ({
  getAppLogs: vi.fn(),
}));

vi.mock("@/utils/queries/app_logs/get-app-logs-by-profile-id", () => ({
  getAppLogsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/assistant_chats/get-assistant-chat-by-id", () => ({
  getAssistantChatById: vi.fn(),
}));

vi.mock("@/utils/queries/assistant_chats/get-assistant-chats", () => ({
  getAssistantChats: vi.fn(),
}));

vi.mock(
  "@/utils/queries/assistant_chats/get-assistant-chats-by-profile-id",
  () => ({
    getAssistantChatsByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_chats/get-assistant-chats-by-user-id",
  () => ({
    getAssistantChatsByUserId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_messages/get-assistant-message-by-id",
  () => ({
    getAssistantMessageById: vi.fn(),
  })
);

vi.mock("@/utils/queries/assistant_messages/get-assistant-messages", () => ({
  getAssistantMessages: vi.fn(),
}));

vi.mock(
  "@/utils/queries/assistant_messages/get-assistant-messages-by-assistant-chat-id",
  () => ({
    getAssistantMessagesByAssistantChatId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_messages/get-assistant-messages-by-profile-id",
  () => ({
    getAssistantMessagesByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_tool_calls/get-assistant-tool-call-by-id",
  () => ({
    getAssistantToolCallById: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_tool_calls/get-assistant-tool-calls",
  () => ({
    getAssistantToolCalls: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-assistant-message-id",
  () => ({
    getAssistantToolCallsByAssistantMessageId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-profile-id",
  () => ({
    getAssistantToolCallsByProfileId: vi.fn(),
  })
);

vi.mock("@/utils/queries/classes/get-class-by-id", () => ({
  getClassById: vi.fn(),
}));

vi.mock("@/utils/queries/classes/get-classes", () => ({
  getClasses: vi.fn(),
}));

vi.mock("@/utils/queries/cohorts/get-cohort-by-id", () => ({
  getCohortById: vi.fn(),
}));

vi.mock("@/utils/queries/cohorts/get-cohorts", () => ({
  getCohorts: vi.fn(),
}));

vi.mock("@/utils/queries/components/get-component-by-id", () => ({
  getComponentById: vi.fn(),
}));

vi.mock("@/utils/queries/components/get-components", () => ({
  getComponents: vi.fn(),
}));

vi.mock("@/utils/queries/dashboards/get-dashboard-by-id", () => ({
  getDashboardById: vi.fn(),
}));

vi.mock("@/utils/queries/dashboards/get-dashboards", () => ({
  getDashboards: vi.fn(),
}));

vi.mock("@/utils/queries/dashboards/get-dashboards-by-profile-id", () => ({
  getDashboardsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/dashboards/get-dashboards-by-user-id", () => ({
  getDashboardsByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/documents/get-document-by-id", () => ({
  getDocumentById: vi.fn(),
}));

vi.mock("@/utils/queries/documents/get-documents", () => ({
  getDocuments: vi.fn(),
}));

vi.mock("@/utils/queries/documents/get-documents-by-profile-id", () => ({
  getDocumentsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-event-by-id", () => ({
  getEventById: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-events", () => ({
  getEvents: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-events-by-profile-id", () => ({
  getEventsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/events/get-events-by-user-id", () => ({
  getEventsByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/models/get-model-by-id", () => ({
  getModelById: vi.fn(),
}));

vi.mock("@/utils/queries/models/get-models", () => ({
  getModels: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-profile-by-alias", () => ({
  getProfileByAlias: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-profile-by-id", () => ({
  getProfileById: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-profile-by-user-id", () => ({
  getProfileByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-profiles", () => ({
  getProfiles: vi.fn(),
}));

vi.mock("@/utils/queries/profiles/get-profiles-by-role", () => ({
  getProfilesByRole: vi.fn(),
}));

vi.mock("@/utils/queries/providers/get-provider-by-id", () => ({
  getProviderById: vi.fn(),
}));

vi.mock("@/utils/queries/providers/get-providers", () => ({
  getProviders: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-rubric-by-id", () => ({
  getRubricById: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-rubrics", () => ({
  getRubrics: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenario-by-id", () => ({
  getScenarioById: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenarios", () => ({
  getScenarios: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenarios-by-profile-id", () => ({
  getScenariosByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenarios-by-user-id", () => ({
  getScenariosByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenarios-with-profiles", () => ({
  getScenariosWithProfiles: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedule-by-id", () => ({
  getScheduleById: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedules", () => ({
  getSchedules: vi.fn(),
}));

vi.mock("@/utils/queries/schedules/get-schedules-by-profile-id", () => ({
  getSchedulesByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/sessions/get-session-by-id", () => ({
  getSessionById: vi.fn(),
}));

vi.mock("@/utils/queries/sessions/get-sessions", () => ({
  getSessions: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempt-by-id",
  () => ({
    getSimulationAttemptById: vi.fn(),
  })
);

vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempts", () => ({
  getSimulationAttempts: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profile-id",
  () => ({
    getSimulationAttemptsByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-simulation-id",
  () => ({
    getSimulationAttemptsBySimulationId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-user-id",
  () => ({
    getSimulationAttemptsByUserId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-with-profiles",
  () => ({
    getSimulationAttemptsWithProfiles: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback-by-id",
  () => ({
    getSimulationChatFeedbackById: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks",
  () => ({
    getSimulationChatFeedbacks: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-profile-id",
  () => ({
    getSimulationChatFeedbacksByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-id",
  () => ({
    getSimulationChatFeedbacksBySimulationChatId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-id",
  () => ({
    getSimulationChatFeedbacksBySimulationId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-user-id",
  () => ({
    getSimulationChatFeedbacksByUserId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grade-by-id",
  () => ({
    getSimulationChatGradeById: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades",
  () => ({
    getSimulationChatGrades: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-profile-id",
  () => ({
    getSimulationChatGradesByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chat-id",
  () => ({
    getSimulationChatGradesBySimulationChatId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-id",
  () => ({
    getSimulationChatGradesBySimulationId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-user-id",
  () => ({
    getSimulationChatGradesByUserId: vi.fn(),
  })
);

vi.mock("@/utils/queries/simulation_chats/get-simulation-chat-by-id", () => ({
  getSimulationChatById: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_chats/get-simulation-chats", () => ({
  getSimulationChats: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-profile-id",
  () => ({
    getSimulationChatsByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-simulation-id",
  () => ({
    getSimulationChatsBySimulationId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-user-id",
  () => ({
    getSimulationChatsByUserId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-with-profiles",
  () => ({
    getSimulationChatsWithProfiles: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-message-by-id",
  () => ({
    getSimulationMessageById: vi.fn(),
  })
);

vi.mock("@/utils/queries/simulation_messages/get-simulation-messages", () => ({
  getSimulationMessages: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-profile-id",
  () => ({
    getSimulationMessagesByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-simulation-chat-id",
  () => ({
    getSimulationMessagesBySimulationChatId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_sketches/get-simulation-sketch-by-id",
  () => ({
    getSimulationSketchById: vi.fn(),
  })
);

vi.mock("@/utils/queries/simulation_sketches/get-simulation-sketches", () => ({
  getSimulationSketches: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_sketches/get-simulation-sketches-by-profile-id",
  () => ({
    getSimulationSketchesByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_sketches/get-simulation-sketches-by-simulation-id",
  () => ({
    getSimulationSketchesBySimulationId: vi.fn(),
  })
);

vi.mock("@/utils/queries/simulations/get-simulation-by-id", () => ({
  getSimulationById: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulations", () => ({
  getSimulations: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulations-by-profile-id", () => ({
  getSimulationsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulations-by-user-id", () => ({
  getSimulationsByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/standard_groups/get-standard-group-by-id", () => ({
  getStandardGroupById: vi.fn(),
}));

vi.mock("@/utils/queries/standard_groups/get-standard-groups", () => ({
  getStandardGroups: vi.fn(),
}));

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-profile-id",
  () => ({
    getStandardGroupsByProfileId: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-user-id",
  () => ({
    getStandardGroupsByUserId: vi.fn(),
  })
);

vi.mock("@/utils/queries/standards/get-standard-by-id", () => ({
  getStandardById: vi.fn(),
}));

vi.mock("@/utils/queries/standards/get-standards", () => ({
  getStandards: vi.fn(),
}));

vi.mock("@/utils/queries/standards/get-standards-by-profile-id", () => ({
  getStandardsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/standards/get-standards-by-user-id", () => ({
  getStandardsByUserId: vi.fn(),
}));

vi.mock("@/utils/queries/topics/get-topic-by-id", () => ({
  getTopicById: vi.fn(),
}));

vi.mock("@/utils/queries/topics/get-topics", () => ({
  getTopics: vi.fn(),
}));

vi.mock("@/utils/queries/topics/get-topics-by-profile-id", () => ({
  getTopicsByProfileId: vi.fn(),
}));

vi.mock("@/utils/queries/users/get-user-by-id", () => ({
  getUserById: vi.fn(),
}));

vi.mock("@/utils/queries/users/get-users", () => ({
  getUsers: vi.fn(),
}));

vi.mock(
  "@/utils/queries/verification_token/get-verification-token-by-identifier",
  () => ({
    getVerificationTokenByIdentifier: vi.fn(),
  })
);

// Note: We don't export the actual functions since they're mocked
// Tests can import the mocked functions directly from their original modules
// The vi.mock() calls above ensure they get the mocked versions
