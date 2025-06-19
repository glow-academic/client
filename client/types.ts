import { 
  classes as Classes,
  topics as Topics,
  schedules as Schedules,
  events as Events,
  documents as Documents,
  providers as Providers,
  models as Models,
  accounts as Accounts,
  sessions as Sessions,
  users as Users,
  profiles as Profiles,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  standards as Standards,
  appLogs as AppLogs,
  components as Components,
  dashboards as Dashboards,
  simulationMessages as SimulationMessages,
  agents as Agents,
  scenarios as Scenarios,
  cohorts as Cohorts,
  simulations as Simulations,
  simulationAttempts as SimulationAttempts,
  simulationChats as SimulationChats,
  simulationChatGrades as SimulationChatGrades,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalChatGrades as EvalChatGrades,
  evalChatFeedbacks as EvalChatFeedbacks,
  verificationToken as VerificationToken,
  classTerm, documentType, evalMessageType, profileRole, seniorityLevels
} from "@/utils/drizzle/schema";

// Use Drizzle schema types
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Provider = typeof Providers.$inferSelect;
type Model = typeof Models.$inferSelect;
type Account = typeof Accounts.$inferSelect;
type Session = typeof Sessions.$inferSelect;
type User = typeof Users.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type AppLog = typeof AppLogs.$inferSelect;
type Component = typeof Components.$inferSelect;
type Dashboard = typeof Dashboards.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Cohort = typeof Cohorts.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type VerificationToken = typeof VerificationToken.$inferSelect;

type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalMessageType = (typeof evalMessageType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type { 
  Class,
  Topic,
  Schedule,
  Event,
  Document,
  Provider,
  Model,
  Account,
  Session,
  User,
  Profile,
  Rubric,
  StandardGroup,
  Standard,
  AppLog,
  Component,
  Dashboard,
  SimulationMessage,
  Agent,
  Scenario,
  Cohort,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
  SimulationChatFeedback,
  Eval,
  EvalRun,
  EvalChat,
  EvalMessage,
  EvalChatGrade,
  EvalChatFeedback,
  VerificationToken,
  ClassTerm,
  DocumentType,
  EvalMessageType,
  ProfileRole,
  SeniorityLevels
};
