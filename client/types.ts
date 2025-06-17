import { 
  accounts as Accounts,
  evals as Evals,
  simulationAttempts as SimulationAttempts,
  sessions as Sessions,
  simulationMessages as SimulationMessages,
  appLogs as AppLogs,
  evalChatGrades as EvalChatGrades,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalChats as EvalChats,
  rubrics as Rubrics,
  agents as Agents,
  events as Events,
  profiles as Profiles,
  evalRuns as EvalRuns,
  classes as Classes,
  evalMessages as EvalMessages,
  simulationChats as SimulationChats,
  scenarios as Scenarios,
  simulationChatGrades as SimulationChatGrades,
  topics as Topics,
  simulations as Simulations,
  standards as Standards,
  standardGroups as StandardGroups,
  documents as Documents,
  schedules as Schedules,
  users as Users,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  migrations as Migrations,
  verificationToken as VerificationToken,
  agentType, classTerm, documentType, evalMessageType, evalType, profileRole, rubricType, seniorityLevels
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Event = typeof Events.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type Class = typeof Classes.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type User = typeof Users.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
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
  Account,
  Eval,
  SimulationAttempt,
  Session,
  SimulationMessage,
  AppLog,
  EvalChatGrade,
  EvalChatFeedback,
  EvalChat,
  Rubric,
  Agent,
  Event,
  Profile,
  EvalRun,
  Class,
  EvalMessage,
  SimulationChat,
  Scenario,
  SimulationChatGrade,
  Topic,
  Simulation,
  Standard,
  StandardGroup,
  Document,
  Schedule,
  User,
  SimulationChatFeedback,
  Migration,
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
