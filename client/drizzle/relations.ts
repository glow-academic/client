import { relations } from "drizzle-orm/relations";
import { classes, topics, schedules, events, documents, rubrics, standardGroups, standards, rubricGrades, standardGrades, agents, scenarios, simulations, users, attempts, simulationChats, simulationMessages, evals, evalRuns, evalChats, evalMessages } from "./schema";

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
	simulations: many(simulations),
	attempts: many(attempts),
	evals: many(evals),
	evalRuns: many(evalRuns),
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

export const standardGroupsRelations = relations(standardGroups, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [standardGroups.rubricId],
		references: [rubrics.id]
	}),
	standards: many(standards),
}));

export const rubricsRelations = relations(rubrics, ({many}) => ({
	standardGroups: many(standardGroups),
	rubricGrades: many(rubricGrades),
	simulations: many(simulations),
	evalRuns: many(evalRuns),
}));

export const standardsRelations = relations(standards, ({one, many}) => ({
	standardGroup: one(standardGroups, {
		fields: [standards.standardGroupId],
		references: [standardGroups.id]
	}),
	standardGrades: many(standardGrades),
}));

export const rubricGradesRelations = relations(rubricGrades, ({one, many}) => ({
	rubric: one(rubrics, {
		fields: [rubricGrades.rubricId],
		references: [rubrics.id]
	}),
	standardGrades: many(standardGrades),
}));

export const standardGradesRelations = relations(standardGrades, ({one}) => ({
	standard: one(standards, {
		fields: [standardGrades.standardId],
		references: [standards.id]
	}),
	rubricGrade: one(rubricGrades, {
		fields: [standardGrades.rubricGradeId],
		references: [rubricGrades.id]
	}),
}));

export const scenariosRelations = relations(scenarios, ({one, many}) => ({
	agent: one(agents, {
		fields: [scenarios.agentId],
		references: [agents.id]
	}),
	simulationChats: many(simulationChats),
	evalRuns: many(evalRuns),
}));

export const agentsRelations = relations(agents, ({many}) => ({
	scenarios: many(scenarios),
	evals: many(evals),
	evalRuns_queryAgentId: many(evalRuns, {
		relationName: "evalRuns_queryAgentId_agents_id"
	}),
	evalRuns_responseAgentId: many(evalRuns, {
		relationName: "evalRuns_responseAgentId_agents_id"
	}),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	class: one(classes, {
		fields: [simulations.classId],
		references: [classes.id]
	}),
	rubric: one(rubrics, {
		fields: [simulations.rubricId],
		references: [rubrics.id]
	}),
	attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({one, many}) => ({
	user: one(users, {
		fields: [attempts.userId],
		references: [users.id]
	}),
	class: one(classes, {
		fields: [attempts.classId],
		references: [classes.id]
	}),
	simulation: one(simulations, {
		fields: [attempts.simulationId],
		references: [simulations.id]
	}),
	simulationChats: many(simulationChats),
}));

export const usersRelations = relations(users, ({many}) => ({
	attempts: many(attempts),
	simulationChats: many(simulationChats),
}));

export const simulationChatsRelations = relations(simulationChats, ({one, many}) => ({
	user: one(users, {
		fields: [simulationChats.userId],
		references: [users.id]
	}),
	scenario: one(scenarios, {
		fields: [simulationChats.scenarioId],
		references: [scenarios.id]
	}),
	attempt: one(attempts, {
		fields: [simulationChats.attemptId],
		references: [attempts.id]
	}),
	simulationMessages: many(simulationMessages),
}));

export const simulationMessagesRelations = relations(simulationMessages, ({one}) => ({
	simulationChat: one(simulationChats, {
		fields: [simulationMessages.chatId],
		references: [simulationChats.id]
	}),
}));

export const evalsRelations = relations(evals, ({one, many}) => ({
	class: one(classes, {
		fields: [evals.classId],
		references: [classes.id]
	}),
	agent: one(agents, {
		fields: [evals.baseAgentId],
		references: [agents.id]
	}),
	evalRuns: many(evalRuns),
}));

export const evalRunsRelations = relations(evalRuns, ({one, many}) => ({
	class: one(classes, {
		fields: [evalRuns.classId],
		references: [classes.id]
	}),
	eval: one(evals, {
		fields: [evalRuns.evalId],
		references: [evals.id]
	}),
	agent_queryAgentId: one(agents, {
		fields: [evalRuns.queryAgentId],
		references: [agents.id],
		relationName: "evalRuns_queryAgentId_agents_id"
	}),
	agent_responseAgentId: one(agents, {
		fields: [evalRuns.responseAgentId],
		references: [agents.id],
		relationName: "evalRuns_responseAgentId_agents_id"
	}),
	scenario: one(scenarios, {
		fields: [evalRuns.scenarioId],
		references: [scenarios.id]
	}),
	rubric: one(rubrics, {
		fields: [evalRuns.rubricId],
		references: [rubrics.id]
	}),
	evalChats: many(evalChats),
}));

export const evalChatsRelations = relations(evalChats, ({one, many}) => ({
	evalRun: one(evalRuns, {
		fields: [evalChats.evalRunId],
		references: [evalRuns.id]
	}),
	evalMessages: many(evalMessages),
}));

export const evalMessagesRelations = relations(evalMessages, ({one}) => ({
	evalChat: one(evalChats, {
		fields: [evalMessages.chatId],
		references: [evalChats.id]
	}),
}));