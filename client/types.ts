import { 
  accounts as Accounts,
  evalChatGrades as EvalChatGrades,
  appLogs as AppLogs,
  evalChatFeedbacks as EvalChatFeedbacks,
  cohorts as Cohorts,
  components as Components,
  evals as Evals,
  rubrics as Rubrics,
  sessions as Sessions,
  agents as Agents,
  events as Events,
  migrations as Migrations,
  evalRuns as EvalRuns,
  evalMessages as EvalMessages,
  providers as Providers,
  scenarios as Scenarios,
  models as Models,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  topics as Topics,
  simulationChatGrades as SimulationChatGrades,
  schedules as Schedules,
  simulationAttempts as SimulationAttempts,
  users as Users,
  simulations as Simulations,
  standardGroups as StandardGroups,
  profiles as Profiles,
  assistantChats as AssistantChats,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  classes as Classes,
  documents as Documents,
  standards as Standards,
  evalChats as EvalChats,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, evalMessageType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Event = typeof Events.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Model = typeof Models.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type User = typeof Users.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalMessageType = (typeof evalMessageType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];

export type { 
  Account,
  EvalChatGrade,
  AppLog,
  EvalChatFeedback,
  Cohort,
  Component,
  Eval,
  Rubric,
  Session,
  Agent,
  Event,
  Migration,
  EvalRun,
  EvalMessage,
  Provider,
  Scenario,
  Model,
  SimulationChat,
  SimulationMessage,
  Topic,
  SimulationChatGrade,
  Schedule,
  SimulationAttempt,
  User,
  Simulation,
  StandardGroup,
  Profile,
  AssistantChat,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Class,
  Document,
  Standard,
  EvalChat,
  SimulationChatFeedback,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  EvalMessageType,
  ProfileRole,
  ReasoningEffort,
  SeniorityLevels,
  SimulationMessageType
};
