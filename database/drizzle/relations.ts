import { relations } from "drizzle-orm/relations";
import { users, profiles, departments, providers, models, documents, rubrics, standardGroups, standards, appFeedback, assistantChats, assistantMessages, assistantToolCalls, parameters, parameterItems, personas, agents, modelRuns, debugInfo, scenarios, simulations, simulationAttempts, simulationChats, simulationMessages, simulationHints, simulationChatGrades, simulationChatFeedbacks, simulationChatCrowdsourcedFeedbacks, simulationCrowdsourcedMessages, cohorts } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	department: one(departments, {
		fields: [profiles.departmentId],
		references: [departments.id]
	}),
	appFeedbacks: many(appFeedback),
	assistantChats: many(assistantChats),
	modelRuns: many(modelRuns),
	simulationAttempts: many(simulationAttempts),
	simulationChatCrowdsourcedFeedbacks: many(simulationChatCrowdsourcedFeedbacks),
	simulationCrowdsourcedMessages: many(simulationCrowdsourcedMessages),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	profiles: many(profiles),
	providers: many(providers),
	documents: many(documents),
	rubrics: many(rubrics),
	personas: many(personas),
	modelRuns: many(modelRuns),
	parameters: many(parameters),
	scenarios: many(scenarios),
	simulations: many(simulations),
	cohorts: many(cohorts),
}));

export const providersRelations = relations(providers, ({one, many}) => ({
	department: one(departments, {
		fields: [providers.departmentId],
		references: [departments.id]
	}),
	models: many(models),
}));

export const modelsRelations = relations(models, ({one, many}) => ({
	provider: one(providers, {
		fields: [models.providerId],
		references: [providers.id]
	}),
	personas: many(personas),
	agents: many(agents),
	modelRuns: many(modelRuns),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	department: one(departments, {
		fields: [documents.departmentId],
		references: [departments.id]
	}),
}));

export const rubricsRelations = relations(rubrics, ({one, many}) => ({
	department: one(departments, {
		fields: [rubrics.departmentId],
		references: [departments.id]
	}),
	standardGroups: many(standardGroups),
	simulations: many(simulations),
	simulationChatGrades: many(simulationChatGrades),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	standards: many(standards),
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
}));

export const appFeedbackRelations = relations(appFeedback, ({one}) => ({
	profile: one(profiles, {
		fields: [appFeedback.profileId],
		references: [profiles.id]
	}),
}));

export const assistantChatsRelations = relations(assistantChats, ({one, many}) => ({
	profile: one(profiles, {
		fields: [assistantChats.profileId],
		references: [profiles.id]
	}),
	assistantMessages: many(assistantMessages),
	assistantToolCalls: many(assistantToolCalls),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantMessages.chatId],
		references: [assistantChats.id]
	}),
}));

export const assistantToolCallsRelations = relations(assistantToolCalls, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantToolCalls.chatId],
		references: [assistantChats.id]
	}),
}));

export const parameterItemsRelations = relations(parameterItems, ({one}) => ({
	parameter: one(parameters, {
		fields: [parameterItems.parameterId],
		references: [parameters.id]
	}),
}));

export const parametersRelations = relations(parameters, ({one, many}) => ({
	parameterItems: many(parameterItems),
	department: one(departments, {
		fields: [parameters.departmentId],
		references: [departments.id]
	}),
}));

export const personasRelations = relations(personas, ({one, many}) => ({
	model: one(models, {
		fields: [personas.modelId],
		references: [models.id]
	}),
	department: one(departments, {
		fields: [personas.departmentId],
		references: [departments.id]
	}),
	modelRuns: many(modelRuns),
	scenarios: many(scenarios),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
	modelRuns: many(modelRuns),
}));

