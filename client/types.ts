import { 
  accounts as Accounts,
  sessions as Sessions,
  users as Users,
  profiles as Profiles,
  providers as Providers,
  departments as Departments,
  classes as Classes,
  models as Models,
  locations as Locations,
  documents as Documents,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  standards as Standards,
  appLogs as AppLogs,
  appFeedback as AppFeedback,
  assistantChats as AssistantChats,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  components as Components,
  dashboards as Dashboards,
  agents as Agents,
  scenarios as Scenarios,
  scenarioDeadlines as ScenarioDeadlines,
  scenarioTimes as ScenarioTimes,
  cohorts as Cohorts,
  simulations as Simulations,
  simulationAttempts as SimulationAttempts,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulationChatGrades as SimulationChatGrades,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, classTerm, documentType, feedbackType, profileRole, reasoningEffort, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Department = typeof Departments.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Model = typeof Models.$inferSelect;
type Location = typeof Locations.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Component = typeof Components.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type ScenarioDeadline = typeof ScenarioDeadlines.$inferSelect;
type ScenarioTime = typeof ScenarioTimes.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
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
  Session,
  User,
  Profile,
  Provider,
  Department,
  Class,
  Model,
  Location,
  Document,
  Rubric,
  StandardGroup,
  Standard,
  AppLog,
  AppFeedback,
  AssistantChat,
  AssistantMessage,
  AssistantToolCall,
  Component,
  Dashboard,
  Agent,
  Scenario,
  ScenarioDeadline,
  ScenarioTime,
  Cohort,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationMessage,
  SimulationChatGrade,
  SimulationChatFeedback,
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
