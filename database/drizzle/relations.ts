import { relations } from "drizzle-orm/relations";
import { agents, evals, simulationChats, simulationMessages, assistantChats, assistantMessages, assistantToolCalls, profiles, dashboards, evalChats, evalChatGrades, rubrics, evalChatFeedbacks, standards, schedules, events, evalRuns, evalMessages, scenarios, classes, simulationAttempts, simulations, users, standardGroups, simulationChatGrades, topics, documents, simulationChatFeedbacks } from "./schema";

export const evalsRelations = relations(evals, ({one, many}) => ({
	agent: one(agents, {
		fields: [evals.baseAgentId],
		references: [agents.id]
	}),
	evalRuns: many(evalRuns),
}));

export const agentsRelations = relations(agents, ({many}) => ({
	evals: many(evals),
	evalRuns: many(evalRuns),
	scenarios: many(scenarios),
}));

export const simulationMessagesRelations = relations(simulationMessages, ({one}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
}));

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	simulationMessages: many(simulationMessages),
	simulationChatGrades: many(simulationChatGrades),
	simulationAttempt: one(simulationAttempts, {
		fields: [simulationChats.attemptId],
		references: [simulationAttempts.id]
	}),
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
}));

export const assistantMessagesRelations = relations(assistantMessages, ({one, many}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantMessages.chatId],
		references: [assistantChats.id]
	}),
	assistantToolCalls: many(assistantToolCalls),
}));

export const assistantChatsRelations = relations(assistantChats, ({one, many}) => ({
	assistantMessages: many(assistantMessages),
	assistantToolCalls: many(assistantToolCalls),
	profile: one(profiles, {
		fields: [assistantChats.profileId],
		references: [profiles.id]
	}),
}));

export const assistantToolCallsRelations = relations(assistantToolCalls, ({one}) => ({
	assistantChat: one(assistantChats, {
		fields: [assistantToolCalls.chatId],
		references: [assistantChats.id]
	}),
	assistantMessage: one(assistantMessages, {
		fields: [assistantToolCalls.messageId],
		references: [assistantMessages.id]
	}),
}));

export const dashboardsRelations = relations(dashboards, ({one}) => ({
	profile: one(profiles, {
		fields: [dashboards.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	dashboards: many(dashboards),
	assistantChats: many(assistantChats),
	simulationAttempts: many(simulationAttempts),
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
}));

export const evalChatGradesRelations = relations(evalChatGrades, ({one, many}) => ({
	evalChat: one(evalChats, {
		fields: [evalChatGrades.evalChatId],
		references: [evalChats.id]
	}),
	rubric: one(rubrics, {
		fields: [evalChatGrades.rubricId],
		references: [rubrics.id]
	}),
	evalChatFeedbacks: many(evalChatFeedbacks),
}));

export const evalChatsRelations = relations(evalChats, ({one, many}) => ({
	evalChatGrades: many(evalChatGrades),
	evalMessages: many(evalMessages),
	evalRun: one(evalRuns, {
		fields: [evalChats.evalRunId],
		references: [evalRuns.id]
	}),
	scenario: one(scenarios, {
		fields: [evalChats.scenarioId],
		references: [scenarios.id]
	}),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	evalChatGrades: many(evalChatGrades),
	evalRuns: many(evalRuns),
	standardGroups: many(standardGroups),
	simulationChatGrades: many(simulationChatGrades),
	simulations: many(simulations),
}));

export const evalChatFeedbacksRelations = relations(evalChatFeedbacks, ({one}) => ({
	evalChatGrade: one(evalChatGrades, {
		fields: [evalChatFeedbacks.evalChatGradeId],
		references: [evalChatGrades.id]
	}),
	standard: one(standards, {
		fields: [evalChatFeedbacks.standardId],
		references: [standards.id]
	}),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	evalChatFeedbacks: many(evalChatFeedbacks),
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	simulationChatFeedbacks: many(simulationChatFeedbacks),
}));

export const eventsRelations = relations(events, ({one}) => ({
	schedule: one(schedules, {
		fields: [events.scheduleId],
		references: [schedules.id]
	}),
}));

export const schedulesRelations = relations(schedules, ({one, many}) => ({
	events: many(events),
	class: one(classes, {
		fields: [schedules.classId],
		references: [classes.id]
	}),
}));

export const evalRunsRelations = relations(evalRuns, ({one, many}) => ({
	agent: one(agents, {
		fields: [evalRuns.agentId],
		references: [agents.id]
	}),
	eval: one(evals, {
		fields: [evalRuns.evalId],
		references: [evals.id]
	}),
	rubric: one(rubrics, {
		fields: [evalRuns.rubricId],
		references: [rubrics.id]
	}),
	evalChats: many(evalChats),
}));

export const evalMessagesRelations = relations(evalMessages, ({one}) => ({
	evalChat: one(evalChats, {
		fields: [evalMessages.chatId],
		references: [evalChats.id]
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

export const classesRelations = relations(classes, ({many}) => ({
	scenarios: many(scenarios),
	schedules: many(schedules),
	topics: many(topics),
	documents: many(documents),
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

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	simulationAttempts: many(simulationAttempts),
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
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

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const simulationChatFeedbacksRelations = relations(simulationChatFeedbacks, ({one}) => ({
	simulationChatGrade: one(simulationChatGrades, {
		fields: [simulationChatFeedbacks.simulationChatGradeId],
		references: [simulationChatGrades.id]
	}),
	standard: one(standards, {
		fields: [simulationChatFeedbacks.standardId],
		references: [standards.id]
	}),
}));