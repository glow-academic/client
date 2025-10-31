import { pgTable, uuid, timestamp, text, uniqueIndex, boolean, foreignKey, doublePrecision, index, check, integer, serial, jsonb, real, primaryKey, pgMaterializedView, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const agentRole = pgEnum("agent_role", ['assistant', 'classify', 'grade', 'hint', 'input_guardrail', 'output_guardrail', 'scenario', 'title'])
export const assistantMessageType = pgEnum("assistant_message_type", ['user', 'assistant'])
export const assistantToolType = pgEnum("assistant_tool_type", ['create', 'read', 'update', 'delete'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus'])
export const feedbackType = pgEnum("feedback_type", ['feature', 'bug', 'question', 'other'])
export const profileRole = pgEnum("profile_role", ['superadmin', 'admin', 'instructional', 'ta', 'guest'])
export const reasoningEffort = pgEnum("reasoning_effort", ['none', 'minimal', 'low', 'medium', 'high'])
export const simulationMessageType = pgEnum("simulation_message_type", ['query', 'response'])


export const providers = pgTable("providers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	apiKey: text("api_key").notNull(),
});

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastLogin: timestamp("last_login", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	alias: text().notNull(),
	viewedIntro: boolean("viewed_intro").default(false).notNull(),
	viewedChat: boolean("viewed_chat").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	role: profileRole().default('guest').notNull(),
	defaultProfile: boolean("default_profile").default(false).notNull(),
	active: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("profiles_alias_unique").using("btree", table.alias.asc().nullsLast().op("text_ops")),
]);

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	active: boolean().default(true).notNull(),
});

export const models = pgTable("models", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	providerId: uuid("provider_id").notNull(),
	active: boolean().default(true).notNull(),
	inputPpm: doublePrecision("input_ppm").default(0).notNull(),
	outputPpm: doublePrecision("output_ppm").default(0).notNull(),
	customModel: boolean("custom_model").default(false).notNull(),
	imageModel: boolean("image_model").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "models_provider_id_fkey"
		}).onDelete("cascade"),
]);

export const profileRequestLimits = pgTable("profile_request_limits", {
	profileId: uuid("profile_id").primaryKey().notNull(),
	requestsPerDay: integer("requests_per_day").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("profile_request_limits_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "profile_request_limits_profile_id_fkey"
		}).onDelete("cascade"),
	check("profile_request_limits_requests_per_day_check", sql`requests_per_day > 0`),
]);

export const profileActivity = pgTable("profile_activity", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	lastActive: timestamp("last_active", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("profile_activity_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("profile_activity_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	index("profile_activity_profile_id_last_active_idx").using("btree", table.profileId.asc().nullsLast().op("timestamptz_ops"), table.lastActive.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "profile_activity_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const providerEndpoints = pgTable("provider_endpoints", {
	providerId: uuid("provider_id").primaryKey().notNull(),
	baseUrl: text("base_url").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("provider_endpoints_provider_id_idx").using("btree", table.providerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "provider_endpoints_provider_id_fkey"
		}).onDelete("cascade"),
	check("provider_endpoints_base_url_check", sql`base_url <> ''::text`),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	filePath: text("file_path").notNull(),
	mimeType: text("mime_type").notNull(),
	type: documentType().default('homework').notNull(),
	classified: boolean().default(false).notNull(),
	active: boolean().default(true).notNull(),
});

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	index("rubrics_id_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
]);

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
	index("standard_groups_id_rubric_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.rubricId.asc().nullsLast().op("uuid_ops")),
	index("standard_groups_rubric_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.rubricId.asc().nullsLast().op("uuid_ops")),
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
	index("standards_group_idx").using("btree", table.standardGroupId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.standardGroupId],
			foreignColumns: [standardGroups.id],
			name: "standards_standard_group_id_fkey"
		}).onDelete("cascade"),
]);

