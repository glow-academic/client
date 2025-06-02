import { relations } from "drizzle-orm/relations";
import { classes, documents, profiles, templates, quizzes, users, chats, messages, scenarios, rubrics } from "./schema";

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	documents: many(documents),
	quizzes: many(quizzes),
	chats: many(chats),
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
	rubrics: many(rubrics),
}));

export const scenariosRelations = relations(scenarios, ({many}) => ({
	chats: many(chats),
}));

export const rubricsRelations = relations(rubrics, ({one}) => ({
	chat: one(chats, {
		fields: [rubrics.chatId],
		references: [chats.id]
	}),
}));