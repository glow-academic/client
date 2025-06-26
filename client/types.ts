import { 
  accounts as Accounts,
  assistantChats as AssistantChats,
  evals as Evals,
  rubrics as Rubrics,
  sessions as Sessions,
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
  migrations as Migrations,
  evalRuns as EvalRuns,
  evalMessages as EvalMessages,
  providers as Providers,
  scenarios as Scenarios,
  models as Models,
  profiles as Profiles,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  standardGroups as StandardGroups,
  simulationChatGrades as SimulationChatGrades,
  topics as Topics,
  schedules as Schedules,
  simulationAttempts as SimulationAttempts,
  users as Users,
  simulations as Simulations,
  documents as Documents,
  standards as Standards,
  evalChats as EvalChats,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, evalMessageType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Session = typeof Sessions.$inferSelect;
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
type Migration = typeof Migrations.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Model = typeof Models.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type User = typeof Users.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
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
  AssistantChat,
  Eval,
  Rubric,
  Session,
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
  Migration,
  EvalRun,
  EvalMessage,
  Provider,
  Scenario,
  Model,
  Profile,
  SimulationChat,
  SimulationMessage,
  StandardGroup,
  SimulationChatGrade,
  Topic,
  Schedule,
  SimulationAttempt,
  User,
  Simulation,
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
