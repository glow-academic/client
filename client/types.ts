import {
  accounts as Accounts,
  agents as Agents,
  appLogs as AppLogs,
  classes as Classes,
  documents as Documents,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalChatGrades as EvalChatGrades,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalRuns as EvalRuns,
  evals as Evals,
  events as Events,
  profiles as Profiles,
  rubrics as Rubrics,
  scenarios as Scenarios,
  schedules as Schedules,
  sessions as Sessions,
  simulationAttempts as SimulationAttempts,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  simulationChatGrades as SimulationChatGrades,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulations as Simulations,
  standardGroups as StandardGroups,
  standards as Standards,
  topics as Topics,
  users as Users,
  verificationToken as VerificationToken,
  agentType,
  classTerm,
  documentType,
  evalMessageType,
  evalType,
  profileRole,
  rubricType,
  seniorityLevels,
} from "@/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
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
  Agent,
  AgentType,
  AppLog,
  Class,
  ClassTerm,
  Document,
  DocumentType,
  Eval,
  EvalChat,
  EvalChatFeedback,
  EvalChatGrade,
  EvalMessage,
  EvalMessageType,
  EvalRun,
  EvalType,
  Event,
  Profile,
  ProfileRole,
  Rubric,
  RubricType,
  Scenario,
  Schedule,
  SeniorityLevels,
  Session,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatFeedback,
  SimulationChatGrade,
  SimulationMessage,
  Standard,
  StandardGroup,
  Topic,
  User,
  VerificationToken,
};
