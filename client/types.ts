import { 
  accounts as Accounts,
  classes as Classes,
  topics as Topics,
  schedules as Schedules,
  sessions as Sessions,
  events as Events,
  documents as Documents,
  users as Users,
  profiles as Profiles,
  agents as Agents,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  standards as Standards,
  scenarios as Scenarios,
  simulations as Simulations,
  simulationAttempts as SimulationAttempts,
  simulationChats as SimulationChats,
  evalChats as EvalChats,
  simulationMessages as SimulationMessages,
  simulationChatGrades as SimulationChatGrades,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChatGrades as EvalChatGrades,
  evalMessages as EvalMessages,
  evalChatFeedbacks as EvalChatFeedbacks,
  verificationToken as VerificationToken,
  agentType, classTerm, documentType, evalMessageType, evalType, profileRole, rubricType, seniorityLevels
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
type Scenario = typeof Scenarios.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
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
  Class,
  Topic,
  Schedule,
  Session,
  Event,
  Document,
  User,
  Profile,
  Agent,
  Rubric,
  StandardGroup,
  Standard,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  EvalChat,
  SimulationMessage,
  SimulationChatGrade,
  SimulationChatFeedback,
  Eval,
  EvalRun,
  EvalChatGrade,
  EvalMessage,
  EvalChatFeedback,
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
