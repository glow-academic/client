import { relations } from "drizzle-orm/relations";
import { users, chats, classes, quizzes, documents, messages, rubrics, quizAttempts } from "./schema";

export const chatsRelations = relations(chats, ({one, many}) => ({
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	}),
	class: one(classes, {
		fields: [chats.classId],
		references: [classes.id]
	}),
	messages: many(messages),
	rubrics: many(rubrics),
}));

export const usersRelations = relations(users, ({many}) => ({
	chats: many(chats),
	quizzes: many(quizzes),
	quizAttempts: many(quizAttempts),
}));

export const classesRelations = relations(classes, ({many}) => ({
	chats: many(chats),
	quizzes: many(quizzes),
	documents: many(documents),
}));

export const quizzesRelations = relations(quizzes, ({one, many}) => ({
	class: one(classes, {
		fields: [quizzes.classId],
		references: [classes.id]
	}),
	document: one(documents, {
		fields: [quizzes.documentId],
		references: [documents.id]
	}),
	user: one(users, {
		fields: [quizzes.creatorId],
		references: [users.id]
	}),
	quizAttempts: many(quizAttempts),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	quizzes: many(quizzes),
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
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

export const quizAttemptsRelations = relations(quizAttempts, ({one}) => ({
	quiz: one(quizzes, {
		fields: [quizAttempts.quizId],
		references: [quizzes.id]
	}),
	user: one(users, {
		fields: [quizAttempts.userId],
		references: [users.id]
	}),
}));