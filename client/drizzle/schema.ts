import { pgTable, unique, uuid, boolean, timestamp, text, integer, foreignKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const agentType = pgEnum("agent_type", ['default', 'student', 'ta'])
export const classTerm = pgEnum("class_term", ['fall', 'spring', 'summer'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus'])
export const evalType = pgEnum("eval_type", ['student', 'ta'])
export const seniorityLevels = pgEnum("seniority_levels", ['freshman', 'sophomore', 'junior', 'senior'])
export const userRole = pgEnum("user_role", ['admin', 'instructional', 'instructor', 'ta'])


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

export const classes = pgTable("classes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	classCode: text("class_code").notNull(),
	year: integer().notNull(),
	term: classTerm().default('fall').notNull(),
	description: text().notNull(),
});

export const topics = pgTable("topics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
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
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	mimeType: text("mime_type").notNull(),
	classId: uuid("class_id").notNull(),
	type: documentType().default('homework').notNull(),
	classified: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "documents_class_id_fkey"
		}).onDelete("cascade"),
]);

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
});

export const standardGroups = pgTable("standard_groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
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

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	subtitle: text().notNull(),
	description: text().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	agentType: agentType("agent_type").default('student').notNull(),
	temperature: integer().notNull(),
});

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

export const simulations = pgTable("simulations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	classId: uuid("class_id"),
	documents: uuid().array().default(["RAY"]).notNull(),
	timeLimit: integer("time_limit"),
	active: boolean().default(true).notNull(),
	scenarioIds: uuid("scenario_ids").array().default(["RAY"]).notNull(),
	rubricId: uuid("rubric_id"),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "simulations_class_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "simulations_rubric_id_fkey"
		}).onDelete("set null"),
]);

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	agentId: uuid("agent_id").notNull(),
	crowdedness: integer().notNull(),
	intensity: integer().notNull(),
	seniority: seniorityLevels().default('freshman').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "scenarios_agent_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationAttempts = pgTable("simulation_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id"),
	classId: uuid("class_id").notNull(),
	simulationId: uuid("simulation_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "simulation_attempts_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "simulation_attempts_class_id_fkey"
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
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	attemptId: uuid("attempt_id").notNull(),
	completed: boolean().default(false).notNull(),
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

export const evals = pgTable("evals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	classId: uuid("class_id"),
	baseAgentId: uuid("base_agent_id").notNull(),
	scenarioIds: uuid("scenario_ids").array().default(["RAY"]).notNull(),
	agentIds: uuid("agent_ids").array().default(["RAY"]).notNull(),
	evalType: evalType("eval_type").default('student').notNull(),
	maxTurns: integer("max_turns").notNull(),
	numParallelRuns: integer("num_parallel_runs").notNull(),
	rubricIds: uuid("rubric_ids").array().default(["RAY"]).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "evals_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.baseAgentId],
			foreignColumns: [agents.id],
			name: "evals_base_agent_id_fkey"
		}).onDelete("cascade"),
]);

export const evalRuns = pgTable("eval_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	classId: uuid("class_id").notNull(),
	evalId: uuid("eval_id").notNull(),
	queryAgentId: uuid("query_agent_id").notNull(),
	responseAgentId: uuid("response_agent_id").notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	rubricId: uuid("rubric_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "eval_runs_class_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.evalId],
			foreignColumns: [evals.id],
			name: "eval_runs_eval_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.queryAgentId],
			foreignColumns: [agents.id],
			name: "eval_runs_query_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.responseAgentId],
			foreignColumns: [agents.id],
			name: "eval_runs_response_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "eval_runs_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "eval_runs_rubric_id_fkey"
		}).onDelete("cascade"),
]);

export const evalChats = pgTable("eval_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	title: text().notNull(),
	evalRunId: uuid("eval_run_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.evalRunId],
			foreignColumns: [evalRuns.id],
			name: "eval_chats_eval_run_id_fkey"
		}).onDelete("cascade"),
]);

export const evalMessages = pgTable("eval_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	query: text().notNull(),
	response: text().notNull(),
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
