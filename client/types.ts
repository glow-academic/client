import {
  accounts as Accounts,
  agents as Agents,
  appLogs as AppLogs,
  assistantChats as AssistantChats,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  classes as Classes,
  cohorts as Cohorts,
  components as Components,
  dashboards as Dashboards,
  documents as Documents,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalChatGrades as EvalChatGrades,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalRuns as EvalRuns,
  evals as Evals,
  events as Events,
  models as Models,
  profiles as Profiles,
  providers as Providers,
  rubrics as Rubrics,
  scenarios as Scenarios,
  schedules as Schedules,
  sessions as Sessions,
  simulationAttempts as SimulationAttempts,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  simulationChatGrades as SimulationChatGrades,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulations as Simulations,
  standardGroups as StandardGroups,
  standards as Standards,
  topics as Topics,
  users as Users,
  verificationToken as VerificationToken,
  assistantMessageType,
  assistantToolType,
  classTerm,
  documentType,
  evalMessageType,
  profileRole,
  seniorityLevels,
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Model = typeof Models.$inferSelect;
type Account = typeof Accounts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Component = typeof Components.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalMessageType = (typeof evalMessageType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type {
  Account,
  Agent,
  AppLog,
  AssistantChat,
  AssistantMessage,
  AssistantMessageType,
  AssistantToolCall,
  AssistantToolType,
  Class,
  ClassTerm,
  Cohort,
  Component,
  Dashboard,
  Document,
  DocumentType,
  Eval,
  EvalChat,
  EvalChatFeedback,
  EvalChatGrade,
  EvalMessage,
  EvalMessageType,
  EvalRun,
  Event,
  Model,
  Profile,
  ProfileRole,
  Provider,
  Rubric,
  Scenario,
  Schedule,
  SeniorityLevels,
  Session,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatFeedback,
  SimulationChatGrade,
  SimulationMessage,
  Standard,
  StandardGroup,
  Topic,
  User,
  VerificationToken,
};