export const appLogs = pgTable("app_logs", {
	id: serial().primaryKey().notNull(),
	event: text().default('default.event').notNull(),
	level: text().default('info').notNull(),
	message: text().default('Default Message').notNull(),
	correlationId: text("correlation_id").default('default.correlation').notNull(),
	actor: jsonb().default({"userId":null,"profileId":null}).notNull(),
	subject: jsonb().default({"entityId":null,"entityType":null}).notNull(),
	context: jsonb().default({"route":null,"function":null,"component":null}).notNull(),
	error: jsonb().default({"code":null,"name":null,"stack":null,"message":null}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const assistantChats = pgTable("assistant_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	profileId: uuid("profile_id").notNull(),
	traceId: text("trace_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "assistant_chats_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const appFeedback = pgTable("app_feedback", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	type: feedbackType().notNull(),
	message: text().default('No message provided').notNull(),
});

export const prompts = pgTable("prompts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	systemPrompt: text("system_prompt").notNull(),
}, (table) => [
	index("prompts_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
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
		}).onDelete("cascade"),
]);

export const assistantToolCalls = pgTable("assistant_tool_calls", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	toolName: text("tool_name").notNull(),
	toolType: assistantToolType("tool_type").notNull(),
	toolArguments: jsonb("tool_arguments").notNull(),
	toolResult: jsonb("tool_result").notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [assistantChats.id],
			name: "assistant_tool_calls_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const personas = pgTable("personas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	temperature: real().notNull(),
	color: text().notNull(),
	icon: text().notNull(),
	modelId: uuid("model_id").notNull(),
	reasoning: reasoningEffort().default('none').notNull(),
	active: boolean().default(false).notNull(),
}, (table) => [
	index("personas_id_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "personas_model_id_fkey"
		}).onDelete("restrict"),
]);

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	temperature: real().notNull(),
	modelId: uuid("model_id").notNull(),
	reasoning: reasoningEffort().default('medium').notNull(),
	role: agentRole().default('assistant').notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "agents_model_id_fkey"
		}).onDelete("restrict"),
]);

export const modelRuns = pgTable("model_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	inputTokens: integer("input_tokens").default(0).notNull(),
	outputTokens: integer("output_tokens").default(0).notNull(),
});

export const debugInfo = pgTable("debug_info", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modelRunId: uuid("model_run_id").notNull(),
	content: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelRunId],
			foreignColumns: [modelRuns.id],
			name: "debug_info_model_run_id_fkey"
		}),
]);

export const parameters = pgTable("parameters", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	numerical: boolean().default(false).notNull(),
	active: boolean().default(false).notNull(),
	practiceParameter: boolean("practice_parameter").default(false).notNull(),
	documentParameter: boolean("document_parameter").default(false).notNull(),
});

export const parameterItems = pgTable("parameter_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	value: text().notNull(),
	parameterId: uuid("parameter_id").notNull(),
	defaultItem: boolean("default_item").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parameterId],
			foreignColumns: [parameters.id],
			name: "parameter_items_parameter_id_fkey"
		}).onDelete("cascade"),
]);

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	useDocuments: boolean("use_documents").default(false).notNull(),
	generated: boolean().default(false).notNull(),
	active: boolean().default(true).notNull(),
	hintsEnabled: boolean("hints_enabled").default(false).notNull(),
	objectivesEnabled: boolean("objectives_enabled").default(true).notNull(),
	imageInputEnabled: boolean("image_input_enabled").default(false).notNull(),
	inputGuardrailEnabled: boolean("input_guardrail_enabled").default(false).notNull(),
	outputGuardrailEnabled: boolean("output_guardrail_enabled").default(false).notNull(),
}, (table) => [
	index("scenarios_id_active_idx").using("btree", table.id.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("bool_ops")),
]);

export const scenarioProblemStatements = pgTable("scenario_problem_statements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	problemStatement: text("problem_statement").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("scenario_problem_statements_one_active_per_scenario").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")).where(sql`active`),
	index("scenario_problem_statements_scenario_id_active_idx").using("btree", table.scenarioId.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("bool_ops")),
	index("scenario_problem_statements_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_problem_statements_scenario_id_fkey"
		}).onDelete("cascade"),
]);

