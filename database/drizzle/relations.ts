import { relations } from "drizzle-orm/relations";
import { classes, topics, schedules, events, documents, users, profiles, rubrics, standardGroups, standards, assistantChats, assistantMessages, assistantToolCalls, agents, scenarios, dashboards, models, simulations, simulationAttempts, simulationChats, simulationMessages, simulationChatGrades, simulationChatFeedbacks, evals, evalRuns, evalChats, evalMessages, evalChatGrades, evalChatFeedbacks } from "./schema";

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	topics: many(topics),
	schedules: many(schedules),
	documents: many(documents),
	scenarios: many(scenarios),
}));

export const schedulesRelations = relations(schedules, ({one, many}) => ({
	class: one(classes, {
		fields: [schedules.classId],
		references: [classes.id]
	}),
	events: many(events),
}));

export const eventsRelations = relations(events, ({one}) => ({
	schedule: one(schedules, {
		fields: [events.scheduleId],
		references: [schedules.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	assistantChats: many(assistantChats),
	dashboards: many(dashboards),
	simulationAttempts: many(simulationAttempts),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
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
	evalRuns: many(evalRuns),
	evalChatGrades: many(evalChatGrades),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
	evalChatFeedbacks: many(evalChatFeedbacks),
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

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	agent: one(agents, {
		fields: [scenarios.agentId],
		references: [agents.id]
	}),
	class: one(classes, {
		fields: [scenarios.classId],
		references: [classes.id]
	}),
	simulationChats: many(simulationChats),
	evalChats: many(evalChats),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	scenarios: many(scenarios),
	model: one(models, {
		fields: [agents.modelId],
		references: [models.id]
	}),
	evals: many(evals),
	evalRuns: many(evalRuns),
}));

export const dashboardsRelations = relations(dashboards, ({one}) => ({
	profile: one(profiles, {
		fields: [dashboards.profileId],
		references: [profiles.id]
	}),
}));

export const modelsRelations = relations(models, ({many}) => ({
	agents: many(agents),
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

export const evalsRelations = relations(evals, ({one, many}) => ({
	agent: one(agents, {
		fields: [evals.baseAgentId],
		references: [agents.id]
	}),
	evalRuns: many(evalRuns),
}));

export const evalRunsRelations = relations(evalRuns, ({one, many}) => ({
	eval: one(evals, {
		fields: [evalRuns.evalId],
		references: [evals.id]
	}),
	agent: one(agents, {
		fields: [evalRuns.agentId],
		references: [agents.id]
	}),
	rubric: one(rubrics, {
		fields: [evalRuns.rubricId],
		references: [rubrics.id]
	}),
	evalChats: many(evalChats),
}));

export const evalChatsRelations = relations(evalChats, ({one, many}) => ({
	scenario: one(scenarios, {
		fields: [evalChats.scenarioId],
		references: [scenarios.id]
	}),
	evalRun: one(evalRuns, {
		fields: [evalChats.evalRunId],
		references: [evalRuns.id]
	}),
	evalMessages: many(evalMessages),
	evalChatGrades: many(evalChatGrades),
}));

export const evalMessagesRelations = relations(evalMessages, ({one}) => ({
	evalChat: one(evalChats, {
		fields: [evalMessages.chatId],
		references: [evalChats.id]
	}),
}));

export const evalChatGradesRelations = relations(evalChatGrades, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [evalChatGrades.rubricId],
		references: [rubrics.id]
	}),
	evalChat: one(evalChats, {
		fields: [evalChatGrades.evalChatId],
		references: [evalChats.id]
	}),
	evalChatFeedbacks: many(evalChatFeedbacks),
}));

export const evalChatFeedbacksRelations = relations(evalChatFeedbacks, ({one}) => ({
	standard: one(standards, {
		fields: [evalChatFeedbacks.standardId],
		references: [standards.id]
	}),
	evalChatGrade: one(evalChatGrades, {
		fields: [evalChatFeedbacks.evalChatGradeId],
		references: [evalChatGrades.id]
	}),
}));