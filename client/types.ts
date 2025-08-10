import { 
  accounts as Accounts,
  sessions as Sessions,
  users as Users,
  profiles as Profiles,
  providers as Providers,
  modelRuns as ModelRuns,
  documents as Documents,
  models as Models,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  standards as Standards,
  appLogs as AppLogs,
  appFeedback as AppFeedback,
  assistantMessages as AssistantMessages,
  assistantChats as AssistantChats,
  assistantToolCalls as AssistantToolCalls,
  personas as Personas,
  agents as Agents,
  simulationAttempts as SimulationAttempts,
  parameters as Parameters,
  parameterItems as ParameterItems,
  scenarios as Scenarios,
  simulationChats as SimulationChats,
  simulations as Simulations,
  simulationMessages as SimulationMessages,
  simulationChatGrades as SimulationChatGrades,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  cohorts as Cohorts,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, documentType, feedbackType, profileRole, reasoningEffort, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type ModelRun = typeof ModelRuns.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Model = typeof Models.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type Persona = typeof Personas.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Parameter = typeof Parameters.$inferSelect;
type ParameterItem = typeof ParameterItems.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AssistantMessageType = (typeof assistantMessageType.enumValues)[number];
type AssistantToolType = (typeof assistantToolType.enumValues)[number];
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
  ModelRun,
  Document,
  Model,
  Rubric,
  StandardGroup,
  Standard,
  AppLog,
  AppFeedback,
  AssistantMessage,
  AssistantChat,
  AssistantToolCall,
  Persona,
  Agent,
  SimulationAttempt,
  Parameter,
  ParameterItem,
  Scenario,
  SimulationChat,
  Simulation,
  SimulationMessage,
  SimulationChatGrade,
  SimulationChatFeedback,
  Cohort,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  DocumentType,
  FeedbackType,
  ProfileRole,
  ReasoningEffort,
  SimulationMessageType
};