export const simulations = pgTable("simulations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text().default('No description provided').notNull(),
	active: boolean().default(true).notNull(),
	rubricId: uuid("rubric_id").notNull(),
	practiceSimulation: boolean("practice_simulation").default(false).notNull(),
}, (table) => [
	index("simulations_id_active_idx").using("btree", table.id.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "simulations_rubric_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationTimeLimits = pgTable("simulation_time_limits", {
	simulationId: uuid("simulation_id").primaryKey().notNull(),
	timeLimitSeconds: integer("time_limit_seconds").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("simulation_time_limits_simulation_id_idx").using("btree", table.simulationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.simulationId],
			foreignColumns: [simulations.id],
			name: "simulation_time_limits_simulation_id_fkey"
		}).onDelete("cascade"),
	check("simulation_time_limits_time_limit_seconds_check", sql`time_limit_seconds > 0`),
]);

export const simulationAttempts = pgTable("simulation_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	simulationId: uuid("simulation_id").notNull(),
	infiniteMode: boolean("infinite_mode").default(false).notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("simulation_attempts_archived_idx").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
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
	title: text().notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	attemptId: uuid("attempt_id").notNull(),
	completed: boolean().default(false).notNull(),
	traceId: text("trace_id").notNull(),
}, (table) => [
	index("simulation_chats_id_created_idx").using("btree", table.id.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
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

export const simulationChatGrades = pgTable("simulation_chat_grades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	description: text().default('No description provided').notNull(),
	passed: boolean().notNull(),
	score: integer().notNull(),
	timeTaken: integer("time_taken").notNull(),
	rubricId: uuid("rubric_id").notNull(),
	simulationChatId: uuid("simulation_chat_id").notNull(),
}, (table) => [
	index("scg_chat_created_idx").using("btree", table.simulationChatId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("scg_chat_rubric_created_idx").using("btree", table.simulationChatId.asc().nullsLast().op("uuid_ops"), table.rubricId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("simulation_chat_grades_latest_idx").using("btree", table.simulationChatId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
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

export const simulationMessages = pgTable("simulation_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chatId: uuid("chat_id").notNull(),
	content: text().notNull(),
	type: simulationMessageType().notNull(),
	completed: boolean().default(false).notNull(),
}, (table) => [
	index("simulation_messages_chat_created_type_idx").using("btree", table.chatId.asc().nullsLast().op("enum_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops"), table.type.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.chatId],
			foreignColumns: [simulationChats.id],
			name: "simulation_messages_chat_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationChatFeedbacks = pgTable("simulation_chat_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	standardId: uuid("standard_id").notNull(),
	simulationChatGradeId: uuid("simulation_chat_grade_id").notNull(),
	total: integer().notNull(),
	feedback: text().default('No feedback provided').notNull(),
}, (table) => [
	index("scf_grade_idx").using("btree", table.simulationChatGradeId.asc().nullsLast().op("uuid_ops")),
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

export const cohorts = pgTable("cohorts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text().default('No description provided').notNull(),
	active: boolean().default(true).notNull(),
});

export const scenarioObjectives = pgTable("scenario_objectives", {
	scenarioId: uuid("scenario_id").notNull(),
	idx: integer().notNull(),
	objective: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("scenario_objectives_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_objectives_scenario_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.scenarioId, table.idx], name: "scenario_objectives_pkey"}),
]);

export const simulationHints = pgTable("simulation_hints", {
	simulationMessageId: uuid("simulation_message_id").notNull(),
	idx: integer().notNull(),
	hint: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("simulation_hints_simulation_message_id_idx").using("btree", table.simulationMessageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.simulationMessageId],
			foreignColumns: [simulationMessages.id],
			name: "simulation_hints_simulation_message_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.simulationMessageId, table.idx], name: "simulation_hints_pkey"}),
]);

export const documentDepartments = pgTable("document_departments", {
	documentId: uuid("document_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("document_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("document_departments_document_id_idx").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_departments_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "document_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.documentId, table.departmentId], name: "document_departments_pkey"}),
]);

export const rubricDepartments = pgTable("rubric_departments", {
	rubricId: uuid("rubric_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("rubric_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("rubric_departments_rubric_id_idx").using("btree", table.rubricId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "rubric_departments_rubric_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "rubric_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.rubricId, table.departmentId], name: "rubric_departments_pkey"}),
]);

export const promptDepartments = pgTable("prompt_departments", {
	promptId: uuid("prompt_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("prompt_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("prompt_departments_prompt_id_idx").using("btree", table.promptId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.promptId],
			foreignColumns: [prompts.id],
			name: "prompt_departments_prompt_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "prompt_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.promptId, table.departmentId], name: "prompt_departments_pkey"}),
]);

export const personaDepartments = pgTable("persona_departments", {
	personaId: uuid("persona_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("persona_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("persona_departments_persona_id_idx").using("btree", table.personaId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "persona_departments_persona_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "persona_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.personaId, table.departmentId], name: "persona_departments_pkey"}),
]);

export const personaPrompts = pgTable("persona_prompts", {
	personaId: uuid("persona_id").notNull(),
	promptId: uuid("prompt_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("persona_prompts_persona_id_active_idx").using("btree", table.personaId.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("uuid_ops")),
	index("persona_prompts_persona_id_idx").using("btree", table.personaId.asc().nullsLast().op("uuid_ops")),
	index("persona_prompts_prompt_id_idx").using("btree", table.promptId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "persona_prompts_persona_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.promptId],
			foreignColumns: [prompts.id],
			name: "persona_prompts_prompt_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.personaId, table.promptId], name: "persona_prompts_pkey"}),
]);

export const modelRunModels = pgTable("model_run_models", {
	modelRunId: uuid("model_run_id").notNull(),
	modelId: uuid("model_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("model_run_models_model_id_idx").using("btree", table.modelId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("one_model_per_run").using("btree", table.modelRunId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelRunId],
			foreignColumns: [modelRuns.id],
			name: "model_run_models_model_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "model_run_models_model_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.modelRunId, table.modelId], name: "model_run_models_pkey"}),
]);

export const modelRunPersonas = pgTable("model_run_personas", {
	modelRunId: uuid("model_run_id").notNull(),
	personaId: uuid("persona_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("model_run_personas_persona_id_idx").using("btree", table.personaId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("one_persona_per_run").using("btree", table.modelRunId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelRunId],
			foreignColumns: [modelRuns.id],
			name: "model_run_personas_model_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "model_run_personas_persona_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.modelRunId, table.personaId], name: "model_run_personas_pkey"}),
]);

export const modelRunAgents = pgTable("model_run_agents", {
	modelRunId: uuid("model_run_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("model_run_agents_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("one_agent_per_run").using("btree", table.modelRunId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelRunId],
			foreignColumns: [modelRuns.id],
			name: "model_run_agents_model_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "model_run_agents_agent_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.modelRunId, table.agentId], name: "model_run_agents_pkey"}),
]);

