import { 
  appLogs as AppLogs,
  events as Events,
  profiles as Profiles,
  rubrics as Rubrics,
  scenarios as Scenarios,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  simulationChatGrades as SimulationChatGrades,
  users as Users,
  evalMessages as EvalMessages,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalRuns as EvalRuns,
  evals as Evals,
  evalChatGrades as EvalChatGrades,
  accounts as Accounts,
  simulationMessages as SimulationMessages,
  sessions as Sessions,
  simulations as Simulations,
  topics as Topics,
  agents as Agents,
  classes as Classes,
  evalChats as EvalChats,
  schedules as Schedules,
  simulationAttempts as SimulationAttempts,
  standardGroups as StandardGroups,
  standards as Standards,
  documents as Documents,
  simulationChats as SimulationChats,
  drizzleMigrations as DrizzleMigrations,
  verificationToken as VerificationToken,
  agentType, classTerm, documentType, evalMessageType, evalType, profileRole, rubricType, seniorityLevels
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type AppLog = typeof AppLogs.$inferSelect;
type Event = typeof Events.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type User = typeof Users.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type Account = typeof Accounts.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Class = typeof Classes.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Document = typeof Documents.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type DrizzleMigration = typeof DrizzleMigrations.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type AgentType = (typeof agentType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalMessageType = (typeof evalMessageType.enumValues)[number];
type EvalType = (typeof evalType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type RubricType = (typeof rubricType.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type { 
  AppLog,
  Event,
  Profile,
  Rubric,
  Scenario,
  SimulationChatFeedback,
  SimulationChatGrade,
  User,
  EvalMessage,
  EvalChatFeedback,
  EvalRun,
  Eval,
  EvalChatGrade,
  Account,
  SimulationMessage,
  Session,
  Simulation,
  Topic,
  Agent,
  Class,
  EvalChat,
  Schedule,
  SimulationAttempt,
  StandardGroup,
  Standard,
  Document,
  SimulationChat,
  DrizzleMigration,
  VerificationToken,
  AgentType,
  ClassTerm,
  DocumentType,
  EvalMessageType,
  EvalType,
  ProfileRole,
  RubricType,
  SeniorityLevels
};
