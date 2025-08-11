import { vi } from 'vitest';
import * as mockSchema from '@/mocks/schema';

// Generated automatically by generate-mocks.js

// ACCOUNTS QUERIES
vi.mock('@/utils/queries/accounts/get-account', () => ({
  getAccount: vi.fn(() => mockSchema.accounts?.[0] || null),
}));
vi.mock('@/utils/queries/accounts/get-all-accounts', () => ({
  getAllAccounts: vi.fn(() => mockSchema.accounts || []),
}));

// AGENTS QUERIES
vi.mock('@/utils/queries/agents/get-agent', () => ({
  getAgent: vi.fn(() => mockSchema.agents?.[0] || null),
}));
vi.mock('@/utils/queries/agents/get-agents-by-model', () => ({
  getAgentsByModel: vi.fn(() => mockSchema.agents || []),
}));
vi.mock('@/utils/queries/agents/get-agents-by-models', () => ({
  getAgentsByModels: vi.fn(() => mockSchema.agents || []),
}));
vi.mock('@/utils/queries/agents/get-all-agents', () => ({
  getAllAgents: vi.fn(() => mockSchema.agents || []),
}));

// APP_FEEDBACK QUERIES
vi.mock('@/utils/queries/app_feedback/get-all-app-feedback', () => ({
  getAllAppFeedback: vi.fn(() => mockSchema.appFeedback || []),
}));
vi.mock('@/utils/queries/app_feedback/get-app-feedback-by-profile', () => ({
  getAppFeedbackByProfile: vi.fn(() => mockSchema.appFeedback || []),
}));
vi.mock('@/utils/queries/app_feedback/get-app-feedback-by-profiles', () => ({
  getAppFeedbackByProfiles: vi.fn(() => mockSchema.appFeedback || []),
}));
vi.mock('@/utils/queries/app_feedback/get-app-feedback', () => ({
  getAppFeedback: vi.fn(() => mockSchema.appFeedback?.[0] || null),
}));

// APP_LOGS QUERIES
vi.mock('@/utils/queries/app_logs/get-all-app-logs', () => ({
  getAllAppLogs: vi.fn(() => mockSchema.appLogs || []),
}));
vi.mock('@/utils/queries/app_logs/get-app-log', () => ({
  getAppLog: vi.fn(() => mockSchema.appLogs?.[0] || null),
}));

// ASSISTANT_CHATS QUERIES
vi.mock('@/utils/queries/assistant_chats/get-all-assistant-chats', () => ({
  getAllAssistantChats: vi.fn(() => mockSchema.assistantChats || []),
}));
vi.mock('@/utils/queries/assistant_chats/get-assistant-chat', () => ({
  getAssistantChat: vi.fn(() => mockSchema.assistantChats?.[0] || null),
}));
vi.mock('@/utils/queries/assistant_chats/get-assistant-chats-by-profile', () => ({
  getAssistantChatsByProfile: vi.fn(() => mockSchema.assistantChats || []),
}));
vi.mock('@/utils/queries/assistant_chats/get-assistant-chats-by-profiles', () => ({
  getAssistantChatsByProfiles: vi.fn(() => mockSchema.assistantChats || []),
}));

// ASSISTANT_MESSAGES QUERIES
vi.mock('@/utils/queries/assistant_messages/get-all-assistant-messages', () => ({
  getAllAssistantMessages: vi.fn(() => mockSchema.assistantMessages || []),
}));
vi.mock('@/utils/queries/assistant_messages/get-assistant-message', () => ({
  getAssistantMessage: vi.fn(() => mockSchema.assistantMessages?.[0] || null),
}));
vi.mock('@/utils/queries/assistant_messages/get-assistant-messages-by-chat', () => ({
  getAssistantMessagesByChat: vi.fn(() => mockSchema.assistantMessages || []),
}));
vi.mock('@/utils/queries/assistant_messages/get-assistant-messages-by-chats', () => ({
  getAssistantMessagesByChats: vi.fn(() => mockSchema.assistantMessages || []),
}));

