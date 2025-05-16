import { relations } from "drizzle-orm/relations";
import { users, chats, messages, rubrics } from "./schema";

export const chatsRelations = relations(chats, ({one, many}) => ({
	user: one(users, {
		fields: [chats.userId],
		references: [users.id]
	}),
	messages: many(messages),
	rubrics: many(rubrics),
}));

export const usersRelations = relations(users, ({many}) => ({
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