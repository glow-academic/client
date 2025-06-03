import { relations } from "drizzle-orm/relations";
import { profiles, chatTemplates, scenarios, schedules, classes, prerequisites, topics, deadlines, documents, users, attempts, templates, chats, messages, rubrics } from "./schema";

export const chatTemplatesRelations = relations(chatTemplates, ({one, many}) => ({
	profile: one(profiles, {
		fields: [chatTemplates.profileId],
		references: [profiles.id]
	}),
	scenario: one(scenarios, {
		fields: [chatTemplates.scenarioId],
		references: [scenarios.id]
	}),
	chats: many(chats),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	chatTemplates: many(chatTemplates),
	chats: many(chats),
}));

export const scenariosRelations = relations(scenarios, ({many}) => ({
	chatTemplates: many(chatTemplates),
	chats: many(chats),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
	schedule: one(schedules, {
		fields: [classes.scheduleId],
		references: [schedules.id]
	}),
	prerequisites: many(prerequisites),
	topics: many(topics),
	documents: many(documents),
	attempts: many(attempts),
}));

export const schedulesRelations = relations(schedules, ({many}) => ({
	classes: many(classes),
	deadlines: many(deadlines),
}));

export const prerequisitesRelations = relations(prerequisites, ({one}) => ({
	class: one(classes, {
		fields: [prerequisites.classId],
		references: [classes.id]
	}),
}));

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const deadlinesRelations = relations(deadlines, ({one}) => ({
	schedule: one(schedules, {
		fields: [deadlines.scheduleId],
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
	template: one(templates, {
		fields: [attempts.templateId],
		references: [templates.id]
	}),
	chats: many(chats),
}));

export const usersRelations = relations(users, ({many}) => ({
	attempts: many(attempts),
}));

export const templatesRelations = relations(templates, ({many}) => ({
	attempts: many(attempts),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	scenario: one(scenarios, {
		fields: [chats.scenarioId],
		references: [scenarios.id]
	}),
	profile: one(profiles, {
		fields: [chats.profileId],
		references: [profiles.id]
	}),
	chatTemplate: one(chatTemplates, {
		fields: [chats.chatTemplateId],
		references: [chatTemplates.id]
	}),
	attempt: one(attempts, {
		fields: [chats.attemptId],
		references: [attempts.id]
	}),
	messages: many(messages),
	rubrics: many(rubrics),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	chat: one(chats, {
		fields: [messages.chatId],
		references: [chats.id]
	}),
}));

export const rubricsRelations = relations(rubrics, ({one}) => ({
	chat: one(chats, {
		fields: [rubrics.chatId],
		references: [chats.id]
	}),
}));