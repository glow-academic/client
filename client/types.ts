import { 
  accounts as Accounts,
  appFeedback as AppFeedback,
  migrations as Migrations,
  simulationAttempts as SimulationAttempts,
  assistantChats as AssistantChats,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  dashboards as Dashboards,
  cohorts as Cohorts,
  components as Components,
  classes as Classes,
  agents as Agents,
  profiles as Profiles,
  events as Events,
  providers as Providers,
  scenarios as Scenarios,
  sessions as Sessions,
  rubrics as Rubrics,
  schedules as Schedules,
  simulationChatGrades as SimulationChatGrades,
  standardGroups as StandardGroups,
  standards as Standards,
  topics as Topics,
  simulationChats as SimulationChats,
  simulations as Simulations,
  documents as Documents,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  models as Models,
  simulationMessages as SimulationMessages,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, feedbackType, locations, profileRole, reasoningEffort, seniorityLevels, simulationMessageType, timeOfDay, urgencyType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Component = typeof Components.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Event = typeof Events.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Document = typeof Documents.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Model = typeof Models.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
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
  Migration,
  SimulationAttempt,
  AssistantChat,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Dashboard,
  Cohort,
  Component,
  Class,
  Agent,
  Profile,
  Event,
  Provider,
  Scenario,
  Session,
  Rubric,
  Schedule,
  SimulationChatGrade,
  StandardGroup,
  Standard,
  Topic,
  SimulationChat,
  Simulation,
  Document,
  User,
  SimulationChatFeedback,
  Model,
  SimulationMessage,
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
