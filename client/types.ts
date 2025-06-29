import { 
  accounts as Accounts,
  assistantChats as AssistantChats,
  providers as Providers,
  simulationChats as SimulationChats,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  events as Events,
  cohorts as Cohorts,
  components as Components,
  classes as Classes,
  documents as Documents,
  rubrics as Rubrics,
  scenarios as Scenarios,
  sessions as Sessions,
  simulationMessages as SimulationMessages,
  simulationChatGrades as SimulationChatGrades,
  simulationAttempts as SimulationAttempts,
  simulations as Simulations,
  standardGroups as StandardGroups,
  standards as Standards,
  topics as Topics,
  profiles as Profiles,
  schedules as Schedules,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  agents as Agents,
  models as Models,
  migrations as Migrations,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, modelType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Event = typeof Events.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Model = typeof Models.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type ModelType = (typeof modelType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];

export type { 
  Account,
  AssistantChat,
  Provider,
  SimulationChat,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Event,
  Cohort,
  Component,
  Class,
  Document,
  Rubric,
  Scenario,
  Session,
  SimulationMessage,
  SimulationChatGrade,
  SimulationAttempt,
  Simulation,
  StandardGroup,
  Standard,
  Topic,
  Profile,
  Schedule,
  User,
  SimulationChatFeedback,
  Agent,
  Model,
  Migration,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  ModelType,
  ProfileRole,
  ReasoningEffort,
  SeniorityLevels,
  SimulationMessageType
};
