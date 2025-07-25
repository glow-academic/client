import { vi } from 'vitest';
import * as mockSchema from '@/mocks/schema';

// Generated automatically by generate-mocks.js

// ACCOUNTS MUTATIONS
export const createAccountMock = vi.fn(() => mockSchema.accounts?.[0] || {});
export const createAccountsMock = vi.fn(() => mockSchema.accounts || []);
export const deleteAccountMock = vi.fn(() => mockSchema.accounts?.[0] || {});
export const deleteAccountsMock = vi.fn(() => mockSchema.accounts || []);
export const updateAccountMock = vi.fn(() => mockSchema.accounts?.[0] || {});
export const updateAccountsMock = vi.fn(() => mockSchema.accounts || []);

vi.mock('@/utils/mutations/accounts/create-account', () => ({ createAccount: createAccountMock }));
vi.mock('@/utils/mutations/accounts/create-accounts', () => ({ createAccounts: createAccountsMock }));
vi.mock('@/utils/mutations/accounts/delete-account', () => ({ deleteAccount: deleteAccountMock }));
vi.mock('@/utils/mutations/accounts/delete-accounts', () => ({ deleteAccounts: deleteAccountsMock }));
vi.mock('@/utils/mutations/accounts/update-account', () => ({ updateAccount: updateAccountMock }));
vi.mock('@/utils/mutations/accounts/update-accounts', () => ({ updateAccounts: updateAccountsMock }));

// APP_FEEDBACK MUTATIONS
export const createAppFeedbackMock = vi.fn(() => mockSchema.appFeedback?.[0] || {});
export const deleteAppFeedbackMock = vi.fn(() => mockSchema.appFeedback?.[0] || {});
export const updateAppFeedbackMock = vi.fn(() => mockSchema.appFeedback?.[0] || {});

vi.mock('@/utils/mutations/app_feedback/create-app-feedback', () => ({ createAppFeedback: createAppFeedbackMock }));
vi.mock('@/utils/mutations/app_feedback/delete-app-feedback', () => ({ deleteAppFeedback: deleteAppFeedbackMock }));
vi.mock('@/utils/mutations/app_feedback/update-app-feedback', () => ({ updateAppFeedback: updateAppFeedbackMock }));

// APP_LOGS MUTATIONS
export const createAppLogMock = vi.fn(() => mockSchema.appLogs?.[0] || {});
export const createAppLogsMock = vi.fn(() => mockSchema.appLogs || []);
export const deleteAppLogMock = vi.fn(() => mockSchema.appLogs?.[0] || {});
export const deleteAppLogsMock = vi.fn(() => mockSchema.appLogs || []);
export const updateAppLogMock = vi.fn(() => mockSchema.appLogs?.[0] || {});
export const updateAppLogsMock = vi.fn(() => mockSchema.appLogs || []);

vi.mock('@/utils/mutations/app_logs/create-app-log', () => ({ createAppLog: createAppLogMock }));
vi.mock('@/utils/mutations/app_logs/create-app-logs', () => ({ createAppLogs: createAppLogsMock }));
vi.mock('@/utils/mutations/app_logs/delete-app-log', () => ({ deleteAppLog: deleteAppLogMock }));
vi.mock('@/utils/mutations/app_logs/delete-app-logs', () => ({ deleteAppLogs: deleteAppLogsMock }));
vi.mock('@/utils/mutations/app_logs/update-app-log', () => ({ updateAppLog: updateAppLogMock }));
vi.mock('@/utils/mutations/app_logs/update-app-logs', () => ({ updateAppLogs: updateAppLogsMock }));

// ASSISTANT_CHATS MUTATIONS
export const createAssistantChatMock = vi.fn(() => mockSchema.assistantChats?.[0] || {});
export const createAssistantChatsMock = vi.fn(() => mockSchema.assistantChats || []);
export const deleteAssistantChatMock = vi.fn(() => mockSchema.assistantChats?.[0] || {});
export const deleteAssistantChatsMock = vi.fn(() => mockSchema.assistantChats || []);
export const updateAssistantChatMock = vi.fn(() => mockSchema.assistantChats?.[0] || {});
export const updateAssistantChatsMock = vi.fn(() => mockSchema.assistantChats || []);

vi.mock('@/utils/mutations/assistant_chats/create-assistant-chat', () => ({ createAssistantChat: createAssistantChatMock }));
vi.mock('@/utils/mutations/assistant_chats/create-assistant-chats', () => ({ createAssistantChats: createAssistantChatsMock }));
vi.mock('@/utils/mutations/assistant_chats/delete-assistant-chat', () => ({ deleteAssistantChat: deleteAssistantChatMock }));
vi.mock('@/utils/mutations/assistant_chats/delete-assistant-chats', () => ({ deleteAssistantChats: deleteAssistantChatsMock }));
vi.mock('@/utils/mutations/assistant_chats/update-assistant-chat', () => ({ updateAssistantChat: updateAssistantChatMock }));
vi.mock('@/utils/mutations/assistant_chats/update-assistant-chats', () => ({ updateAssistantChats: updateAssistantChatsMock }));

