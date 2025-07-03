import { 
  accounts as Accounts,
  assistantChats as AssistantChats,
  profiles as Profiles,
  simulationAttempts as SimulationAttempts,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  events as Events,
  cohorts as Cohorts,
  components as Components,
  classes as Classes,
  migrations as Migrations,
  scenarios as Scenarios,
  providers as Providers,
  rubrics as Rubrics,
  sessions as Sessions,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  schedules as Schedules,
  simulationChatGrades as SimulationChatGrades,
  topics as Topics,
  standardGroups as StandardGroups,
  simulations as Simulations,
  standards as Standards,
  models as Models,
  agents as Agents,
  documents as Documents,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  simulationSketches as SimulationSketches,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, locations, modelType, profileRole, reasoningEffort, seniorityLevels, simulationMessageType, timeOfDay, urgencyType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Event = typeof Events.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Model = typeof Models.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Document = typeof Documents.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type SimulationSketche = typeof SimulationSketches.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type Locations = (typeof locations.enumValues)[number];
type ModelType = (typeof modelType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];
type TimeOfDay = (typeof timeOfDay.enumValues)[number];
type UrgencyType = (typeof urgencyType.enumValues)[number];

export type { 
  Account,
  AssistantChat,
  Profile,
  SimulationAttempt,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Event,
  Cohort,
  Component,
  Class,
  Migration,
  Scenario,
  Provider,
  Rubric,
  Session,
  SimulationChat,
  SimulationMessage,
  Schedule,
  SimulationChatGrade,
  Topic,
  StandardGroup,
  Simulation,
  Standard,
  Model,
  Agent,
  Document,
  User,
  SimulationChatFeedback,
  SimulationSketche,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  Locations,
  ModelType,
  ProfileRole,
  ReasoningEffort,
  SeniorityLevels,
  SimulationMessageType,
  TimeOfDay,
  UrgencyType
};
