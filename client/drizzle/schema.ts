import { pgTable, uuid, timestamp, text, foreignKey, integer, boolean, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab'])
export const seniorityLevels = pgEnum("seniority_levels", ['freshman', 'sophmore', 'junior', 'senior'])
export const userRole = pgEnum("user_role", ['admin', 'instructional', 'instructor', 'ta', 'guest'])


export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	classCode: text("class_code").notNull(),
	description: text().notNull(),
	profileIds: uuid("profile_ids").array().default(["RAY"]).notNull(),
});

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	mimeType: text("mime_type").notNull(),
	classId: uuid("class_id").notNull(),
	type: documentType().default('homework').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "documents_class_id_fkey"
		}).onDelete("cascade"),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	subtitle: text().notNull(),
	description: text().notNull(),
	threshold: integer().notNull(),
});

export const templates = pgTable("templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profileId: uuid("profile_id").notNull(),
	crowdedness: integer().notNull(),
	intensity: integer().notNull(),
	seniority: seniorityLevels().default('freshman').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "templates_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const quizzes = pgTable("quizzes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	classId: uuid("class_id").notNull(),
	documents: uuid().array().default(["RAY"]).notNull(),
	timeLimit: integer("time_limit").notNull(),
	userId: uuid("user_id").notNull(),
	active: boolean().default(true).notNull(),
	templateIds: uuid("template_ids").array().default(["RAY"]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "quizzes_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "quizzes_user_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	viewedIntro: boolean("viewed_intro").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	role: userRole().default('guest').notNull(),
	name: text().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	classIds: uuid("class_ids").array().default(["RAY"]).notNull(),
}, (table) => [
	unique("users_username_key").on(table.username),
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

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
});

export const chats = pgTable("chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	completed: boolean().default(false).notNull(),
	userId: uuid("user_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	classId: uuid("class_id").notNull(),
	quizId: uuid("quiz_id"),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "chats_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chats_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "chats_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "chats_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quizzes.id],
			name: "chats_quiz_id_fkey"
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
