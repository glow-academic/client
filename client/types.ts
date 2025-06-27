import { 
  accounts as Accounts,
  assistantChats as AssistantChats,
  evals as Evals,
  providers as Providers,
  simulationMessages as SimulationMessages,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  evalChatGrades as EvalChatGrades,
  cohorts as Cohorts,
  components as Components,
  classes as Classes,
  evalChatFeedbacks as EvalChatFeedbacks,
  agents as Agents,
  events as Events,
  evalChats as EvalChats,
  evalRuns as EvalRuns,
  evalMessages as EvalMessages,
  scenarios as Scenarios,
  schedules as Schedules,
  simulationAttempts as SimulationAttempts,
  sessions as Sessions,
  profiles as Profiles,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  simulationChatGrades as SimulationChatGrades,
  topics as Topics,
  users as Users,
  simulations as Simulations,
  simulationChats as SimulationChats,
  models as Models,
  documents as Documents,
  standards as Standards,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  migrations as Migrations,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, evalMessageType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Event = typeof Events.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type User = typeof Users.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Model = typeof Models.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
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
  AssistantChat,
  Eval,
  Provider,
  SimulationMessage,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  EvalChatGrade,
  Cohort,
  Component,
  Class,
  EvalChatFeedback,
  Agent,
  Event,
  EvalChat,
  EvalRun,
  EvalMessage,
  Scenario,
  Schedule,
  SimulationAttempt,
  Session,
  Profile,
  Rubric,
  StandardGroup,
  SimulationChatGrade,
  Topic,
  User,
  Simulation,
  SimulationChat,
  Model,
  Document,
  Standard,
  SimulationChatFeedback,
  Migration,
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