// ASSISTANT_MESSAGES MUTATIONS
export const createAssistantMessageMock = vi.fn(() => mockSchema.assistantMessages?.[0] || {});
export const createAssistantMessagesMock = vi.fn(() => mockSchema.assistantMessages || []);
export const deleteAssistantMessageMock = vi.fn(() => mockSchema.assistantMessages?.[0] || {});
export const deleteAssistantMessagesMock = vi.fn(() => mockSchema.assistantMessages || []);
export const updateAssistantMessageMock = vi.fn(() => mockSchema.assistantMessages?.[0] || {});
export const updateAssistantMessagesMock = vi.fn(() => mockSchema.assistantMessages || []);

vi.mock('@/utils/mutations/assistant_messages/create-assistant-message', () => ({ createAssistantMessage: createAssistantMessageMock }));
vi.mock('@/utils/mutations/assistant_messages/create-assistant-messages', () => ({ createAssistantMessages: createAssistantMessagesMock }));
vi.mock('@/utils/mutations/assistant_messages/delete-assistant-message', () => ({ deleteAssistantMessage: deleteAssistantMessageMock }));
vi.mock('@/utils/mutations/assistant_messages/delete-assistant-messages', () => ({ deleteAssistantMessages: deleteAssistantMessagesMock }));
vi.mock('@/utils/mutations/assistant_messages/update-assistant-message', () => ({ updateAssistantMessage: updateAssistantMessageMock }));
vi.mock('@/utils/mutations/assistant_messages/update-assistant-messages', () => ({ updateAssistantMessages: updateAssistantMessagesMock }));

// ASSISTANT_TOOL_CALLS MUTATIONS
export const createAssistantToolCallMock = vi.fn(() => mockSchema.assistantToolCalls?.[0] || {});
export const createAssistantToolCallsMock = vi.fn(() => mockSchema.assistantToolCalls || []);
export const deleteAssistantToolCallMock = vi.fn(() => mockSchema.assistantToolCalls?.[0] || {});
export const deleteAssistantToolCallsMock = vi.fn(() => mockSchema.assistantToolCalls || []);
export const updateAssistantToolCallMock = vi.fn(() => mockSchema.assistantToolCalls?.[0] || {});
export const updateAssistantToolCallsMock = vi.fn(() => mockSchema.assistantToolCalls || []);

vi.mock('@/utils/mutations/assistant_tool_calls/create-assistant-tool-call', () => ({ createAssistantToolCall: createAssistantToolCallMock }));
vi.mock('@/utils/mutations/assistant_tool_calls/create-assistant-tool-calls', () => ({ createAssistantToolCalls: createAssistantToolCallsMock }));
vi.mock('@/utils/mutations/assistant_tool_calls/delete-assistant-tool-call', () => ({ deleteAssistantToolCall: deleteAssistantToolCallMock }));
vi.mock('@/utils/mutations/assistant_tool_calls/delete-assistant-tool-calls', () => ({ deleteAssistantToolCalls: deleteAssistantToolCallsMock }));
vi.mock('@/utils/mutations/assistant_tool_calls/update-assistant-tool-call', () => ({ updateAssistantToolCall: updateAssistantToolCallMock }));
vi.mock('@/utils/mutations/assistant_tool_calls/update-assistant-tool-calls', () => ({ updateAssistantToolCalls: updateAssistantToolCallsMock }));

// COHORTS MUTATIONS
export const createCohortMock = vi.fn(() => mockSchema.cohorts?.[0] || {});
export const createCohortsMock = vi.fn(() => mockSchema.cohorts || []);
export const deleteCohortMock = vi.fn(() => mockSchema.cohorts?.[0] || {});
export const deleteCohortsMock = vi.fn(() => mockSchema.cohorts || []);
export const updateCohortMock = vi.fn(() => mockSchema.cohorts?.[0] || {});
export const updateCohortsMock = vi.fn(() => mockSchema.cohorts || []);

vi.mock('@/utils/mutations/cohorts/create-cohort', () => ({ createCohort: createCohortMock }));
vi.mock('@/utils/mutations/cohorts/create-cohorts', () => ({ createCohorts: createCohortsMock }));
vi.mock('@/utils/mutations/cohorts/delete-cohort', () => ({ deleteCohort: deleteCohortMock }));
vi.mock('@/utils/mutations/cohorts/delete-cohorts', () => ({ deleteCohorts: deleteCohortsMock }));
vi.mock('@/utils/mutations/cohorts/update-cohort', () => ({ updateCohort: updateCohortMock }));
vi.mock('@/utils/mutations/cohorts/update-cohorts', () => ({ updateCohorts: updateCohortsMock }));

// DOCUMENTS MUTATIONS
export const createDocumentMock = vi.fn(() => mockSchema.documents?.[0] || {});
export const createDocumentsMock = vi.fn(() => mockSchema.documents || []);
export const deleteDocumentMock = vi.fn(() => mockSchema.documents?.[0] || {});
export const deleteDocumentsMock = vi.fn(() => mockSchema.documents || []);
export const updateDocumentMock = vi.fn(() => mockSchema.documents?.[0] || {});
export const updateDocumentsMock = vi.fn(() => mockSchema.documents || []);

