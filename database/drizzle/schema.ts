import { pgTable, serial, varchar, timestamp, text, foreignKey, uuid, integer, boolean, doublePrecision, bigint, index, jsonb, real, primaryKey, pgMaterializedView, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const agentType = pgEnum("agent_type", ['title', 'scenario', 'classify', 'assistant', 'grade', 'guardrail'])
export const assistantMessageType = pgEnum("assistant_message_type", ['user', 'assistant'])
export const assistantToolType = pgEnum("assistant_tool_type", ['create', 'read', 'update', 'delete'])
export const documentType = pgEnum("document_type", ['homework', 'project', 'quiz', 'midterm', 'lab', 'lecture', 'syllabus'])
export const feedbackType = pgEnum("feedback_type", ['feature', 'bug', 'question', 'other'])
export const profileRole = pgEnum("profile_role", ['superadmin', 'admin', 'instructional', 'ta', 'guest'])
export const reasoningEffort = pgEnum("reasoning_effort", ['minimal', 'low', 'medium', 'high'])
export const simulationMessageType = pgEnum("simulation_message_type", ['query', 'response'])


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
	viewedChat: boolean("viewed_chat").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	role: profileRole().default('guest').notNull(),
	defaultProfile: boolean("default_profile").default(false).notNull(),
	active: boolean().default(false).notNull(),
	lastActive: timestamp("last_active", { withTimezone: true, mode: 'string' }),
	reqPerDay: integer("req_per_day"),
	departmentId: uuid("department_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "profiles_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "profiles_department_id_fkey"
		}).onDelete("set null"),
]);

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text(),
});

export const providers = pgTable("providers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	apiKey: text("api_key").notNull(),
	baseUrl: text("base_url"),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "providers_department_id_fkey"
		}).onDelete("cascade"),
]);

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
}, (table) => [
	foreignKey({
			columns: [table.providerId],
			foreignColumns: [providers.id],
			name: "models_provider_id_fkey"
		}).onDelete("cascade"),
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
	fileId: text("file_id"),
	active: boolean().default(true).notNull(),
	tags: text().array().default([""]).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "documents_department_id_fkey"
		}).onDelete("cascade"),
]);

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

export const rubrics = pgTable("rubrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	points: integer().notNull(),
	passPoints: integer("pass_points").notNull(),
	defaultRubric: boolean("default_rubric").default(false).notNull(),
	active: boolean().default(true).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	index("rubrics_id_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "rubrics_department_id_fkey"
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

export const appLogs = pgTable("app_logs", {
	id: serial().primaryKey().notNull(),
	event: text().default('default.event').notNull(),
	level: text().default('info').notNull(),
	message: text().default('Default Message'),
	correlationId: text("correlation_id").default('default.correlation'),
	actor: jsonb().default({"userId":null,"profileId":null}),
	subject: jsonb().default({"entityId":null,"entityType":null}),
	metrics: jsonb().default({"size":null,"count":null,"durationMs":null}),
	context: jsonb().default({"route":null,"function":null,"component":null}),
	error: jsonb().default({"code":null,"name":null,"stack":null,"message":null}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const appFeedback = pgTable("app_feedback", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	profileId: uuid("profile_id"),
	type: feedbackType().notNull(),
	message: text(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "app_feedback_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const assistantChats = pgTable("assistant_chats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	profileId: uuid("profile_id").notNull(),
	traceId: text("trace_id"),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "assistant_chats_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const assistantMessages = pgTable("assistant_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
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
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
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

export const personas = pgTable("personas", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	temperature: real().notNull(),
	defaultPersona: boolean("default_persona").default(false).notNull(),
	color: text().notNull(),
	icon: text().notNull(),
	modelId: uuid("model_id"),
	reasoning: reasoningEffort(),
	active: boolean().default(false).notNull(),
	guardrailActive: boolean("guardrail_active").default(false).notNull(),
	imageInputActive: boolean("image_input_active").default(false).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	index("personas_id_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "personas_model_id_fkey"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "personas_department_id_fkey"
		}).onDelete("cascade"),
]);

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	systemPrompt: text("system_prompt").notNull(),
	temperature: real().notNull(),
	modelId: uuid("model_id"),
	reasoning: reasoningEffort(),
	type: agentType().notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "agents_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "agents_department_id_fkey"
		}).onDelete("cascade"),
]);

export const modelRuns = pgTable("model_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	modelId: uuid("model_id"),
	inputTokens: integer("input_tokens").default(0).notNull(),
	outputTokens: integer("output_tokens").default(0).notNull(),
	personaId: uuid("persona_id"),
	agentId: uuid("agent_id"),
	profileId: uuid("profile_id"),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [models.id],
			name: "model_runs_model_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "model_runs_persona_id_fkey"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "model_runs_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "model_runs_profile_id_fkey"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "model_runs_department_id_fkey"
		}).onDelete("cascade"),
]);

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
	defaultParameter: boolean("default_parameter").default(false).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "parameters_department_id_fkey"
		}).onDelete("cascade"),
]);

export const scenarios = pgTable("scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	personaId: uuid("persona_id"),
	parameterItemIds: uuid("parameter_item_ids").array(),
	documentIds: uuid("document_ids").array(),
	defaultScenario: boolean("default_scenario").default(false).notNull(),
	practiceScenario: boolean("practice_scenario").default(false).notNull(),
	generated: boolean().default(false).notNull(),
	parentId: uuid("parent_id"),
	active: boolean().default(true).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	index("scenarios_id_active_idx").using("btree", table.id.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.personaId],
			foreignColumns: [personas.id],
			name: "scenarios_persona_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "scenarios_department_id_fkey"
		}).onDelete("cascade"),
]);

