import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
export const agentType = pgEnum("agent_type", ["student", "ta"]);
export const classTerm = pgEnum("class_term", ["fall", "spring", "summer"]);
export const documentType = pgEnum("document_type", [
  "homework",
  "project",
  "quiz",
  "midterm",
  "lab",
  "lecture",
  "syllabus",
]);
export const evalType = pgEnum("eval_type", ["student", "ta"]);
export const profileRole = pgEnum("profile_role", [
  "admin",
  "instructional",
  "instructor",
  "ta",
]);
export const rubricType = pgEnum("rubric_type", ["simulation", "eval"]);
export const seniorityLevels = pgEnum("seniority_levels", [
  "freshman",
  "sophomore",
  "junior",
  "senior",
]);

export const account = pgTable("account", {
  userId: text().notNull(),
  type: text().notNull(),
  provider: text().notNull(),
  providerAccountId: text().notNull(),
  refreshToken: text(),
  accessToken: text(),
  expiresAt: integer(),
  tokenType: text(),
  scope: text(),
  idToken: text(),
  sessionState: text(),
});

export const agents = pgTable("agents", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  name: text().notNull(),
  subtitle: text().notNull(),
  description: text().notNull(),
  systemPrompt: text("system_prompt").notNull(),
  agentType: agentType("agent_type").default("student").notNull(),
  temperature: integer().notNull(),
});

export const authenticator = pgTable(
  "authenticator",
  {
    credentialId: text().notNull(),
    userId: text().notNull(),
    providerAccountId: text().notNull(),
    credentialPublicKey: text().notNull(),
    counter: integer().notNull(),
    credentialDeviceType: text().notNull(),
    credentialBackedUp: boolean().notNull(),
    transports: text(),
  },
  (table) => [
    unique("authenticator_credentialId_unique").on(table.credentialId),
  ]
);

export const classes = pgTable("classes", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  name: text().notNull(),
  classCode: text("class_code").notNull(),
  year: integer().notNull(),
  term: classTerm().default("fall").notNull(),
  description: text().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  name: text().notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  classId: uuid("class_id").notNull(),
  type: documentType().default("homework").notNull(),
  classified: boolean().default(false).notNull(),
});

export const evalChatFeedbacks = pgTable("eval_chat_feedbacks", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  standardId: uuid("standard_id").notNull(),
  evalChatGradeId: uuid("eval_chat_grade_id").notNull(),
  total: integer().notNull(),
  feedback: text(),
});

export const evalChatGrades = pgTable("eval_chat_grades", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  passed: boolean().notNull(),
  score: integer().notNull(),
  timeTaken: integer("time_taken").notNull(),
  rubricId: uuid("rubric_id").notNull(),
  evalChatId: uuid("eval_chat_id").notNull(),
});

export const evalChats = pgTable("eval_chats", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", {
    withTimezone: true,
    mode: "string",
  }),
  title: text().notNull(),
  evalRunId: uuid("eval_run_id").notNull(),
});

export const evalMessages = pgTable("eval_messages", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  chatId: uuid("chat_id").notNull(),
  query: text().notNull(),
  response: text().notNull(),
  completed: boolean().default(false).notNull(),
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  classId: uuid("class_id").notNull(),
  evalId: uuid("eval_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  scenarioId: uuid("scenario_id").notNull(),
  rubricId: uuid("rubric_id").notNull(),
});
