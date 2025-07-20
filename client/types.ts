import { 
  accounts as Accounts,
  appFeedback as AppFeedback,
  profiles as Profiles,
  scenarioTimes as ScenarioTimes,
  assistantChats as AssistantChats,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  departments as Departments,
  cohorts as Cohorts,
  dashboards as Dashboards,
  components as Components,
  documents as Documents,
  providers as Providers,
  locations as Locations,
  simulationAttempts as SimulationAttempts,
  scenarioDeadlines as ScenarioDeadlines,
  sessions as Sessions,
  rubrics as Rubrics,
  simulationChatGrades as SimulationChatGrades,
  standardGroups as StandardGroups,
  standards as Standards,
  systemAgents as SystemAgents,
  simulationChats as SimulationChats,
  simulations as Simulations,
  classes as Classes,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  migrations as Migrations,
  models as Models,
  agents as Agents,
  simulationMessages as SimulationMessages,
  scenarios as Scenarios,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, feedbackType, profileRole, reasoningEffort, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type ScenarioTime = typeof ScenarioTimes.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Department = typeof Departments.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Component = typeof Components.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Location = typeof Locations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type ScenarioDeadline = typeof ScenarioDeadlines.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type SystemAgent = typeof SystemAgents.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Class = typeof Classes.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type Model = typeof Models.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type FeedbackType = (typeof feedbackType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type ReasoningEffort = (typeof reasoningEffort.enumValues)[number];
type SimulationMessageType = (typeof simulationMessageType.enumValues)[number];

export type { 
  Account,
  AppFeedback,
  Profile,
  ScenarioTime,
  AssistantChat,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  Department,
  Cohort,
  Dashboard,
  Component,
  Document,
  Provider,
  Location,
  SimulationAttempt,
  ScenarioDeadline,
  Session,
  Rubric,
  SimulationChatGrade,
  StandardGroup,
  Standard,
  SystemAgent,
  SimulationChat,
  Simulation,
  Class,
  User,
  SimulationChatFeedback,
  Migration,
  Model,
  Agent,
  SimulationMessage,
  Scenario,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  ClassTerm,
  DocumentType,
  FeedbackType,
  ProfileRole,
  ReasoningEffort,
  SimulationMessageType
};
