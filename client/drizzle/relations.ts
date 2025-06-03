import { relations } from "drizzle-orm/relations";
import { schedules, deadlines, classes, topics, prerequisites, documents, profiles, templates, quizzes, users, scenarios, chats, messages, rubrics } from "./schema";

export const deadlinesRelations = relations(deadlines, ({one}) => ({
	schedule: one(schedules, {
		fields: [deadlines.scheduleId],
		references: [schedules.id]
	}),
}));

export const schedulesRelations = relations(schedules, ({many}) => ({
	deadlines: many(deadlines),
	classes: many(classes),
}));

export const classesRelations = relations(classes, ({one, many}) => ({
	schedule: one(schedules, {
		fields: [classes.scheduleId],
		references: [schedules.id]
	}),
	topics: many(topics),
	prerequisites: many(prerequisites),
	documents: many(documents),
	quizzes: many(quizzes),
	chats: many(chats),
}));

export const topicsRelations = relations(topics, ({one}) => ({
	class: one(classes, {
		fields: [topics.classId],
		references: [classes.id]
	}),
}));

export const prerequisitesRelations = relations(prerequisites, ({one}) => ({
	class: one(classes, {
		fields: [prerequisites.classId],
		references: [classes.id]
	}),
}));

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const templatesRelations = relations(templates, ({one}) => ({
	profile: one(profiles, {
		fields: [templates.profileId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	templates: many(templates),
	chats: many(chats),
}));

export const quizzesRelations = relations(quizzes, ({one, many}) => ({
	class: one(classes, {
		fields: [quizzes.classId],
		references: [classes.id]
	}),
	user: one(users, {
		fields: [quizzes.userId],
		references: [users.id]
	}),
	chats: many(chats),
}));

export const usersRelations = relations(users, ({many}) => ({
	quizzes: many(quizzes),
	chats: many(chats),
}));

export const chatsRelations = relations(chats, ({one, many}) => ({
	scenario: one(scenarios, {
		fields: [chats.scenarioId],
		references: [scenarios.id]
	}),
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	}),
	profile: one(profiles, {
		fields: [chats.profileId],
		references: [profiles.id]
	}),
	class: one(classes, {
		fields: [chats.classId],
		references: [classes.id]
	}),
	quiz: one(quizzes, {
		fields: [chats.quizId],
		references: [quizzes.id]
	}),
	messages: many(messages),
	rubrics: many(rubrics),
}));

export const scenariosRelations = relations(scenarios, ({many}) => ({
	chats: many(chats),
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