vi.mock('@/utils/mutations/documents/create-document', () => ({ createDocument: createDocumentMock }));
vi.mock('@/utils/mutations/documents/create-documents', () => ({ createDocuments: createDocumentsMock }));
vi.mock('@/utils/mutations/documents/delete-document', () => ({ deleteDocument: deleteDocumentMock }));
vi.mock('@/utils/mutations/documents/delete-documents', () => ({ deleteDocuments: deleteDocumentsMock }));
vi.mock('@/utils/mutations/documents/update-document', () => ({ updateDocument: updateDocumentMock }));
vi.mock('@/utils/mutations/documents/update-documents', () => ({ updateDocuments: updateDocumentsMock }));

// MODELS MUTATIONS
export const createModelMock = vi.fn(() => mockSchema.models?.[0] || {});
export const createModelsMock = vi.fn(() => mockSchema.models || []);
export const deleteModelMock = vi.fn(() => mockSchema.models?.[0] || {});
export const deleteModelsMock = vi.fn(() => mockSchema.models || []);
export const updateModelMock = vi.fn(() => mockSchema.models?.[0] || {});
export const updateModelsMock = vi.fn(() => mockSchema.models || []);

vi.mock('@/utils/mutations/models/create-model', () => ({ createModel: createModelMock }));
vi.mock('@/utils/mutations/models/create-models', () => ({ createModels: createModelsMock }));
vi.mock('@/utils/mutations/models/delete-model', () => ({ deleteModel: deleteModelMock }));
vi.mock('@/utils/mutations/models/delete-models', () => ({ deleteModels: deleteModelsMock }));
vi.mock('@/utils/mutations/models/update-model', () => ({ updateModel: updateModelMock }));
vi.mock('@/utils/mutations/models/update-models', () => ({ updateModels: updateModelsMock }));

// PERSONAS MUTATIONS
export const createPersonaMock = vi.fn(() => mockSchema.personas?.[0] || {});
export const createPersonasMock = vi.fn(() => mockSchema.personas || []);
export const deletePersonaMock = vi.fn(() => mockSchema.personas?.[0] || {});
export const deletePersonasMock = vi.fn(() => mockSchema.personas || []);
export const updatePersonaMock = vi.fn(() => mockSchema.personas?.[0] || {});
export const updatePersonasMock = vi.fn(() => mockSchema.personas || []);

vi.mock('@/utils/mutations/personas/create-persona', () => ({ createPersona: createPersonaMock }));
vi.mock('@/utils/mutations/personas/create-personas', () => ({ createPersonas: createPersonasMock }));
vi.mock('@/utils/mutations/personas/delete-persona', () => ({ deletePersona: deletePersonaMock }));
vi.mock('@/utils/mutations/personas/delete-personas', () => ({ deletePersonas: deletePersonasMock }));
vi.mock('@/utils/mutations/personas/update-persona', () => ({ updatePersona: updatePersonaMock }));
vi.mock('@/utils/mutations/personas/update-personas', () => ({ updatePersonas: updatePersonasMock }));

// PROFILES MUTATIONS
export const createProfileMock = vi.fn(() => mockSchema.profiles?.[0] || {});
export const createProfilesMock = vi.fn(() => mockSchema.profiles || []);
export const deleteProfileMock = vi.fn(() => mockSchema.profiles?.[0] || {});
export const deleteProfilesMock = vi.fn(() => mockSchema.profiles || []);
export const updateProfileMock = vi.fn(() => mockSchema.profiles?.[0] || {});
export const updateProfilesMock = vi.fn(() => mockSchema.profiles || []);

vi.mock('@/utils/mutations/profiles/create-profile', () => ({ createProfile: createProfileMock }));
vi.mock('@/utils/mutations/profiles/create-profiles', () => ({ createProfiles: createProfilesMock }));
vi.mock('@/utils/mutations/profiles/delete-profile', () => ({ deleteProfile: deleteProfileMock }));
vi.mock('@/utils/mutations/profiles/delete-profiles', () => ({ deleteProfiles: deleteProfilesMock }));
vi.mock('@/utils/mutations/profiles/update-profile', () => ({ updateProfile: updateProfileMock }));
vi.mock('@/utils/mutations/profiles/update-profiles', () => ({ updateProfiles: updateProfilesMock }));

// PROVIDERS MUTATIONS
export const createProviderMock = vi.fn(() => mockSchema.providers?.[0] || {});
export const createProvidersMock = vi.fn(() => mockSchema.providers || []);
export const deleteProviderMock = vi.fn(() => mockSchema.providers?.[0] || {});
export const deleteProvidersMock = vi.fn(() => mockSchema.providers || []);
export const updateProviderMock = vi.fn(() => mockSchema.providers?.[0] || {});
export const updateProvidersMock = vi.fn(() => mockSchema.providers || []);

