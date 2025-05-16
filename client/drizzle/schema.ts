import { pgTable, unique, uuid, boolean, timestamp, text, foreignKey, integer, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const chatProfile = pgEnum("chat_profile", ['aggressive', 'happy', 'confused'])


export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	viewedIntro: boolean("viewed_intro").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	admin: boolean().default(false).notNull(),
	username: text().notNull(),
	password: text().notNull(),
}, (table) => [
	unique("users_username_key").on(table.username),
]);

export const chats = pgTable("chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioDescription: text("scenario_description").notNull(),
	completed: boolean().default(false).notNull(),
	userId: uuid("user_id").notNull(),
	profile: chatProfile().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chats_user_id_fkey"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	query: text().notNull(),
	response: text().notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "messages_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatId: uuid("chat_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passed: boolean().notNull(),
	score: integer().notNull(),
	timeTaken: integer("time_taken").notNull(),
	adaptability: integer().notNull(),
	adaptabilityFeedback: text("adaptability_feedback"),
	listening: integer().notNull(),
	listeningFeedback: text("listening_feedback"),
	objectives: integer().notNull(),
	objectivesFeedback: text("objectives_feedback"),
	timeManagement: integer("time_management").notNull(),
	timeManagementFeedback: text("time_management_feedback"),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [chats.id],
			name: "rubrics_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	mimeType: text("mime_type").notNull(),
	profile: chatProfile().notNull(),
});