export const modelRunProfiles = pgTable("model_run_profiles", {
	modelRunId: uuid("model_run_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("model_run_profiles_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("one_profile_per_run").using("btree", table.modelRunId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelRunId],
			foreignColumns: [modelRuns.id],
			name: "model_run_profiles_model_run_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "model_run_profiles_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.modelRunId, table.profileId], name: "model_run_profiles_pkey"}),
]);

export const agentDepartments = pgTable("agent_departments", {
	agentId: uuid("agent_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_departments_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("agent_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_departments_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "agent_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.agentId, table.departmentId], name: "agent_departments_pkey"}),
]);

export const agentPrompts = pgTable("agent_prompts", {
	agentId: uuid("agent_id").notNull(),
	promptId: uuid("prompt_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_prompts_agent_id_active_idx").using("btree", table.agentId.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("uuid_ops")),
	index("agent_prompts_agent_id_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("agent_prompts_prompt_id_idx").using("btree", table.promptId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_prompts_agent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.promptId],
			foreignColumns: [prompts.id],
			name: "agent_prompts_prompt_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.agentId, table.promptId], name: "agent_prompts_pkey"}),
]);

export const parameterItemDepartments = pgTable("parameter_item_departments", {
	parameterItemId: uuid("parameter_item_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("parameter_item_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("parameter_item_departments_parameter_item_id_idx").using("btree", table.parameterItemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.parameterItemId],
			foreignColumns: [parameterItems.id],
			name: "parameter_item_departments_parameter_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "parameter_item_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.parameterItemId, table.departmentId], name: "parameter_item_departments_pkey"}),
]);

