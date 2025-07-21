import { relations } from "drizzle-orm/relations";
import { users, profiles, departments, classes, documents, rubrics, standardGroups, standards, appFeedback, assistantChats, assistantMessages, assistantToolCalls, dashboards, models, agents, systemAgents, scenarios, scenarioLocations, scenarioDeadlines, scenarioTimes, cohorts, simulations, simulationAttempts, simulationChats, simulationMessages, simulationChatGrades, simulationChatFeedbacks } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	appFeedbacks: many(appFeedback),
	assistantChats: many(assistantChats),
	dashboards: many(dashboards),
	simulationAttempts: many(simulationAttempts),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
	department: one(departments, {
		fields: [classes.departmentId],
		references: [departments.id]
	}),
	documents: many(documents),
	scenarios: many(scenarios),
}));

export const departmentsRelations = relations(departments, ({many}) => ({
	classes: many(classes),
	cohorts: many(cohorts),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
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

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
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

export const dashboardsRelations = relations(dashboards, ({one}) => ({
	profile: one(profiles, {
		fields: [dashboards.profileId],
		references: [profiles.id]
	}),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
	scenarios: many(scenarios),
}));

export const modelsRelations = relations(models, ({many}) => ({
	agents: many(agents),
	systemAgents: many(systemAgents),
}));

export const systemAgentsRelations = relations(systemAgents, ({one}) => ({
	model: one(models, {
		fields: [systemAgents.modelId],
		references: [models.id]
	}),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	agent: one(agents, {
		fields: [scenarios.agentId],
		references: [agents.id]
	}),
	class: one(classes, {
		fields: [scenarios.classId],
		references: [classes.id]
	}),
	scenarioLocation: one(scenarioLocations, {
		fields: [scenarios.locationId],
		references: [scenarioLocations.id]
	}),
	scenarioDeadline: one(scenarioDeadlines, {
		fields: [scenarios.deadlineId],
		references: [scenarioDeadlines.id]
	}),
	scenarioTime: one(scenarioTimes, {
		fields: [scenarios.timeId],
		references: [scenarioTimes.id]
	}),
	simulationChats: many(simulationChats),
}));

export const scenarioLocationsRelations = relations(scenarioLocations, ({many}) => ({
	scenarios: many(scenarios),
}));

export const scenarioDeadlinesRelations = relations(scenarioDeadlines, ({many}) => ({
	scenarios: many(scenarios),
}));

export const scenarioTimesRelations = relations(scenarioTimes, ({many}) => ({
	scenarios: many(scenarios),
}));

export const cohortsRelations = relations(cohorts, ({one}) => ({
	department: one(departments, {
		fields: [cohorts.departmentId],
		references: [departments.id]
	}),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
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

export const simulationMessagesRelations = relations(simulationMessages, ({one}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
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

export const simulationChatFeedbacksRelations = relations(simulationChatFeedbacks, ({one}) => ({
	standard: one(standards, {
		fields: [simulationChatFeedbacks.standardId],
		references: [standards.id]
	}),
	simulationChatGrade: one(simulationChatGrades, {
		fields: [simulationChatFeedbacks.simulationChatGradeId],
		references: [simulationChatGrades.id]
	}),
}));