// ASSISTANT_TOOL_CALLS QUERIES
vi.mock('@/utils/queries/assistant_tool_calls/get-all-assistant-tool-calls', () => ({
  getAllAssistantToolCalls: vi.fn(() => mockSchema.assistantToolCalls || []),
}));
vi.mock('@/utils/queries/assistant_tool_calls/get-assistant-tool-call', () => ({
  getAssistantToolCall: vi.fn(() => mockSchema.assistantToolCalls?.[0] || null),
}));
vi.mock('@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chat', () => ({
  getAssistantToolCallsByChat: vi.fn(() => mockSchema.assistantToolCalls || []),
}));
vi.mock('@/utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chats', () => ({
  getAssistantToolCallsByChats: vi.fn(() => mockSchema.assistantToolCalls || []),
}));

// COHORTS QUERIES
vi.mock('@/utils/queries/cohorts/get-all-cohorts', () => ({
  getAllCohorts: vi.fn(() => mockSchema.cohorts || []),
}));
vi.mock('@/utils/queries/cohorts/get-cohort', () => ({
  getCohort: vi.fn(() => mockSchema.cohorts?.[0] || null),
}));

// DEBUG_INFO QUERIES
vi.mock('@/utils/queries/debug_info/get-all-debug-info', () => ({
  getAllDebugInfo: vi.fn(() => mockSchema.debugInfo || []),
}));
vi.mock('@/utils/queries/debug_info/get-debug-info-by-modelrun', () => ({
  getDebugInfoByModelrun: vi.fn(() => mockSchema.debugInfo || []),
}));
vi.mock('@/utils/queries/debug_info/get-debug-info-by-modelruns', () => ({
  getDebugInfoByModelruns: vi.fn(() => mockSchema.debugInfo || []),
}));
vi.mock('@/utils/queries/debug_info/get-debug-info', () => ({
  getDebugInfo: vi.fn(() => mockSchema.debugInfo?.[0] || null),
}));

// DOCUMENTS QUERIES
vi.mock('@/utils/queries/documents/get-all-documents', () => ({
  getAllDocuments: vi.fn(() => mockSchema.documents || []),
}));
vi.mock('@/utils/queries/documents/get-document', () => ({
  getDocument: vi.fn(() => mockSchema.documents?.[0] || null),
}));

// MODEL_RUNS QUERIES
vi.mock('@/utils/queries/model_runs/get-all-model-runs', () => ({
  getAllModelRuns: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-run', () => ({
  getModelRun: vi.fn(() => mockSchema.modelRuns?.[0] || null),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-agent', () => ({
  getModelRunsByAgent: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-agents', () => ({
  getModelRunsByAgents: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-model', () => ({
  getModelRunsByModel: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-models', () => ({
  getModelRunsByModels: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-persona', () => ({
  getModelRunsByPersona: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-personas', () => ({
  getModelRunsByPersonas: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-profile', () => ({
  getModelRunsByProfile: vi.fn(() => mockSchema.modelRuns || []),
}));
vi.mock('@/utils/queries/model_runs/get-model-runs-by-profiles', () => ({
  getModelRunsByProfiles: vi.fn(() => mockSchema.modelRuns || []),
}));

// MODELS QUERIES
vi.mock('@/utils/queries/models/get-all-models', () => ({
  getAllModels: vi.fn(() => mockSchema.models || []),
}));
vi.mock('@/utils/queries/models/get-model', () => ({
  getModel: vi.fn(() => mockSchema.models?.[0] || null),
}));

// PARAMETER_ITEMS QUERIES
vi.mock('@/utils/queries/parameter_items/get-all-parameter-items', () => ({
  getAllParameterItems: vi.fn(() => mockSchema.parameterItems || []),
}));
vi.mock('@/utils/queries/parameter_items/get-parameter-item', () => ({
  getParameterItem: vi.fn(() => mockSchema.parameterItems?.[0] || null),
}));
vi.mock('@/utils/queries/parameter_items/get-parameter-items-by-parameter', () => ({
  getParameterItemsByParameter: vi.fn(() => mockSchema.parameterItems || []),
}));
vi.mock('@/utils/queries/parameter_items/get-parameter-items-by-parameters', () => ({
  getParameterItemsByParameters: vi.fn(() => mockSchema.parameterItems || []),
}));

