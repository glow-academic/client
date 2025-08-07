import { 
  accounts as Accounts,
  appFeedback as AppFeedback,
  rubrics as Rubrics,
  sessions as Sessions,
  assistantChats as AssistantChats,
  appLogs as AppLogs,
  assistantMessages as AssistantMessages,
  assistantToolCalls as AssistantToolCalls,
  parameterItems as ParameterItems,
  cohorts as Cohorts,
  documents as Documents,
  migrations as Migrations,
  models as Models,
  parameters as Parameters,
  providers as Providers,
  personas as Personas,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  scenarios as Scenarios,
  simulationAttempts as SimulationAttempts,
  simulationChatGrades as SimulationChatGrades,
  standardGroups as StandardGroups,
  simulations as Simulations,
  standards as Standards,
  agents as Agents,
  profiles as Profiles,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  verificationToken as VerificationToken,
  assistantMessageType, assistantToolType, documentType, feedbackType, profileRole, reasoningEffort, simulationMessageType
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type AppFeedback = typeof AppFeedback.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type AssistantChat = typeof AssistantChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type AssistantMessage = typeof AssistantMessages.$inferSelect;
type AssistantToolCall = typeof AssistantToolCalls.$inferSelect;
type ParameterItem = typeof ParameterItems.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type Model = typeof Models.$inferSelect;
type Parameter = typeof Parameters.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Persona = typeof Personas.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
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
  AppFeedback,
  Rubric,
  Session,
  AssistantChat,
  AppLog,
  AssistantMessage,
  AssistantToolCall,
  ParameterItem,
  Cohort,
  Document,
  Migration,
  Model,
  Parameter,
  Provider,
  Persona,
  SimulationChat,
  SimulationMessage,
  Scenario,
  SimulationAttempt,
  SimulationChatGrade,
  StandardGroup,
  Simulation,
  Standard,
  Agent,
  Profile,
  User,
  SimulationChatFeedback,
  VerificationToken,
  AssistantMessageType,
  AssistantToolType,
  DocumentType,
  FeedbackType,
  ProfileRole,
  ReasoningEffort,
  SimulationMessageType
};
