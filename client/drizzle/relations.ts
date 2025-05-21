import { relations } from "drizzle-orm/relations";
import { users, chats, classes, messages, rubrics, documents } from "./schema";

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
}));

export const classesRelations = relations(classes, ({many}) => ({
	chats: many(chats),
	documents: many(documents),
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

export const documentsRelations = relations(documents, ({one}) => ({
	class: one(classes, {
		fields: [documents.classId],
		references: [classes.id]
	}),
}));