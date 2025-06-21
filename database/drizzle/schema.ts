import { pgTable, serial, integer, varchar, text, bigint, jsonb, timestamp, foreignKey, uuid, boolean, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const assistantMessageType = pgEnum("assistant_message_type", ['user', 'assistant'])
export const assistantToolType = pgEnum("assistant_tool_type", ['create', 'read', 'update', 'delete'])
export const classTerm = pgEnum("class_term", ['fall', 'spring', 'summer'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus'])
export const profileRole = pgEnum("profile_role", ['admin', 'instructional', 'instructor', 'ta'])


export const accounts = pgTable("accounts", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	type: varchar({ length: 255 }).notNull(),
	provider: varchar({ length: 255 }).notNull(),
	providerAccountId: varchar({ length: 255 }).notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	expiresAt: bigint("expires_at", { mode: "number" }),
	idToken: text("id_token"),
	scope: text(),
	sessionState: text("session_state"),
	tokenType: text("token_type"),
});

export const appLogs = pgTable("app_logs", {
	id: serial().primaryKey().notNull(),
	level: text().notNull(),
	message: text(),
	context: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const topics = pgTable("topics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	prerequisite: boolean().default(false).notNull(),
	classId: uuid("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "topics_class_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }),
	email: varchar({ length: 255 }),
	emailVerified: timestamp({ withTimezone: true, mode: 'string' }),
	image: text(),
});

export const standardGroups = pgTable("standard_groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	shortName: text("short_name").notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
	rubricId: uuid("rubric_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "standard_groups_rubric_id_fkey"
		}).onDelete("cascade"),
]);

export const migrations = pgTable("migrations", {
	id: serial().primaryKey().notNull(),
	hash: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
});

export const components = pgTable("components", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	fileName: text("file_name").notNull(),
	layout: jsonb().default({}).notNull(),
	defaultComponent: boolean("default_component").default(false).notNull(),
	stat: boolean().default(false).notNull(),
});

export const assistantToolCalls = pgTable("assistant_tool_calls", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	messageId: uuid("message_id").notNull(),
	toolName: text("tool_name").notNull(),
	toolType: assistantToolType("tool_type").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [assistantChats.id],
			name: "assistant_tool_calls_chat_id_fkey"
		}),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [assistantMessages.id],
			name: "assistant_tool_calls_message_id_fkey"
		}),
]);

export const assistantMessages = pgTable("assistant_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	role: assistantMessageType().notNull(),
	content: text().notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [assistantChats.id],
			name: "assistant_messages_chat_id_fkey"
		}),
]);

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	classCode: text("class_code").notNull(),
	year: integer().notNull(),
	term: classTerm().default('fall').notNull(),
	description: text().notNull(),
	defaultClass: boolean("default_class").default(false).notNull(),
});

export const schedules = pgTable("schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	classId: uuid("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "schedules_class_id_fkey"
		}).onDelete("cascade"),
]);

export const events = pgTable("events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	documentType: documentType("document_type"),
	time: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	scheduleId: uuid("schedule_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [schedules.id],
			name: "events_schedule_id_fkey"
		}).onDelete("cascade"),
]);

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
	defaultRubric: boolean("default_rubric").default(false).notNull(),
});

export const models = pgTable("models", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	providerId: uuid("provider_id").notNull(),
	active: boolean().default(true).notNull(),
});

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	mimeType: text("mime_type").notNull(),
	classId: uuid("class_id").notNull(),
	type: documentType().default('homework').notNull(),
	classified: boolean().default(false).notNull(),
	fileId: text("file_id"),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "documents_class_id_fkey"
		}).onDelete("cascade"),
]);

export const providers = pgTable("providers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	apiKey: text("api_key").notNull(),
});

export const sessions = pgTable("sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	sessionToken: varchar({ length: 255 }).notNull(),
});

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: integer("user_id"),
	lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	alias: text().notNull(),
	viewedIntro: boolean("viewed_intro").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	role: profileRole().default('ta').notNull(),
	classIds: uuid("class_ids").array().default(["RAY"]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_user_id_fkey"
		}).onDelete("cascade"),
]);

export const standards = pgTable("standards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	standardGroupId: uuid("standard_group_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.standardGroupId],
			foreignColumns: [standardGroups.id],
			name: "standards_standard_group_id_fkey"
		}).onDelete("cascade"),
]);

export const assistantChats = pgTable("assistant_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	profileId: uuid("profile_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "assistant_chats_profile_id_fkey"
		}),
]);

export const verificationToken = pgTable("verification_token", {
	identifier: text().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "verification_token_pkey"}),
]);