// PARAMETERS QUERIES
vi.mock('@/utils/queries/parameters/get-all-parameters', () => ({
  getAllParameters: vi.fn(() => mockSchema.parameters || []),
}));
vi.mock('@/utils/queries/parameters/get-parameter', () => ({
  getParameter: vi.fn(() => mockSchema.parameters?.[0] || null),
}));

// PERSONAS QUERIES
vi.mock('@/utils/queries/personas/get-all-personas', () => ({
  getAllPersonas: vi.fn(() => mockSchema.personas || []),
}));
vi.mock('@/utils/queries/personas/get-persona', () => ({
  getPersona: vi.fn(() => mockSchema.personas?.[0] || null),
}));
vi.mock('@/utils/queries/personas/get-personas-by-model', () => ({
  getPersonasByModel: vi.fn(() => mockSchema.personas || []),
}));
vi.mock('@/utils/queries/personas/get-personas-by-models', () => ({
  getPersonasByModels: vi.fn(() => mockSchema.personas || []),
}));

// PROFILES QUERIES
vi.mock('@/utils/queries/profiles/get-all-profiles', () => ({
  getAllProfiles: vi.fn(() => mockSchema.profiles || []),
}));
vi.mock('@/utils/queries/profiles/get-profile', () => ({
  getProfile: vi.fn(() => mockSchema.profiles?.[0] || null),
}));
vi.mock('@/utils/queries/profiles/get-profiles-by-user', () => ({
  getProfilesByUser: vi.fn(() => mockSchema.profiles || []),
}));
vi.mock('@/utils/queries/profiles/get-profiles-by-users', () => ({
  getProfilesByUsers: vi.fn(() => mockSchema.profiles || []),
}));

// PROVIDERS QUERIES
vi.mock('@/utils/queries/providers/get-all-providers', () => ({
  getAllProviders: vi.fn(() => mockSchema.providers || []),
}));
vi.mock('@/utils/queries/providers/get-provider', () => ({
  getProvider: vi.fn(() => mockSchema.providers?.[0] || null),
}));

// RUBRICS QUERIES
vi.mock('@/utils/queries/rubrics/get-all-rubrics', () => ({
  getAllRubrics: vi.fn(() => mockSchema.rubrics || []),
}));
vi.mock('@/utils/queries/rubrics/get-rubric', () => ({
  getRubric: vi.fn(() => mockSchema.rubrics?.[0] || null),
}));

// SCENARIOS QUERIES
vi.mock('@/utils/queries/scenarios/get-all-scenarios', () => ({
  getAllScenarios: vi.fn(() => mockSchema.scenarios || []),
}));
vi.mock('@/utils/queries/scenarios/get-scenario', () => ({
  getScenario: vi.fn(() => mockSchema.scenarios?.[0] || null),
}));
vi.mock('@/utils/queries/scenarios/get-scenarios-by-persona', () => ({
  getScenariosByPersona: vi.fn(() => mockSchema.scenarios || []),
}));
vi.mock('@/utils/queries/scenarios/get-scenarios-by-personas', () => ({
  getScenariosByPersonas: vi.fn(() => mockSchema.scenarios || []),
}));

// SESSIONS QUERIES
vi.mock('@/utils/queries/sessions/get-all-sessions', () => ({
  getAllSessions: vi.fn(() => mockSchema.sessions || []),
}));
vi.mock('@/utils/queries/sessions/get-session', () => ({
  getSession: vi.fn(() => mockSchema.sessions?.[0] || null),
}));

// SIMULATION_ATTEMPTS QUERIES
vi.mock('@/utils/queries/simulation_attempts/get-all-simulation-attempts', () => ({
  getAllSimulationAttempts: vi.fn(() => mockSchema.simulationAttempts || []),
}));
vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempt', () => ({
  getSimulationAttempt: vi.fn(() => mockSchema.simulationAttempts?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-profile', () => ({
  getSimulationAttemptsByProfile: vi.fn(() => mockSchema.simulationAttempts || []),
}));
vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles', () => ({
  getSimulationAttemptsByProfiles: vi.fn(() => mockSchema.simulationAttempts || []),
}));
vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-simulation', () => ({
  getSimulationAttemptsBySimulation: vi.fn(() => mockSchema.simulationAttempts || []),
}));
vi.mock('@/utils/queries/simulation_attempts/get-simulation-attempts-by-simulations', () => ({
  getSimulationAttemptsBySimulations: vi.fn(() => mockSchema.simulationAttempts || []),
}));