export const simulations = pgTable("simulations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text().default('No description provided').notNull(),
	timeLimit: integer("time_limit"),
	active: boolean().default(true).notNull(),
	scenarioIds: uuid("scenario_ids").array().default(["RAY"]).notNull(),
	rubricId: uuid("rubric_id").notNull(),
	defaultSimulation: boolean("default_simulation").default(false).notNull(),
	practiceSimulation: boolean("practice_simulation").default(false).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	index("simulations_id_active_idx").using("btree", table.id.asc().nullsLast().op("bool_ops"), table.active.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.rubricId],
			foreignColumns: [rubrics.id],
			name: "simulations_rubric_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "simulations_department_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationAttempts = pgTable("simulation_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profileId: uuid("profile_id"),
	simulationId: uuid("simulation_id").notNull(),
	infiniteMode: boolean("infinite_mode").default(false).notNull(),
	infiniteModeTimeLimit: integer("infinite_mode_time_limit"),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("simulation_attempts_archived_idx").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("simulation_attempts_id_profile_archived_idx").using("btree", table.id.asc().nullsLast().op("uuid_ops"), table.profileId.asc().nullsLast().op("uuid_ops"), table.archived.asc().nullsLast().op("uuid_ops"), table.infiniteMode.asc().nullsLast().op("uuid_ops")),
	index("simulation_attempts_profile_sim_idx").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.simulationId.asc().nullsLast().op("uuid_ops")),
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

export const simulationChatFeedbacks = pgTable("simulation_chat_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	standardId: uuid("standard_id").notNull(),
	simulationChatGradeId: uuid("simulation_chat_grade_id").notNull(),
	total: integer().notNull(),
	feedback: text(),
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

export const simulationChatCrowdsourcedFeedbacks = pgTable("simulation_chat_crowdsourced_feedbacks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	profileId: uuid("profile_id").notNull(),
	simulationChatFeedbackId: uuid("simulation_chat_feedback_id").notNull(),
	total: integer().notNull(),
	feedback: text(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "simulation_chat_crowdsourced_feedbacks_profile_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.simulationChatFeedbackId],
			foreignColumns: [simulationChatFeedbacks.id],
			name: "simulation_chat_crowdsourced_f_simulation_chat_feedback_id_fkey"
		}).onDelete("cascade"),
]);

export const simulationCrowdsourcedMessages = pgTable("simulation_crowdsourced_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	simulationMessageId: uuid("simulation_message_id").notNull(),
	profileId: uuid("profile_id").notNull(),
	response: boolean().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.simulationMessageId],
			foreignColumns: [simulationMessages.id],
			name: "simulation_crowdsourced_messages_simulation_message_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "simulation_crowdsourced_messages_profile_id_fkey"
		}).onDelete("cascade"),
]);

export const cohorts = pgTable("cohorts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	title: text().notNull(),
	description: text(),
	active: boolean().default(true).notNull(),
	profileIds: uuid("profile_ids").array().default(["RAY"]).notNull(),
	defaultCohort: boolean("default_cohort").default(false).notNull(),
	simulationIds: uuid("simulation_ids").array().default(["RAY"]).notNull(),
	departmentId: uuid("department_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "cohorts_department_id_fkey"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: serial().primaryKey().notNull(),
	userId: integer().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	sessionToken: varchar({ length: 255 }).notNull(),
});

export const verificationToken = pgTable("verification_token", {
	identifier: text().notNull(),
	expires: timestamp({ withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "verification_token_pkey"}),
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
	chatCompletedAt: timestamp("chat_completed_at", { withTimezone: true, mode: 'string' }),
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
}).as(sql`WITH RECURSIVE scenario_roots AS ( SELECT scenarios.id, scenarios.parent_id, scenarios.id AS root_id FROM scenarios WHERE scenarios.parent_id IS NULL UNION ALL SELECT s_1.id, s_1.parent_id, sr.root_id FROM scenarios s_1 JOIN scenario_roots sr ON s_1.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.time_limit, simulations.active, simulations.scenario_ids, simulations.rubric_id, simulations.default_simulation, simulations.practice_simulation, simulations.department_id FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.description, scenarios.persona_id, scenarios.parameter_item_ids, scenarios.document_ids, scenarios.default_scenario, scenarios.practice_scenario, scenarios.generated, scenarios.parent_id, scenarios.active, scenarios.department_id FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active, c.simulation_ids, c.profile_ids FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts_expanded c WHERE c.active = true AND (s_1.id = ANY (c.simulation_ids))) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, sa_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts_expanded c WHERE c.active = true AND (sa_1.simulation_id = ANY (c.simulation_ids)) AND (sa_1.profile_id = ANY (c.profile_ids))) AS profile_cohort_ids FROM simulation_attempts sa_1 ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ) SELECT sc.id AS chat_id, sc.attempt_id, sa.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, s.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, sc.completed_at AS chat_completed_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR sc.completed_at IS NOT NULL OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, COALESCE(array_length(sim.scenario_ids, 1), 0) AS sim_scenario_count, lg.created_at AS grade_created_at FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = sa.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN personas p ON p.id = s.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id`);