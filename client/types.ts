import { 
  accounts as Accounts,
  appFeedback as AppFeedback,
  profiles as Profiles,
  scenarios as Scenarios,
  assistantChats as AssistantChats,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  components as Components,
  classes as Classes,
  events as Events,
  providers as Providers,
  rubrics as Rubrics,
  sessions as Sessions,
  simulationChats as SimulationChats,
  schedules as Schedules,
  simulationAttempts as SimulationAttempts,
  simulationChatGrades as SimulationChatGrades,
  topics as Topics,
  standardGroups as StandardGroups,
  simulations as Simulations,
  standards as Standards,
  documents as Documents,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  migrations as Migrations,
  agents as Agents,
  simulationMessages as SimulationMessages,
  models as Models,
  cohorts as Cohorts,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, feedbackType, locations, profileRole, reasoningEffort, seniorityLevels, simulationMessageType, timeOfDay, urgencyType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Event = typeof Events.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Document = typeof Documents.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Model = typeof Models.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type FeedbackType = (typeof feedbackType.enumValues)[number];
type Locations = (typeof locations.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];
type TimeOfDay = (typeof timeOfDay.enumValues)[number];
type UrgencyType = (typeof urgencyType.enumValues)[number];

export type { 
  Account,
  AppFeedback,
  Profile,
  Scenario,
  AssistantChat,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Component,
  Class,
  Event,
  Provider,
  Rubric,
  Session,
  SimulationChat,
  Schedule,
  SimulationAttempt,
  SimulationChatGrade,
  Topic,
  StandardGroup,
  Simulation,
  Standard,
  Document,
  User,
  SimulationChatFeedback,
  Migration,
  Agent,
  SimulationMessage,
  Model,
  Cohort,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  FeedbackType,
  Locations,
  ProfileRole,
  ReasoningEffort,
  SeniorityLevels,
  SimulationMessageType,
  TimeOfDay,
  UrgencyType
};