// SIMULATION_CHAT_CROWDSOURCED_FEEDBACKS QUERIES
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-all-simulation-chat-crowdsourced-feedbacks', () => ({
  getAllSimulationChatCrowdsourcedFeedbacks: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedback', () => ({
  getSimulationChatCrowdsourcedFeedback: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profile', () => ({
  getSimulationChatCrowdsourcedFeedbacksByProfile: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-profiles', () => ({
  getSimulationChatCrowdsourcedFeedbacksByProfiles: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulationchatfeedback', () => ({
  getSimulationChatCrowdsourcedFeedbacksBySimulationchatfeedback: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulationchatfeedbacks', () => ({
  getSimulationChatCrowdsourcedFeedbacksBySimulationchatfeedbacks: vi.fn(() => mockSchema.simulationChatCrowdsourcedFeedbacks || []),
}));

// SIMULATION_CHAT_FEEDBACKS QUERIES
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks', () => ({
  getAllSimulationChatFeedbacks: vi.fn(() => mockSchema.simulationChatFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback', () => ({
  getSimulationChatFeedback: vi.fn(() => mockSchema.simulationChatFeedbacks?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrade', () => ({
  getSimulationChatFeedbacksBySimulationchatgrade: vi.fn(() => mockSchema.simulationChatFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades', () => ({
  getSimulationChatFeedbacksBySimulationchatgrades: vi.fn(() => mockSchema.simulationChatFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standard', () => ({
  getSimulationChatFeedbacksByStandard: vi.fn(() => mockSchema.simulationChatFeedbacks || []),
}));
vi.mock('@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standards', () => ({
  getSimulationChatFeedbacksByStandards: vi.fn(() => mockSchema.simulationChatFeedbacks || []),
}));

// SIMULATION_CHAT_GRADES QUERIES
vi.mock('@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades', () => ({
  getAllSimulationChatGrades: vi.fn(() => mockSchema.simulationChatGrades || []),
}));
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grade', () => ({
  getSimulationChatGrade: vi.fn(() => mockSchema.simulationChatGrades?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubric', () => ({
  getSimulationChatGradesByRubric: vi.fn(() => mockSchema.simulationChatGrades || []),
}));
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics', () => ({
  getSimulationChatGradesByRubrics: vi.fn(() => mockSchema.simulationChatGrades || []),
}));
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat', () => ({
  getSimulationChatGradesBySimulationchat: vi.fn(() => mockSchema.simulationChatGrades || []),
}));
vi.mock('@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats', () => ({
  getSimulationChatGradesBySimulationchats: vi.fn(() => mockSchema.simulationChatGrades || []),
}));

// SIMULATION_CHATS QUERIES
vi.mock('@/utils/queries/simulation_chats/get-all-simulation-chats', () => ({
  getAllSimulationChats: vi.fn(() => mockSchema.simulationChats || []),
}));
vi.mock('@/utils/queries/simulation_chats/get-simulation-chat', () => ({
  getSimulationChat: vi.fn(() => mockSchema.simulationChats?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempt', () => ({
  getSimulationChatsByAttempt: vi.fn(() => mockSchema.simulationChats || []),
}));
vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-attempts', () => ({
  getSimulationChatsByAttempts: vi.fn(() => mockSchema.simulationChats || []),
}));
vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-scenario', () => ({
  getSimulationChatsByScenario: vi.fn(() => mockSchema.simulationChats || []),
}));
vi.mock('@/utils/queries/simulation_chats/get-simulation-chats-by-scenarios', () => ({
  getSimulationChatsByScenarios: vi.fn(() => mockSchema.simulationChats || []),
}));