vi.mock('@/utils/mutations/providers/create-provider', () => ({ createProvider: createProviderMock }));
vi.mock('@/utils/mutations/providers/create-providers', () => ({ createProviders: createProvidersMock }));
vi.mock('@/utils/mutations/providers/delete-provider', () => ({ deleteProvider: deleteProviderMock }));
vi.mock('@/utils/mutations/providers/delete-providers', () => ({ deleteProviders: deleteProvidersMock }));
vi.mock('@/utils/mutations/providers/update-provider', () => ({ updateProvider: updateProviderMock }));
vi.mock('@/utils/mutations/providers/update-providers', () => ({ updateProviders: updateProvidersMock }));

// RUBRICS MUTATIONS
export const createRubricMock = vi.fn(() => mockSchema.rubrics?.[0] || {});
export const createRubricsMock = vi.fn(() => mockSchema.rubrics || []);
export const deleteRubricMock = vi.fn(() => mockSchema.rubrics?.[0] || {});
export const deleteRubricsMock = vi.fn(() => mockSchema.rubrics || []);
export const updateRubricMock = vi.fn(() => mockSchema.rubrics?.[0] || {});
export const updateRubricsMock = vi.fn(() => mockSchema.rubrics || []);

vi.mock('@/utils/mutations/rubrics/create-rubric', () => ({ createRubric: createRubricMock }));
vi.mock('@/utils/mutations/rubrics/create-rubrics', () => ({ createRubrics: createRubricsMock }));
vi.mock('@/utils/mutations/rubrics/delete-rubric', () => ({ deleteRubric: deleteRubricMock }));
vi.mock('@/utils/mutations/rubrics/delete-rubrics', () => ({ deleteRubrics: deleteRubricsMock }));
vi.mock('@/utils/mutations/rubrics/update-rubric', () => ({ updateRubric: updateRubricMock }));
vi.mock('@/utils/mutations/rubrics/update-rubrics', () => ({ updateRubrics: updateRubricsMock }));

// SCENARIO_CLASSES MUTATIONS
export const createScenarioClassMock = vi.fn(() => mockSchema.scenarioClasses || []);
export const createScenarioClassesMock = vi.fn(() => mockSchema.scenarioClasses || []);
export const deleteScenarioClassMock = vi.fn(() => mockSchema.scenarioClasses || []);
export const deleteScenarioClassesMock = vi.fn(() => mockSchema.scenarioClasses || []);
export const updateScenarioClassMock = vi.fn(() => mockSchema.scenarioClasses || []);
export const updateScenarioClassesMock = vi.fn(() => mockSchema.scenarioClasses || []);

vi.mock('@/utils/mutations/scenario_classes/create-scenario-class', () => ({ createScenarioClass: createScenarioClassMock }));
vi.mock('@/utils/mutations/scenario_classes/create-scenario-classes', () => ({ createScenarioClasses: createScenarioClassesMock }));
vi.mock('@/utils/mutations/scenario_classes/delete-scenario-class', () => ({ deleteScenarioClass: deleteScenarioClassMock }));
vi.mock('@/utils/mutations/scenario_classes/delete-scenario-classes', () => ({ deleteScenarioClasses: deleteScenarioClassesMock }));
vi.mock('@/utils/mutations/scenario_classes/update-scenario-class', () => ({ updateScenarioClass: updateScenarioClassMock }));
vi.mock('@/utils/mutations/scenario_classes/update-scenario-classes', () => ({ updateScenarioClasses: updateScenarioClassesMock }));

// SCENARIO_DEADLINES MUTATIONS
export const createScenarioDeadlineMock = vi.fn(() => mockSchema.scenarioDeadlines?.[0] || {});
export const createScenarioDeadlinesMock = vi.fn(() => mockSchema.scenarioDeadlines || []);
export const deleteScenarioDeadlineMock = vi.fn(() => mockSchema.scenarioDeadlines?.[0] || {});
export const deleteScenarioDeadlinesMock = vi.fn(() => mockSchema.scenarioDeadlines || []);
export const updateScenarioDeadlineMock = vi.fn(() => mockSchema.scenarioDeadlines?.[0] || {});
export const updateScenarioDeadlinesMock = vi.fn(() => mockSchema.scenarioDeadlines || []);

vi.mock('@/utils/mutations/scenario_deadlines/create-scenario-deadline', () => ({ createScenarioDeadline: createScenarioDeadlineMock }));
vi.mock('@/utils/mutations/scenario_deadlines/create-scenario-deadlines', () => ({ createScenarioDeadlines: createScenarioDeadlinesMock }));
vi.mock('@/utils/mutations/scenario_deadlines/delete-scenario-deadline', () => ({ deleteScenarioDeadline: deleteScenarioDeadlineMock }));
vi.mock('@/utils/mutations/scenario_deadlines/delete-scenario-deadlines', () => ({ deleteScenarioDeadlines: deleteScenarioDeadlinesMock }));
vi.mock('@/utils/mutations/scenario_deadlines/update-scenario-deadline', () => ({ updateScenarioDeadline: updateScenarioDeadlineMock }));
vi.mock('@/utils/mutations/scenario_deadlines/update-scenario-deadlines', () => ({ updateScenarioDeadlines: updateScenarioDeadlinesMock }));

