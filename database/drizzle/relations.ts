import { relations } from "drizzle-orm/relations";
import { agents, evals, evalChats, evalChatGrades, rubrics, evalChatFeedbacks, standards, evalRuns, scenarios, schedules, events, users, profiles, evalMessages, simulationAttempts, simulations, simulationChats, classes, simulationChatGrades, simulationMessages, topics, standardGroups, documents, simulationChatFeedbacks } from "./schema";

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
	evalRun: one(evalRuns, {
		fields: [evalChats.evalRunId],
		references: [evalRuns.id]
	}),
	scenario: one(scenarios, {
		fields: [evalChats.scenarioId],
		references: [scenarios.id]
	}),
	evalMessages: many(evalMessages),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	evalChatGrades: many(evalChatGrades),
	evalRuns: many(evalRuns),
	simulationChatGrades: many(simulationChatGrades),
	simulations: many(simulations),
	standardGroups: many(standardGroups),
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

export const evalRunsRelations = relations(evalRuns, ({one, many}) => ({
	evalChats: many(evalChats),
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
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	evalChats: many(evalChats),
	simulationChats: many(simulationChats),
	agent: one(agents, {
		fields: [scenarios.agentId],
		references: [agents.id]
	}),
	class: one(classes, {
		fields: [scenarios.classId],
		references: [classes.id]
	}),
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

export const profilesRelations = relations(profiles, ({one, many}) => ({
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
	simulationAttempts: many(simulationAttempts),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const evalMessagesRelations = relations(evalMessages, ({one}) => ({
	evalChat: one(evalChats, {
		fields: [evalMessages.chatId],
		references: [evalChats.id]
	}),
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

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	simulationAttempt: one(simulationAttempts, {
		fields: [simulationChats.attemptId],
		references: [simulationAttempts.id]
	}),
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
	simulationChatGrades: many(simulationChatGrades),
	simulationMessages: many(simulationMessages),
}));

export const classesRelations = relations(classes, ({many}) => ({
	scenarios: many(scenarios),
	topics: many(topics),
	documents: many(documents),
	schedules: many(schedules),
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

export const simulationMessagesRelations = relations(simulationMessages, ({one}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
}));

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	standards: many(standards),
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
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