export const scenarioDepartments = pgTable("scenario_departments", {
	scenarioId: uuid("scenario_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("scenario_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("scenario_departments_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_departments_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "scenario_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.scenarioId, table.departmentId], name: "scenario_departments_pkey"}),
]);

export const scenarioPersonas = pgTable("scenario_personas", {
	scenarioId: uuid("scenario_id").notNull(),
	personaId: uuid("persona_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("scenario_personas_one_active_per_scenario").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")).where(sql`active`),
	index("scenario_personas_persona_id_idx").using("btree", table.personaId.asc().nullsLast().op("uuid_ops")),
	index("scenario_personas_scenario_active_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops"), table.personaId.asc().nullsLast().op("uuid_ops")).where(sql`(active = true)`),
	index("scenario_personas_scenario_id_active_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops"), table.active.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_personas_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "scenario_personas_persona_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.scenarioId, table.personaId], name: "scenario_personas_pkey"}),
]);

export const scenarioParameterItems = pgTable("scenario_parameter_items", {
	scenarioId: uuid("scenario_id").notNull(),
	parameterItemId: uuid("parameter_item_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("scenario_parameter_items_parameter_item_id_idx").using("btree", table.parameterItemId.asc().nullsLast().op("uuid_ops")),
	index("scenario_parameter_items_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_parameter_items_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parameterItemId],
			foreignColumns: [parameterItems.id],
			name: "scenario_parameter_items_parameter_item_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.scenarioId, table.parameterItemId], name: "scenario_parameter_items_pkey"}),
]);

export const scenarioDocuments = pgTable("scenario_documents", {
	scenarioId: uuid("scenario_id").notNull(),
	documentId: uuid("document_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("scenario_documents_document_id_idx").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
	index("scenario_documents_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "scenario_documents_scenario_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "scenario_documents_document_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.scenarioId, table.documentId], name: "scenario_documents_pkey"}),
]);

export const documentParameterItems = pgTable("document_parameter_items", {
	documentId: uuid("document_id").notNull(),
	parameterItemId: uuid("parameter_item_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("document_parameter_items_document_id_idx").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")),
	index("document_parameter_items_parameter_item_id_idx").using("btree", table.parameterItemId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_parameter_items_document_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parameterItemId],
			foreignColumns: [parameterItems.id],
			name: "document_parameter_items_parameter_item_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.documentId, table.parameterItemId], name: "document_parameter_items_pkey"}),
]);

export const scenarioTree = pgTable("scenario_tree", {
	parentId: uuid("parent_id").notNull(),
	childId: uuid("child_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("scenario_tree_child_id_idx").using("btree", table.childId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("scenario_tree_one_parent_per_child").using("btree", table.childId.asc().nullsLast().op("uuid_ops")),
	index("scenario_tree_parent_id_idx").using("btree", table.parentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [scenarios.id],
			name: "scenario_tree_parent_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [scenarios.id],
			name: "scenario_tree_child_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.parentId, table.childId], name: "scenario_tree_pkey"}),
]);

export const simulationDepartments = pgTable("simulation_departments", {
	simulationId: uuid("simulation_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("simulation_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	index("simulation_departments_simulation_id_idx").using("btree", table.simulationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.simulationId],
			foreignColumns: [simulations.id],
			name: "simulation_departments_simulation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "simulation_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.simulationId, table.departmentId], name: "simulation_departments_pkey"}),
]);

export const attemptProfiles = pgTable("attempt_profiles", {
	attemptId: uuid("attempt_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("attempt_profiles_attempt_active_idx").using("btree", table.attemptId.asc().nullsLast().op("uuid_ops"), table.profileId.asc().nullsLast().op("uuid_ops")).where(sql`(active = true)`),
	index("attempt_profiles_attempt_id_active_idx").using("btree", table.attemptId.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("attempt_profiles_one_active_per_attempt").using("btree", table.attemptId.asc().nullsLast().op("uuid_ops")).where(sql`active`),
	index("attempt_profiles_profile_active_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.attemptId.asc().nullsLast().op("uuid_ops")).where(sql`(active = true)`),
	index("attempt_profiles_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [simulationAttempts.id],
			name: "attempt_profiles_attempt_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "attempt_profiles_profile_id_fkey"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.attemptId, table.profileId], name: "attempt_profiles_pkey"}),
]);

export const cohortProfiles = pgTable("cohort_profiles", {
	cohortId: uuid("cohort_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cohort_profiles_cohort_id_idx").using("btree", table.cohortId.asc().nullsLast().op("uuid_ops")),
	index("cohort_profiles_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohorts.id],
			name: "cohort_profiles_cohort_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "cohort_profiles_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.cohortId, table.profileId], name: "cohort_profiles_pkey"}),
]);

export const cohortSimulations = pgTable("cohort_simulations", {
	cohortId: uuid("cohort_id").notNull(),
	simulationId: uuid("simulation_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cohort_simulations_cohort_id_idx").using("btree", table.cohortId.asc().nullsLast().op("uuid_ops")),
	index("cohort_simulations_simulation_id_idx").using("btree", table.simulationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohorts.id],
			name: "cohort_simulations_cohort_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.simulationId],
			foreignColumns: [simulations.id],
			name: "cohort_simulations_simulation_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.cohortId, table.simulationId], name: "cohort_simulations_pkey"}),
]);

export const cohortDepartments = pgTable("cohort_departments", {
	cohortId: uuid("cohort_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cohort_departments_cohort_id_idx").using("btree", table.cohortId.asc().nullsLast().op("uuid_ops")),
	index("cohort_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohorts.id],
			name: "cohort_departments_cohort_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "cohort_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.cohortId, table.departmentId], name: "cohort_departments_pkey"}),
]);

export const profileDepartments = pgTable("profile_departments", {
	profileId: uuid("profile_id").notNull(),
	departmentId: uuid("department_id").notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("profile_departments_department_id_idx").using("btree", table.departmentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("profile_departments_one_primary_per_profile").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")).where(sql`is_primary`),
	index("profile_departments_profile_id_is_primary_idx").using("btree", table.profileId.asc().nullsLast().op("bool_ops"), table.isPrimary.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "profile_departments_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "profile_departments_department_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.profileId, table.departmentId], name: "profile_departments_pkey"}),
]);

export const appFeedbackProfiles = pgTable("app_feedback_profiles", {
	appFeedbackId: integer("app_feedback_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	role: text().default('author').notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("app_feedback_profiles_app_feedback_id_idx").using("btree", table.appFeedbackId.asc().nullsLast().op("int4_ops")),
	index("app_feedback_profiles_profile_id_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.appFeedbackId],
			foreignColumns: [appFeedback.id],
			name: "app_feedback_profiles_app_feedback_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "app_feedback_profiles_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.appFeedbackId, table.profileId, table.role], name: "app_feedback_profiles_pkey"}),
]);

export const simulationScenarios = pgTable("simulation_scenarios", {
	simulationId: uuid("simulation_id").notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	position: integer().default(1).notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("simulation_scenarios_position_uniq").using("btree", table.simulationId.asc().nullsLast().op("int4_ops"), table.position.asc().nullsLast().op("int4_ops")),
	index("simulation_scenarios_scenario_id_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	index("simulation_scenarios_simulation_id_idx").using("btree", table.simulationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.simulationId],
			foreignColumns: [simulations.id],
			name: "simulation_scenarios_simulation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [scenarios.id],
			name: "simulation_scenarios_scenario_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.simulationId, table.scenarioId], name: "simulation_scenarios_pkey"}),
]);
export const analytics = pgMaterializedView("analytics", {	chatId: uuid("chat_id"),
	attemptId: uuid("attempt_id"),
	profileId: uuid("profile_id"),
	simulationId: uuid("simulation_id"),
	scenarioId: uuid("scenario_id"),
	leafScenarioId: uuid("leaf_scenario_id"),
	personaId: uuid("persona_id"),
	personaColor: text("persona_color"),
	isPractice: boolean("is_practice"),
	isArchived: boolean("is_archived"),
	isGeneral: boolean("is_general"),
	profileRole: profileRole("profile_role"),
	cohortIds: uuid("cohort_ids"),
	chatCreatedAt: timestamp("chat_created_at", { withTimezone: true, mode: 'string' }),
	gradePercent: numeric("grade_percent"),
	passed: boolean(),
	timeTakenSeconds: numeric("time_taken_seconds"),
	rubricId: uuid("rubric_id"),
	rubricPoints: integer("rubric_points"),
	rubricPassPoints: integer("rubric_pass_points"),
	completed: boolean(),
	numMessagesTotal: integer("num_messages_total"),
	numQueryMessages: integer("num_query_messages"),
	numResponseMessages: integer("num_response_messages"),
	messageTimeTakenSeconds: integer("message_time_taken_seconds"),
	attemptCreatedAt: timestamp("attempt_created_at", { withTimezone: true, mode: 'string' }),
	profileCohortIds: uuid("profile_cohort_ids"),
	simScenarioCount: integer("sim_scenario_count"),
	gradeCreatedAt: timestamp("grade_created_at", { withTimezone: true, mode: 'string' }),
	departmentId: uuid("department_id"),
}).as(sql`WITH RECURSIVE scenario_roots AS ( SELECT s_1.id, st.parent_id, s_1.id AS root_id FROM scenarios s_1 JOIN scenario_tree st ON st.child_id = s_1.id AND st.parent_id = s_1.id UNION ALL SELECT s1.id, st.parent_id, sr.root_id FROM scenarios s1 JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id JOIN scenario_roots sr ON st.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.active, simulations.rubric_id, simulations.practice_simulation FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.use_documents, scenarios.generated, scenarios.active, scenarios.hints_enabled, scenarios.objectives_enabled, scenarios.image_input_enabled, scenarios.input_guardrail_enabled, scenarios.output_guardrail_enabled FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s_1.id WHERE c.active = true) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, ap_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa_1.simulation_id JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap_1.profile_id WHERE c.active = true) AS profile_cohort_ids FROM simulation_attempts sa_1 LEFT JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ), effective_profile_department AS ( SELECT pd.profile_id, COALESCE(( SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1), ( SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)) AS department_id FROM ( SELECT DISTINCT ap_1.profile_id FROM simulation_attempts sa_1 JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true) pd ), simulation_first_dept AS ( SELECT DISTINCT ON (simulation_departments.simulation_id) simulation_departments.simulation_id, simulation_departments.department_id FROM simulation_departments WHERE simulation_departments.active = true ORDER BY simulation_departments.simulation_id, simulation_departments.created_at ), rubric_first_dept AS ( SELECT DISTINCT ON (rubric_departments.rubric_id) rubric_departments.rubric_id, rubric_departments.department_id FROM rubric_departments WHERE rubric_departments.active = true ORDER BY rubric_departments.rubric_id, rubric_departments.created_at ), scenario_first_dept AS ( SELECT DISTINCT ON (scenario_departments.scenario_id) scenario_departments.scenario_id, scenario_departments.department_id FROM scenario_departments WHERE scenario_departments.active = true ORDER BY scenario_departments.scenario_id, scenario_departments.created_at ), persona_first_dept AS ( SELECT DISTINCT ON (persona_departments.persona_id) persona_departments.persona_id, persona_departments.department_id FROM persona_departments WHERE persona_departments.active = true ORDER BY persona_departments.persona_id, persona_departments.created_at ) SELECT sc.id AS chat_id, sc.attempt_id, ap.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, sp.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, (( SELECT count(*) AS count FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id))::integer AS sim_scenario_count, lg.created_at AS grade_created_at, COALESCE(epd.department_id, sfd.department_id, rfd.department_id, scfd.department_id, pfd.department_id) AS department_id FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = ap.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true LEFT JOIN personas p ON p.id = sp.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.id LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id`);