// SCENARIO_LOCATIONS MUTATIONS
export const createScenarioLocationMock = vi.fn(() => mockSchema.scenarioLocations?.[0] || {});
export const createScenarioLocationsMock = vi.fn(() => mockSchema.scenarioLocations || []);
export const deleteScenarioLocationMock = vi.fn(() => mockSchema.scenarioLocations?.[0] || {});
export const deleteScenarioLocationsMock = vi.fn(() => mockSchema.scenarioLocations || []);
export const updateScenarioLocationMock = vi.fn(() => mockSchema.scenarioLocations?.[0] || {});
export const updateScenarioLocationsMock = vi.fn(() => mockSchema.scenarioLocations || []);

vi.mock('@/utils/mutations/scenario_locations/create-scenario-location', () => ({ createScenarioLocation: createScenarioLocationMock }));
vi.mock('@/utils/mutations/scenario_locations/create-scenario-locations', () => ({ createScenarioLocations: createScenarioLocationsMock }));
vi.mock('@/utils/mutations/scenario_locations/delete-scenario-location', () => ({ deleteScenarioLocation: deleteScenarioLocationMock }));
vi.mock('@/utils/mutations/scenario_locations/delete-scenario-locations', () => ({ deleteScenarioLocations: deleteScenarioLocationsMock }));
vi.mock('@/utils/mutations/scenario_locations/update-scenario-location', () => ({ updateScenarioLocation: updateScenarioLocationMock }));
vi.mock('@/utils/mutations/scenario_locations/update-scenario-locations', () => ({ updateScenarioLocations: updateScenarioLocationsMock }));

// SCENARIO_TIMES MUTATIONS
export const createScenarioTimeMock = vi.fn(() => mockSchema.scenarioTimes?.[0] || {});
export const createScenarioTimesMock = vi.fn(() => mockSchema.scenarioTimes || []);
export const deleteScenarioTimeMock = vi.fn(() => mockSchema.scenarioTimes?.[0] || {});
export const deleteScenarioTimesMock = vi.fn(() => mockSchema.scenarioTimes || []);
export const updateScenarioTimeMock = vi.fn(() => mockSchema.scenarioTimes?.[0] || {});
export const updateScenarioTimesMock = vi.fn(() => mockSchema.scenarioTimes || []);

vi.mock('@/utils/mutations/scenario_times/create-scenario-time', () => ({ createScenarioTime: createScenarioTimeMock }));
vi.mock('@/utils/mutations/scenario_times/create-scenario-times', () => ({ createScenarioTimes: createScenarioTimesMock }));
vi.mock('@/utils/mutations/scenario_times/delete-scenario-time', () => ({ deleteScenarioTime: deleteScenarioTimeMock }));
vi.mock('@/utils/mutations/scenario_times/delete-scenario-times', () => ({ deleteScenarioTimes: deleteScenarioTimesMock }));
vi.mock('@/utils/mutations/scenario_times/update-scenario-time', () => ({ updateScenarioTime: updateScenarioTimeMock }));
vi.mock('@/utils/mutations/scenario_times/update-scenario-times', () => ({ updateScenarioTimes: updateScenarioTimesMock }));

// SCENARIOS MUTATIONS
export const createScenarioMock = vi.fn(() => mockSchema.scenarios?.[0] || {});
export const createScenariosMock = vi.fn(() => mockSchema.scenarios || []);
export const deleteScenarioMock = vi.fn(() => mockSchema.scenarios?.[0] || {});
export const deleteScenariosMock = vi.fn(() => mockSchema.scenarios || []);
export const updateScenarioMock = vi.fn(() => mockSchema.scenarios?.[0] || {});
export const updateScenariosMock = vi.fn(() => mockSchema.scenarios || []);

vi.mock('@/utils/mutations/scenarios/create-scenario', () => ({ createScenario: createScenarioMock }));
vi.mock('@/utils/mutations/scenarios/create-scenarios', () => ({ createScenarios: createScenariosMock }));
vi.mock('@/utils/mutations/scenarios/delete-scenario', () => ({ deleteScenario: deleteScenarioMock }));
vi.mock('@/utils/mutations/scenarios/delete-scenarios', () => ({ deleteScenarios: deleteScenariosMock }));
vi.mock('@/utils/mutations/scenarios/update-scenario', () => ({ updateScenario: updateScenarioMock }));
vi.mock('@/utils/mutations/scenarios/update-scenarios', () => ({ updateScenarios: updateScenariosMock }));

// SESSIONS MUTATIONS
export const createSessionMock = vi.fn(() => mockSchema.sessions?.[0] || {});
export const createSessionsMock = vi.fn(() => mockSchema.sessions || []);
export const deleteSessionMock = vi.fn(() => mockSchema.sessions?.[0] || {});
export const deleteSessionsMock = vi.fn(() => mockSchema.sessions || []);
export const updateSessionMock = vi.fn(() => mockSchema.sessions?.[0] || {});
export const updateSessionsMock = vi.fn(() => mockSchema.sessions || []);

