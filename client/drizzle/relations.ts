import { relations } from "drizzle-orm/relations";
import { agents, interactions, scenarios, classes, simulations, topics, schedules, events, documents, users, attempts, chats, messages, rubrics } from "./schema";

export const interactionsRelations = relations(interactions, ({one, many}) => ({
	agent: one(agents, {
		fields: [interactions.agentId],
		references: [agents.id]
	}),
	scenario: one(scenarios, {
		fields: [interactions.scenarioId],
		references: [scenarios.id]
	}),
	chats: many(chats),
}));

export const agentsRelations = relations(agents, ({many}) => ({
	interactions: many(interactions),
	chats: many(chats),
}));

export const scenariosRelations = relations(scenarios, ({many}) => ({
	interactions: many(interactions),
	chats: many(chats),
}));

export const simulationsRelations = relations(simulations, ({one, many}) => ({
	class: one(classes, {
		fields: [simulations.classId],
		references: [classes.id]
	}),
	attempts: many(attempts),
}));

export const classesRelations = relations(classes, ({many}) => ({
	simulations: many(simulations),
	topics: many(topics),
	schedules: many(schedules),
	documents: many(documents),
	attempts: many(attempts),
}));

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
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
	chats: many(chats),
}));

export const usersRelations = relations(users, ({many}) => ({
	attempts: many(attempts),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id]
	}),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	messages: many(messages),
	scenario: one(scenarios, {
		fields: [chats.scenarioId],
		references: [scenarios.id]
	}),
	agent: one(agents, {
		fields: [chats.agentId],
		references: [agents.id]
	}),
	interaction: one(interactions, {
		fields: [chats.interactionId],
		references: [interactions.id]
	}),
	attempt: one(attempts, {
		fields: [chats.attemptId],
		references: [attempts.id]
	}),
	rubrics: many(rubrics),
}));

export const rubricsRelations = relations(rubrics, ({one}) => ({
	chat: one(chats, {
		fields: [rubrics.chatId],
		references: [chats.id]
	}),
}));