export const modelRunsRelations = relations(modelRuns, ({one, many}) => ({
	model: one(models, {
		fields: [modelRuns.modelId],
		references: [models.id]
	}),
	persona: one(personas, {
		fields: [modelRuns.personaId],
		references: [personas.id]
	}),
	agent: one(agents, {
		fields: [modelRuns.agentId],
		references: [agents.id]
	}),
	profile: one(profiles, {
		fields: [modelRuns.profileId],
		references: [profiles.id]
	}),
	department: one(departments, {
		fields: [modelRuns.departmentId],
		references: [departments.id]
	}),
	debugInfos: many(debugInfo),
}));

export const debugInfoRelations = relations(debugInfo, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [debugInfo.modelRunId],
		references: [modelRuns.id]
	}),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	persona: one(personas, {
		fields: [scenarios.personaId],
		references: [personas.id]
	}),
	department: one(departments, {
		fields: [scenarios.departmentId],
		references: [departments.id]
	}),
	simulationChats: many(simulationChats),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
	department: one(departments, {
		fields: [simulations.departmentId],
		references: [departments.id]
	}),
	simulationAttempts: many(simulationAttempts),
}));

export const simulationAttemptsRelations = relations(simulationAttempts, ({one, many}) => ({
	profile: one(profiles, {
		fields: [simulationAttempts.profileId],
		references: [profiles.id]
	}),
	simulation: one(simulations, {
		fields: [simulationAttempts.simulationId],
		references: [simulations.id]
	}),
	simulationChats: many(simulationChats),
}));

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
	simulationAttempt: one(simulationAttempts, {
		fields: [simulationChats.attemptId],
		references: [simulationAttempts.id]
	}),
	simulationMessages: many(simulationMessages),
	simulationChatGrades: many(simulationChatGrades),
}));

export const simulationMessagesRelations = relations(simulationMessages, ({one, many}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
	simulationHints: many(simulationHints),
	simulationCrowdsourcedMessages: many(simulationCrowdsourcedMessages),
}));

export const simulationHintsRelations = relations(simulationHints, ({one}) => ({
	simulationMessage: one(simulationMessages, {
		fields: [simulationHints.simulationMessageId],
		references: [simulationMessages.id]
	}),
}));

export const simulationChatGradesRelations = relations(simulationChatGrades, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulationChatGrades.rubricId],
		references: [rubrics.id]
	}),
	simulationChat: one(simulationChats, {
		fields: [simulationChatGrades.simulationChatId],
		references: [simulationChats.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
}));

export const simulationChatFeedbacksRelations = relations(simulationChatFeedbacks, ({one, many}) => ({
	standard: one(standards, {
		fields: [simulationChatFeedbacks.standardId],
		references: [standards.id]
	}),
	simulationChatGrade: one(simulationChatGrades, {
		fields: [simulationChatFeedbacks.simulationChatGradeId],
		references: [simulationChatGrades.id]
	}),
	simulationChatCrowdsourcedFeedbacks: many(simulationChatCrowdsourcedFeedbacks),
}));

export const simulationChatCrowdsourcedFeedbacksRelations = relations(simulationChatCrowdsourcedFeedbacks, ({one}) => ({
	profile: one(profiles, {
		fields: [simulationChatCrowdsourcedFeedbacks.profileId],
		references: [profiles.id]
	}),
	simulationChatFeedback: one(simulationChatFeedbacks, {
		fields: [simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId],
		references: [simulationChatFeedbacks.id]
	}),
}));

export const simulationCrowdsourcedMessagesRelations = relations(simulationCrowdsourcedMessages, ({one}) => ({
	simulationMessage: one(simulationMessages, {
		fields: [simulationCrowdsourcedMessages.simulationMessageId],
		references: [simulationMessages.id]
	}),
	profile: one(profiles, {
		fields: [simulationCrowdsourcedMessages.profileId],
		references: [profiles.id]
	}),
}));

export const cohortsRelations = relations(cohorts, ({one}) => ({
	department: one(departments, {
		fields: [cohorts.departmentId],
		references: [departments.id]
	}),
}));