vi.mock('@/utils/mutations/sessions/create-session', () => ({ createSession: createSessionMock }));
vi.mock('@/utils/mutations/sessions/create-sessions', () => ({ createSessions: createSessionsMock }));
vi.mock('@/utils/mutations/sessions/delete-session', () => ({ deleteSession: deleteSessionMock }));
vi.mock('@/utils/mutations/sessions/delete-sessions', () => ({ deleteSessions: deleteSessionsMock }));
vi.mock('@/utils/mutations/sessions/update-session', () => ({ updateSession: updateSessionMock }));
vi.mock('@/utils/mutations/sessions/update-sessions', () => ({ updateSessions: updateSessionsMock }));

// SIMULATION_ATTEMPTS MUTATIONS
export const createSimulationAttemptMock = vi.fn(() => mockSchema.simulationAttempts?.[0] || {});
export const createSimulationAttemptsMock = vi.fn(() => mockSchema.simulationAttempts || []);
export const deleteSimulationAttemptMock = vi.fn(() => mockSchema.simulationAttempts?.[0] || {});
export const deleteSimulationAttemptsMock = vi.fn(() => mockSchema.simulationAttempts || []);
export const updateSimulationAttemptMock = vi.fn(() => mockSchema.simulationAttempts?.[0] || {});
export const updateSimulationAttemptsMock = vi.fn(() => mockSchema.simulationAttempts || []);

vi.mock('@/utils/mutations/simulation_attempts/create-simulation-attempt', () => ({ createSimulationAttempt: createSimulationAttemptMock }));
vi.mock('@/utils/mutations/simulation_attempts/create-simulation-attempts', () => ({ createSimulationAttempts: createSimulationAttemptsMock }));
vi.mock('@/utils/mutations/simulation_attempts/delete-simulation-attempt', () => ({ deleteSimulationAttempt: deleteSimulationAttemptMock }));
vi.mock('@/utils/mutations/simulation_attempts/delete-simulation-attempts', () => ({ deleteSimulationAttempts: deleteSimulationAttemptsMock }));
vi.mock('@/utils/mutations/simulation_attempts/update-simulation-attempt', () => ({ updateSimulationAttempt: updateSimulationAttemptMock }));
vi.mock('@/utils/mutations/simulation_attempts/update-simulation-attempts', () => ({ updateSimulationAttempts: updateSimulationAttemptsMock }));

// SIMULATION_CHAT_FEEDBACKS MUTATIONS
export const createSimulationChatFeedbackMock = vi.fn(() => mockSchema.simulationChatFeedbacks?.[0] || {});
export const createSimulationChatFeedbacksMock = vi.fn(() => mockSchema.simulationChatFeedbacks || []);
export const deleteSimulationChatFeedbackMock = vi.fn(() => mockSchema.simulationChatFeedbacks?.[0] || {});
export const deleteSimulationChatFeedbacksMock = vi.fn(() => mockSchema.simulationChatFeedbacks || []);
export const updateSimulationChatFeedbackMock = vi.fn(() => mockSchema.simulationChatFeedbacks?.[0] || {});
export const updateSimulationChatFeedbacksMock = vi.fn(() => mockSchema.simulationChatFeedbacks || []);

vi.mock('@/utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedback', () => ({ createSimulationChatFeedback: createSimulationChatFeedbackMock }));
vi.mock('@/utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks', () => ({ createSimulationChatFeedbacks: createSimulationChatFeedbacksMock }));
vi.mock('@/utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedback', () => ({ deleteSimulationChatFeedback: deleteSimulationChatFeedbackMock }));
vi.mock('@/utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedbacks', () => ({ deleteSimulationChatFeedbacks: deleteSimulationChatFeedbacksMock }));
vi.mock('@/utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedback', () => ({ updateSimulationChatFeedback: updateSimulationChatFeedbackMock }));
vi.mock('@/utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedbacks', () => ({ updateSimulationChatFeedbacks: updateSimulationChatFeedbacksMock }));

// SIMULATION_CHAT_GRADES MUTATIONS
export const createSimulationChatGradeMock = vi.fn(() => mockSchema.simulationChatGrades?.[0] || {});
export const createSimulationChatGradesMock = vi.fn(() => mockSchema.simulationChatGrades || []);
export const deleteSimulationChatGradeMock = vi.fn(() => mockSchema.simulationChatGrades?.[0] || {});
export const deleteSimulationChatGradesMock = vi.fn(() => mockSchema.simulationChatGrades || []);
export const updateSimulationChatGradeMock = vi.fn(() => mockSchema.simulationChatGrades?.[0] || {});
export const updateSimulationChatGradesMock = vi.fn(() => mockSchema.simulationChatGrades || []);

vi.mock('@/utils/mutations/simulation_chat_grades/create-simulation-chat-grade', () => ({ createSimulationChatGrade: createSimulationChatGradeMock }));
vi.mock('@/utils/mutations/simulation_chat_grades/create-simulation-chat-grades', () => ({ createSimulationChatGrades: createSimulationChatGradesMock }));
vi.mock('@/utils/mutations/simulation_chat_grades/delete-simulation-chat-grade', () => ({ deleteSimulationChatGrade: deleteSimulationChatGradeMock }));
vi.mock('@/utils/mutations/simulation_chat_grades/delete-simulation-chat-grades', () => ({ deleteSimulationChatGrades: deleteSimulationChatGradesMock }));
vi.mock('@/utils/mutations/simulation_chat_grades/update-simulation-chat-grade', () => ({ updateSimulationChatGrade: updateSimulationChatGradeMock }));
vi.mock('@/utils/mutations/simulation_chat_grades/update-simulation-chat-grades', () => ({ updateSimulationChatGrades: updateSimulationChatGradesMock }));

