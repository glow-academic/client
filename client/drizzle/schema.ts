import { pgTable, uuid, timestamp, text, integer, foreignKey, unique, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const classTerm = pgEnum("class_term", ['fall', 'spring', 'summer'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'syllabus'])
export const seniorityLevels = pgEnum("seniority_levels", ['freshman', 'sophomore', 'junior', 'senior'])
export const userRole = pgEnum("user_role", ['admin', 'instructional', 'instructor', 'ta'])


export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	subtitle: text().notNull(),
	description: text().notNull(),
	threshold: integer().notNull(),
});

export const chatTemplates = pgTable("chat_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profileId: uuid("profile_id"),
	scenarioId: uuid("scenario_id"),
	crowdedness: integer().notNull(),
	intensity: integer().notNull(),
	seniority: seniorityLevels().default('freshman').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "chat_templates_profile_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "chat_templates_scenario_id_fkey"
		}).onDelete("set null"),
]);

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
});

export const schedules = pgTable("schedules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
});

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	classCode: text("class_code").notNull(),
	year: integer().notNull(),
	term: classTerm().default('fall').notNull(),
	description: text().notNull(),
	templateIds: uuid("template_ids").array().default(["RAY"]).notNull(),
	syllabusId: uuid("syllabus_id"),
	scheduleId: uuid("schedule_id"),
}, (table) => [
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [schedules.id],
			name: "classes_schedule_id_fkey"
		}).onDelete("set null"),
]);

export const prerequisites = pgTable("prerequisites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	classId: uuid("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "prerequisites_class_id_fkey"
		}).onDelete("cascade"),
]);

export const topics = pgTable("topics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	classId: uuid("class_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "topics_class_id_fkey"
		}).onDelete("cascade"),
]);

export const deadlines = pgTable("deadlines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	documentType: documentType("document_type").default('homework').notNull(),
	dueTime: timestamp("due_time", { withTimezone: true, mode: 'string' }).notNull(),
	scheduleId: uuid("schedule_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.scheduleId],
			foreignColumns: [schedules.id],
			name: "deadlines_schedule_id_fkey"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	viewedIntro: boolean("viewed_intro").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	role: userRole().default('ta').notNull(),
	name: text().notNull(),
	username: text().notNull(),
	password: text().notNull(),
	classIds: uuid("class_ids").array().default(["RAY"]).notNull(),
}, (table) => [
	unique("users_username_key").on(table.username),
]);

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

export const attempts = pgTable("attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id"),
	classId: uuid("class_id").notNull(),
	templateId: uuid("template_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "attempts_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "attempts_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [templates.id],
			name: "attempts_template_id_fkey"
		}).onDelete("cascade"),
]);

export const templates = pgTable("templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	documents: uuid().array().default(["RAY"]).notNull(),
	timeLimit: integer("time_limit").notNull(),
	active: boolean().default(true).notNull(),
	chatTemplateIds: uuid("chat_template_ids").array().default(["RAY"]).notNull(),
});

export const chats = pgTable("chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	chatTemplateId: uuid("chat_template_id").notNull(),
	completed: boolean().default(false).notNull(),
	attemptId: uuid("attempt_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "chats_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "chats_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatTemplateId],
			foreignColumns: [chatTemplates.id],
			name: "chats_chat_template_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [attempts.id],
			name: "chats_attempt_id_fkey"
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
