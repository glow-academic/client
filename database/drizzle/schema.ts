import { pgTable, serial, integer, varchar, text, bigint, uuid, timestamp, foreignKey, boolean, jsonb, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const agentType = pgEnum("agent_type", ['student', 'ta'])
export const classTerm = pgEnum("class_term", ['fall', 'spring', 'summer'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus'])
export const evalMessageType = pgEnum("eval_message_type", ['query', 'response'])
export const evalType = pgEnum("eval_type", ['student', 'ta'])
export const profileRole = pgEnum("profile_role", ['admin', 'instructional', 'instructor', 'ta'])
export const rubricType = pgEnum("rubric_type", ['simulation', 'eval'])
export const seniorityLevels = pgEnum("seniority_levels", ['freshman', 'sophomore', 'junior', 'senior'])


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

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	classCode: text("class_code").notNull(),
	year: integer().notNull(),
	term: classTerm().default('fall').notNull(),
	description: text().notNull(),
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

export const sessions = pgTable("sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	sessionToken: varchar({ length: 255 }).notNull(),
});

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

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }),
	email: varchar({ length: 255 }),
	emailVerified: timestamp({ withTimezone: true, mode: 'string' }),
	image: text(),
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

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	subtitle: text().notNull(),
	description: text().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	agentType: agentType("agent_type").default('student').notNull(),
	temperature: integer().notNull(),
});

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
	rubricType: rubricType("rubric_type").default('simulation').notNull(),
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

export const appLogs = pgTable("app_logs", {
	id: serial().primaryKey().notNull(),
	level: text().notNull(),
	message: text(),
	context: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	agentId: uuid("agent_id"),
	classId: uuid("class_id"),
	crowdedness: integer(),
	intensity: integer(),
	seniority: seniorityLevels(),
	documents: uuid().array(),
}, (table) => [
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "scenarios_agent_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "scenarios_class_id_fkey"
		}).onDelete("set null"),
]);

export const simulations = pgTable("simulations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	timeLimit: integer("time_limit"),
	active: boolean().default(true).notNull(),
	scenarioIds: uuid("scenario_ids").array().default(["RAY"]).notNull(),
	rubricId: uuid("rubric_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "simulations_rubric_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationAttempts = pgTable("simulation_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profileId: uuid("profile_id"),
	simulationId: uuid("simulation_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "simulation_attempts_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.simulationId],
			foreignColumns: [simulations.id],
			name: "simulation_attempts_simulation_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationChats = pgTable("simulation_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	attemptId: uuid("attempt_id").notNull(),
	completed: boolean().default(false).notNull(),
	traceId: text("trace_id"),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "simulation_chats_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [simulationAttempts.id],
			name: "simulation_chats_attempt_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationMessages = pgTable("simulation_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	query: text().notNull(),
	response: text().notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [simulationChats.id],
			name: "simulation_messages_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationChatGrades = pgTable("simulation_chat_grades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passed: boolean().notNull(),
	score: integer().notNull(),
	timeTaken: integer("time_taken").notNull(),
	rubricId: uuid("rubric_id").notNull(),
	simulationChatId: uuid("simulation_chat_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "simulation_chat_grades_rubric_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.simulationChatId],
			foreignColumns: [simulationChats.id],
			name: "simulation_chat_grades_simulation_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const evalRuns = pgTable("eval_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	evalId: uuid("eval_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	rubricId: uuid("rubric_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.evalId],
			foreignColumns: [evals.id],
			name: "eval_runs_eval_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "eval_runs_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "eval_runs_rubric_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationChatFeedbacks = pgTable("simulation_chat_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	standardId: uuid("standard_id").notNull(),
	simulationChatGradeId: uuid("simulation_chat_grade_id").notNull(),
	total: integer().notNull(),
	feedback: text(),
}, (table) => [
	foreignKey({
			columns: [table.standardId],
			foreignColumns: [standards.id],
			name: "simulation_chat_feedbacks_standard_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.simulationChatGradeId],
			foreignColumns: [simulationChatGrades.id],
			name: "simulation_chat_feedbacks_simulation_chat_grade_id_fkey"
		}).onDelete("cascade"),
]);

export const evalChats = pgTable("eval_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	evalRunId: uuid("eval_run_id").notNull(),
	completed: boolean().default(false).notNull(),
	traceId: text("trace_id"),
}, (table) => [
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "eval_chats_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.evalRunId],
			foreignColumns: [evalRuns.id],
			name: "eval_chats_eval_run_id_fkey"
		}).onDelete("cascade"),
]);

export const evals = pgTable("evals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	baseAgentId: uuid("base_agent_id").notNull(),
	scenarioIds: uuid("scenario_ids").array().default(["RAY"]).notNull(),
	agentIds: uuid("agent_ids").array().default(["RAY"]).notNull(),
	rubricIds: uuid("rubric_ids").array().default(["RAY"]).notNull(),
	evalType: evalType("eval_type").default('student').notNull(),
	maxTurns: integer("max_turns").notNull(),
	maxParallelRuns: integer("max_parallel_runs").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.baseAgentId],
			foreignColumns: [agents.id],
			name: "evals_base_agent_id_fkey"
		}).onDelete("cascade"),
]);

export const evalMessages = pgTable("eval_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	content: text().notNull(),
	type: evalMessageType().notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [evalChats.id],
			name: "eval_messages_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const evalChatGrades = pgTable("eval_chat_grades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	passed: boolean().notNull(),
	score: integer().notNull(),
	timeTaken: integer("time_taken").notNull(),
	rubricId: uuid("rubric_id").notNull(),
	evalChatId: uuid("eval_chat_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "eval_chat_grades_rubric_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.evalChatId],
			foreignColumns: [evalChats.id],
			name: "eval_chat_grades_eval_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const evalChatFeedbacks = pgTable("eval_chat_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	standardId: uuid("standard_id").notNull(),
	evalChatGradeId: uuid("eval_chat_grade_id").notNull(),
	total: integer().notNull(),
	feedback: text(),
}, (table) => [
	foreignKey({
			columns: [table.standardId],
			foreignColumns: [standards.id],
			name: "eval_chat_feedbacks_standard_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.evalChatGradeId],
			foreignColumns: [evalChatGrades.id],
			name: "eval_chat_feedbacks_eval_chat_grade_id_fkey"
		}).onDelete("cascade"),
]);

export const verificationToken = pgTable("verification_token", {
	identifier: text().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "verification_token_pkey"}),
]);