// SIMULATION_CHATS MUTATIONS
export const createSimulationChatMock = vi.fn(() => mockSchema.simulationChats?.[0] || {});
export const createSimulationChatsMock = vi.fn(() => mockSchema.simulationChats || []);
export const deleteSimulationChatMock = vi.fn(() => mockSchema.simulationChats?.[0] || {});
export const deleteSimulationChatsMock = vi.fn(() => mockSchema.simulationChats || []);
export const updateSimulationChatMock = vi.fn(() => mockSchema.simulationChats?.[0] || {});
export const updateSimulationChatsMock = vi.fn(() => mockSchema.simulationChats || []);

vi.mock('@/utils/mutations/simulation_chats/create-simulation-chat', () => ({ createSimulationChat: createSimulationChatMock }));
vi.mock('@/utils/mutations/simulation_chats/create-simulation-chats', () => ({ createSimulationChats: createSimulationChatsMock }));
vi.mock('@/utils/mutations/simulation_chats/delete-simulation-chat', () => ({ deleteSimulationChat: deleteSimulationChatMock }));
vi.mock('@/utils/mutations/simulation_chats/delete-simulation-chats', () => ({ deleteSimulationChats: deleteSimulationChatsMock }));
vi.mock('@/utils/mutations/simulation_chats/update-simulation-chat', () => ({ updateSimulationChat: updateSimulationChatMock }));
vi.mock('@/utils/mutations/simulation_chats/update-simulation-chats', () => ({ updateSimulationChats: updateSimulationChatsMock }));

// SIMULATION_MESSAGES MUTATIONS
export const createSimulationMessageMock = vi.fn(() => mockSchema.simulationMessages?.[0] || {});
export const createSimulationMessagesMock = vi.fn(() => mockSchema.simulationMessages || []);
export const deleteSimulationMessageMock = vi.fn(() => mockSchema.simulationMessages?.[0] || {});
export const deleteSimulationMessagesMock = vi.fn(() => mockSchema.simulationMessages || []);
export const updateSimulationMessageMock = vi.fn(() => mockSchema.simulationMessages?.[0] || {});
export const updateSimulationMessagesMock = vi.fn(() => mockSchema.simulationMessages || []);

vi.mock('@/utils/mutations/simulation_messages/create-simulation-message', () => ({ createSimulationMessage: createSimulationMessageMock }));
vi.mock('@/utils/mutations/simulation_messages/create-simulation-messages', () => ({ createSimulationMessages: createSimulationMessagesMock }));
vi.mock('@/utils/mutations/simulation_messages/delete-simulation-message', () => ({ deleteSimulationMessage: deleteSimulationMessageMock }));
vi.mock('@/utils/mutations/simulation_messages/delete-simulation-messages', () => ({ deleteSimulationMessages: deleteSimulationMessagesMock }));
vi.mock('@/utils/mutations/simulation_messages/update-simulation-message', () => ({ updateSimulationMessage: updateSimulationMessageMock }));
vi.mock('@/utils/mutations/simulation_messages/update-simulation-messages', () => ({ updateSimulationMessages: updateSimulationMessagesMock }));

// SIMULATIONS MUTATIONS
export const createSimulationMock = vi.fn(() => mockSchema.simulations?.[0] || {});
export const createSimulationsMock = vi.fn(() => mockSchema.simulations || []);
export const deleteSimulationMock = vi.fn(() => mockSchema.simulations?.[0] || {});
export const deleteSimulationsMock = vi.fn(() => mockSchema.simulations || []);
export const updateSimulationMock = vi.fn(() => mockSchema.simulations?.[0] || {});
export const updateSimulationsMock = vi.fn(() => mockSchema.simulations || []);

vi.mock('@/utils/mutations/simulations/create-simulation', () => ({ createSimulation: createSimulationMock }));
vi.mock('@/utils/mutations/simulations/create-simulations', () => ({ createSimulations: createSimulationsMock }));
vi.mock('@/utils/mutations/simulations/delete-simulation', () => ({ deleteSimulation: deleteSimulationMock }));
vi.mock('@/utils/mutations/simulations/delete-simulations', () => ({ deleteSimulations: deleteSimulationsMock }));
vi.mock('@/utils/mutations/simulations/update-simulation', () => ({ updateSimulation: updateSimulationMock }));
vi.mock('@/utils/mutations/simulations/update-simulations', () => ({ updateSimulations: updateSimulationsMock }));

// STANDARD_GROUPS MUTATIONS
export const createStandardGroupMock = vi.fn(() => mockSchema.standardGroups?.[0] || {});
export const createStandardGroupsMock = vi.fn(() => mockSchema.standardGroups || []);
export const deleteStandardGroupMock = vi.fn(() => mockSchema.standardGroups?.[0] || {});
export const deleteStandardGroupsMock = vi.fn(() => mockSchema.standardGroups || []);
export const updateStandardGroupMock = vi.fn(() => mockSchema.standardGroups?.[0] || {});
export const updateStandardGroupsMock = vi.fn(() => mockSchema.standardGroups || []);