// SIMULATION_CROWDSOURCED_MESSAGES QUERIES
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-all-simulation-crowdsourced-messages', () => ({
  getAllSimulationCrowdsourcedMessages: vi.fn(() => mockSchema.simulationCrowdsourcedMessages || []),
}));
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-message', () => ({
  getSimulationCrowdsourcedMessage: vi.fn(() => mockSchema.simulationCrowdsourcedMessages?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profile', () => ({
  getSimulationCrowdsourcedMessagesByProfile: vi.fn(() => mockSchema.simulationCrowdsourcedMessages || []),
}));
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profiles', () => ({
  getSimulationCrowdsourcedMessagesByProfiles: vi.fn(() => mockSchema.simulationCrowdsourcedMessages || []),
}));
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulationmessage', () => ({
  getSimulationCrowdsourcedMessagesBySimulationmessage: vi.fn(() => mockSchema.simulationCrowdsourcedMessages || []),
}));
vi.mock('@/utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulationmessages', () => ({
  getSimulationCrowdsourcedMessagesBySimulationmessages: vi.fn(() => mockSchema.simulationCrowdsourcedMessages || []),
}));

// SIMULATION_MESSAGES QUERIES
vi.mock('@/utils/queries/simulation_messages/get-all-simulation-messages', () => ({
  getAllSimulationMessages: vi.fn(() => mockSchema.simulationMessages || []),
}));
vi.mock('@/utils/queries/simulation_messages/get-simulation-message', () => ({
  getSimulationMessage: vi.fn(() => mockSchema.simulationMessages?.[0] || null),
}));
vi.mock('@/utils/queries/simulation_messages/get-simulation-messages-by-chat', () => ({
  getSimulationMessagesByChat: vi.fn(() => mockSchema.simulationMessages || []),
}));
vi.mock('@/utils/queries/simulation_messages/get-simulation-messages-by-chats', () => ({
  getSimulationMessagesByChats: vi.fn(() => mockSchema.simulationMessages || []),
}));

// SIMULATIONS QUERIES
vi.mock('@/utils/queries/simulations/get-all-simulations', () => ({
  getAllSimulations: vi.fn(() => mockSchema.simulations || []),
}));
vi.mock('@/utils/queries/simulations/get-simulation', () => ({
  getSimulation: vi.fn(() => mockSchema.simulations?.[0] || null),
}));
vi.mock('@/utils/queries/simulations/get-simulations-by-rubric', () => ({
  getSimulationsByRubric: vi.fn(() => mockSchema.simulations || []),
}));
vi.mock('@/utils/queries/simulations/get-simulations-by-rubrics', () => ({
  getSimulationsByRubrics: vi.fn(() => mockSchema.simulations || []),
}));

// STANDARD_GROUPS QUERIES
vi.mock('@/utils/queries/standard_groups/get-all-standard-groups', () => ({
  getAllStandardGroups: vi.fn(() => mockSchema.standardGroups || []),
}));
vi.mock('@/utils/queries/standard_groups/get-standard-group', () => ({
  getStandardGroup: vi.fn(() => mockSchema.standardGroups?.[0] || null),
}));
vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubric', () => ({
  getStandardGroupsByRubric: vi.fn(() => mockSchema.standardGroups || []),
}));
vi.mock('@/utils/queries/standard_groups/get-standard-groups-by-rubrics', () => ({
  getStandardGroupsByRubrics: vi.fn(() => mockSchema.standardGroups || []),
}));

// STANDARDS QUERIES
vi.mock('@/utils/queries/standards/get-all-standards', () => ({
  getAllStandards: vi.fn(() => mockSchema.standards || []),
}));
vi.mock('@/utils/queries/standards/get-standard', () => ({
  getStandard: vi.fn(() => mockSchema.standards?.[0] || null),
}));
vi.mock('@/utils/queries/standards/get-standards-by-standardgroup', () => ({
  getStandardsByStandardgroup: vi.fn(() => mockSchema.standards || []),
}));
vi.mock('@/utils/queries/standards/get-standards-by-standardgroups', () => ({
  getStandardsByStandardgroups: vi.fn(() => mockSchema.standards || []),
}));

// USERS QUERIES
vi.mock('@/utils/queries/users/get-all-users', () => ({
  getAllUsers: vi.fn(() => mockSchema.users || []),
}));
vi.mock('@/utils/queries/users/get-user', () => ({
  getUser: vi.fn(() => mockSchema.users?.[0] || null),
}));

// VERIFICATION_TOKEN QUERIES
vi.mock('@/utils/queries/verification_token/get-all-verification-token', () => ({
  getAllVerificationToken: vi.fn(() => mockSchema.verificationToken || []),
}));

