import { relations } from "drizzle-orm/relations";
import { profiles, appFeedback, assistantChats, assistantMessages, assistantToolCalls, agents, modelRuns, models, personas, parameters, parameterItems, debugInfo, simulationAttempts, simulationChats, scenarios, simulationCrowdsourcedMessages, simulationMessages, simulations, simulationChatGrades, simulationChatFeedbacks, standards, rubrics, standardGroups, users, simulationChatCrowdsourcedFeedbacks } from "./schema";

export const appFeedbackRelations = relations(appFeedback, ({one}) => ({
	profile: one(profiles, {
		fields: [appFeedback.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	appFeedbacks: many(appFeedback),
	assistantChats: many(assistantChats),
	modelRuns: many(modelRuns),
	simulationCrowdsourcedMessages: many(simulationCrowdsourcedMessages),
	simulationAttempts: many(simulationAttempts),
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	simulationChatCrowdsourcedFeedbacks: many(simulationChatCrowdsourcedFeedbacks),
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

export const modelRunsRelations = relations(modelRuns, ({one, many}) => ({
	agent: one(agents, {
		fields: [modelRuns.agentId],
		references: [agents.id]
	}),
	model: one(models, {
		fields: [modelRuns.modelId],
		references: [models.id]
	}),
	persona: one(personas, {
		fields: [modelRuns.personaId],
		references: [personas.id]
	}),
	profile: one(profiles, {
		fields: [modelRuns.profileId],
		references: [profiles.id]
	}),
	debugInfos: many(debugInfo),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	modelRuns: many(modelRuns),
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
}));

export const modelsRelations = relations(models, ({many}) => ({
	modelRuns: many(modelRuns),
	personas: many(personas),
	agents: many(agents),
}));

export const personasRelations = relations(personas, ({one, many}) => ({
	modelRuns: many(modelRuns),
	model: one(models, {
		fields: [personas.modelId],
		references: [models.id]
	}),
	scenarios: many(scenarios),
}));

export const parameterItemsRelations = relations(parameterItems, ({one}) => ({
	parameter: one(parameters, {
		fields: [parameterItems.parameterId],
		references: [parameters.id]
	}),
}));

export const parametersRelations = relations(parameters, ({many}) => ({
	parameterItems: many(parameterItems),
}));

export const debugInfoRelations = relations(debugInfo, ({one}) => ({
	modelRun: one(modelRuns, {
		fields: [debugInfo.modelRunId],
		references: [modelRuns.id]
	}),
}));

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	simulationAttempt: one(simulationAttempts, {
		fields: [simulationChats.attemptId],
		references: [simulationAttempts.id]
	}),
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
	simulationMessages: many(simulationMessages),
	simulationChatGrades: many(simulationChatGrades),
}));

export const simulationAttemptsRelations = relations(simulationAttempts, ({one, many}) => ({
	simulationChats: many(simulationChats),
	profile: one(profiles, {
		fields: [simulationAttempts.profileId],
		references: [profiles.id]
	}),
	simulation: one(simulations, {
		fields: [simulationAttempts.simulationId],
		references: [simulations.id]
	}),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	simulationChats: many(simulationChats),
	persona: one(personas, {
		fields: [scenarios.personaId],
		references: [personas.id]
	}),
}));

export const simulationCrowdsourcedMessagesRelations = relations(simulationCrowdsourcedMessages, ({one}) => ({
	profile: one(profiles, {
		fields: [simulationCrowdsourcedMessages.profileId],
		references: [profiles.id]
	}),
	simulationMessage: one(simulationMessages, {
		fields: [simulationCrowdsourcedMessages.simulationMessageId],
		references: [simulationMessages.id]
	}),
}));

export const simulationMessagesRelations = relations(simulationMessages, ({one, many}) => ({
	simulationCrowdsourcedMessages: many(simulationCrowdsourcedMessages),
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	simulationAttempts: many(simulationAttempts),
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
}));

export const simulationChatFeedbacksRelations = relations(simulationChatFeedbacks, ({one, many}) => ({
	simulationChatGrade: one(simulationChatGrades, {
		fields: [simulationChatFeedbacks.simulationChatGradeId],
		references: [simulationChatGrades.id]
	}),
	standard: one(standards, {
		fields: [simulationChatFeedbacks.standardId],
		references: [standards.id]
	}),
	simulationChatCrowdsourcedFeedbacks: many(simulationChatCrowdsourcedFeedbacks),
}));

export const simulationChatGradesRelations = relations(simulationChatGrades, ({one, many}) => ({
	simulationChatFeedbacks: many(simulationChatFeedbacks),
	rubric: one(rubrics, {
		fields: [simulationChatGrades.rubricId],
		references: [rubrics.id]
	}),
	simulationChat: one(simulationChats, {
		fields: [simulationChatGrades.simulationChatId],
		references: [simulationChats.id]
	}),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	simulationChatFeedbacks: many(simulationChatFeedbacks),
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
	standards: many(standards),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	standardGroups: many(standardGroups),
	simulations: many(simulations),
	simulationChatGrades: many(simulationChatGrades),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const simulationChatCrowdsourcedFeedbacksRelations = relations(simulationChatCrowdsourcedFeedbacks, ({one}) => ({
	simulationChatFeedback: one(simulationChatFeedbacks, {
		fields: [simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId],
		references: [simulationChatFeedbacks.id]
	}),
	profile: one(profiles, {
		fields: [simulationChatCrowdsourcedFeedbacks.profileId],
		references: [profiles.id]
	}),
}));