vi.mock('@/utils/mutations/standard_groups/create-standard-group', () => ({ createStandardGroup: createStandardGroupMock }));
vi.mock('@/utils/mutations/standard_groups/create-standard-groups', () => ({ createStandardGroups: createStandardGroupsMock }));
vi.mock('@/utils/mutations/standard_groups/delete-standard-group', () => ({ deleteStandardGroup: deleteStandardGroupMock }));
vi.mock('@/utils/mutations/standard_groups/delete-standard-groups', () => ({ deleteStandardGroups: deleteStandardGroupsMock }));
vi.mock('@/utils/mutations/standard_groups/update-standard-group', () => ({ updateStandardGroup: updateStandardGroupMock }));
vi.mock('@/utils/mutations/standard_groups/update-standard-groups', () => ({ updateStandardGroups: updateStandardGroupsMock }));

// STANDARDS MUTATIONS
export const createStandardMock = vi.fn(() => mockSchema.standards?.[0] || {});
export const createStandardsMock = vi.fn(() => mockSchema.standards || []);
export const deleteStandardMock = vi.fn(() => mockSchema.standards?.[0] || {});
export const deleteStandardsMock = vi.fn(() => mockSchema.standards || []);
export const updateStandardMock = vi.fn(() => mockSchema.standards?.[0] || {});
export const updateStandardsMock = vi.fn(() => mockSchema.standards || []);

vi.mock('@/utils/mutations/standards/create-standard', () => ({ createStandard: createStandardMock }));
vi.mock('@/utils/mutations/standards/create-standards', () => ({ createStandards: createStandardsMock }));
vi.mock('@/utils/mutations/standards/delete-standard', () => ({ deleteStandard: deleteStandardMock }));
vi.mock('@/utils/mutations/standards/delete-standards', () => ({ deleteStandards: deleteStandardsMock }));
vi.mock('@/utils/mutations/standards/update-standard', () => ({ updateStandard: updateStandardMock }));
vi.mock('@/utils/mutations/standards/update-standards', () => ({ updateStandards: updateStandardsMock }));

// SYSTEM_AGENTS MUTATIONS
export const createSystemAgentMock = vi.fn(() => mockSchema.systemAgents?.[0] || {});
export const createSystemAgentsMock = vi.fn(() => mockSchema.systemAgents || []);
export const deleteSystemAgentMock = vi.fn(() => mockSchema.systemAgents?.[0] || {});
export const deleteSystemAgentsMock = vi.fn(() => mockSchema.systemAgents || []);
export const updateSystemAgentMock = vi.fn(() => mockSchema.systemAgents?.[0] || {});
export const updateSystemAgentsMock = vi.fn(() => mockSchema.systemAgents || []);

vi.mock('@/utils/mutations/system_agents/create-system-agent', () => ({ createSystemAgent: createSystemAgentMock }));
vi.mock('@/utils/mutations/system_agents/create-system-agents', () => ({ createSystemAgents: createSystemAgentsMock }));
vi.mock('@/utils/mutations/system_agents/delete-system-agent', () => ({ deleteSystemAgent: deleteSystemAgentMock }));
vi.mock('@/utils/mutations/system_agents/delete-system-agents', () => ({ deleteSystemAgents: deleteSystemAgentsMock }));
vi.mock('@/utils/mutations/system_agents/update-system-agent', () => ({ updateSystemAgent: updateSystemAgentMock }));
vi.mock('@/utils/mutations/system_agents/update-system-agents', () => ({ updateSystemAgents: updateSystemAgentsMock }));

// USERS MUTATIONS
export const createUserMock = vi.fn(() => mockSchema.users?.[0] || {});
export const createUsersMock = vi.fn(() => mockSchema.users || []);
export const deleteUserMock = vi.fn(() => mockSchema.users?.[0] || {});
export const deleteUsersMock = vi.fn(() => mockSchema.users || []);
export const updateUserMock = vi.fn(() => mockSchema.users?.[0] || {});
export const updateUsersMock = vi.fn(() => mockSchema.users || []);

vi.mock('@/utils/mutations/users/create-user', () => ({ createUser: createUserMock }));
vi.mock('@/utils/mutations/users/create-users', () => ({ createUsers: createUsersMock }));
vi.mock('@/utils/mutations/users/delete-user', () => ({ deleteUser: deleteUserMock }));
vi.mock('@/utils/mutations/users/delete-users', () => ({ deleteUsers: deleteUsersMock }));
vi.mock('@/utils/mutations/users/update-user', () => ({ updateUser: updateUserMock }));
vi.mock('@/utils/mutations/users/update-users', () => ({ updateUsers: updateUsersMock }));

// VERIFICATION_TOKEN MUTATIONS
export const createVerificationTokenMock = vi.fn(() => mockSchema.verificationToken?.[0] || {});

vi.mock('@/utils/mutations/verification_token/create-verification-token', () => ({ createVerificationToken: createVerificationTokenMock }));

