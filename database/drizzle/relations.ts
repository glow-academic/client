import { relations } from "drizzle-orm/relations";
import { evalChats, evalMessages, profiles, simulationAttempts, simulations, simulationChats, simulationMessages, simulationChatGrades, simulationChatFeedbacks, standards, rubrics, schedules, events, classes, documents, evalChatGrades, evalChatFeedbacks, agents, evalRuns, evals, users, scenarios, standardGroups, topics } from "./schema";

export const evalMessagesRelations = relations(evalMessages, ({one}) => ({
	evalChat: one(evalChats, {
		fields: [evalMessages.chatId],
		references: [evalChats.id]
	}),
}));

export const evalChatsRelations = relations(evalChats, ({one, many}) => ({
	evalMessages: many(evalMessages),
	evalChatGrades: many(evalChatGrades),
	evalRun: one(evalRuns, {
		fields: [evalChats.evalRunId],
		references: [evalRuns.id]
	}),
	scenario: one(scenarios, {
		fields: [evalChats.scenarioId],
		references: [scenarios.id]
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

export const profilesRelations = relations(profiles, ({one, many}) => ({
	simulationAttempts: many(simulationAttempts),
	user: one(users, {
		fields: [profiles.userId],
		references: [users.id]
	}),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	simulationAttempts: many(simulationAttempts),
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
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
	evalChatFeedbacks: many(evalChatFeedbacks),
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	simulations: many(simulations),
	evalRuns: many(evalRuns),
	evalChatGrades: many(evalChatGrades),
	simulationChatGrades: many(simulationChatGrades),
	standardGroups: many(standardGroups),
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

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	documents: many(documents),
	schedules: many(schedules),
	scenarios: many(scenarios),
	topics: many(topics),
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

export const evalChatGradesRelations = relations(evalChatGrades, ({one, many}) => ({
	evalChatFeedbacks: many(evalChatFeedbacks),
	evalChat: one(evalChats, {
		fields: [evalChatGrades.evalChatId],
		references: [evalChats.id]
	}),
	rubric: one(rubrics, {
		fields: [evalChatGrades.rubricId],
		references: [rubrics.id]
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

export const agentsRelations = relations(agents, ({many}) => ({
	evalRuns: many(evalRuns),
	evals: many(evals),
	scenarios: many(scenarios),
}));

export const evalsRelations = relations(evals, ({one, many}) => ({
	evalRuns: many(evalRuns),
	agent: one(agents, {
		fields: [evals.baseAgentId],
		references: [agents.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	profiles: many(profiles),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	evalChats: many(evalChats),
	agent: one(agents, {
		fields: [scenarios.agentId],
		references: [agents.id]
	}),
	class: one(classes, {
		fields: [scenarios.classId],
		references: [classes.id]
	}),
	simulationChats: many(simulationChats),
}));

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
	standards: many(standards),
}));

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));