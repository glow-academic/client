import { 
  classes as Classes,
  topics as Topics,
  schedules as Schedules,
  events as Events,
  documents as Documents,
  providers as Providers,
  accounts as Accounts,
  sessions as Sessions,
  models as Models,
  users as Users,
  profiles as Profiles,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  standards as Standards,
  appLogs as AppLogs,
  assistantChats as AssistantChats,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  components as Components,
  scenarios as Scenarios,
  dashboards as Dashboards,
  agents as Agents,
  cohorts as Cohorts,
  simulations as Simulations,
  simulationAttempts as SimulationAttempts,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulationChatGrades as SimulationChatGrades,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalChatGrades as EvalChatGrades,
  evalChatFeedbacks as EvalChatFeedbacks,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, evalMessageType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Account = typeof Accounts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Model = typeof Models.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Component = typeof Components.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Agent = typeof Agents.$inferSelect;
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
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];

export type { 
  Class,
  Topic,
  Schedule,
  Event,
  Document,
  Provider,
  Account,
  Session,
  Model,
  User,
  Profile,
  Rubric,
  StandardGroup,
  Standard,
  AppLog,
  AssistantChat,
  AssistantMessage,
  AssistantToolCall,
  Component,
  Scenario,
  Dashboard,
  Agent,
  Cohort,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationMessage,
  SimulationChatGrade,
  SimulationChatFeedback,
  Eval,
  EvalRun,
  EvalChat,
  EvalMessage,
  EvalChatGrade,
  EvalChatFeedback,
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
