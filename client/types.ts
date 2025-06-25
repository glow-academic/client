import { 
  accounts as Accounts,
  assistantChats as AssistantChats,
  providers as Providers,
  simulationMessages as SimulationMessages,
  documents as Documents,
  models as Models,
  rubrics as Rubrics,
  scenarios as Scenarios,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  events as Events,
  cohorts as Cohorts,
  components as Components,
  classes as Classes,
  sessions as Sessions,
  standardGroups as StandardGroups,
  simulationChats as SimulationChats,
  standards as Standards,
  simulationAttempts as SimulationAttempts,
  simulations as Simulations,
  topics as Topics,
  agents as Agents,
  profiles as Profiles,
  schedules as Schedules,
  users as Users,
  migrations as Migrations,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Model = typeof Models.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Event = typeof Events.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type User = typeof Users.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];

export type { 
  Account,
  AssistantChat,
  Provider,
  SimulationMessage,
  Document,
  Model,
  Rubric,
  Scenario,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Event,
  Cohort,
  Component,
  Class,
  Session,
  StandardGroup,
  SimulationChat,
  Standard,
  SimulationAttempt,
  Simulation,
  Topic,
  Agent,
  Profile,
  Schedule,
  User,
  Migration,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  ProfileRole,
  ReasoningEffort,
  SeniorityLevels,
  SimulationMessageType
};
