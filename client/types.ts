import { 
  accounts as Accounts,
  evals as Evals,
  providers as Providers,
  simulationChats as SimulationChats,
  appLogs as AppLogs,
  evalChatGrades as EvalChatGrades,
  cohorts as Cohorts,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalChats as EvalChats,
  evalRuns as EvalRuns,
  agents as Agents,
  events as Events,
  models as Models,
  classes as Classes,
  evalMessages as EvalMessages,
  schedules as Schedules,
  profiles as Profiles,
  sessions as Sessions,
  simulationMessages as SimulationMessages,
  standardGroups as StandardGroups,
  simulationChatGrades as SimulationChatGrades,
  simulationAttempts as SimulationAttempts,
  simulations as Simulations,
  topics as Topics,
  users as Users,
  documents as Documents,
  standards as Standards,
  rubrics as Rubrics,
  scenarios as Scenarios,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  migrations as Migrations,
  verificationToken as VerificationToken,
  classTerm, documentType, evalMessageType, profileRole, seniorityLevels
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Accounts.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Event = typeof Events.$inferSelect;
type Model = typeof Models.$inferSelect;
type Class = typeof Classes.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type User = typeof Users.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Migration = typeof Migrations.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalMessageType = (typeof evalMessageType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type { 
  Account,
  Eval,
  Provider,
  SimulationChat,
  AppLog,
  EvalChatGrade,
  Cohort,
  EvalChatFeedback,
  EvalChat,
  EvalRun,
  Agent,
  Event,
  Model,
  Class,
  EvalMessage,
  Schedule,
  Profile,
  Session,
  SimulationMessage,
  StandardGroup,
  SimulationChatGrade,
  SimulationAttempt,
  Simulation,
  Topic,
  User,
  Document,
  Standard,
  Rubric,
  Scenario,
  SimulationChatFeedback,
  Migration,
  VerificationToken,
  ClassTerm,
  DocumentType,
  EvalMessageType,
  ProfileRole,
  SeniorityLevels
};
