import { 
  users as Users,
  classes as Classes,
  topics as Topics,
  profiles as Profiles,
  schedules as Schedules,
  events as Events,
  documents as Documents,
  agents as Agents,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  scenarios as Scenarios,
  standards as Standards,
  simulations as Simulations,
  simulationAttempts as SimulationAttempts,
  simulationChatGrades as SimulationChatGrades,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulationChatFeedbacks as SimulationChatFeedbacks,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalChatGrades as EvalChatGrades,
  evalChatFeedbacks as EvalChatFeedbacks,
  agentType, classTerm, documentType, evalType, profileRole, rubricType, seniorityLevels
} from "@/drizzle/schema";

// Use Drizzle schema types
type User = typeof Users.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Profile = typeof Profiles.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChatGrade = typeof SimulationChatGrades.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatFeedback = typeof SimulationChatFeedbacks.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;

type AgentType = (typeof agentType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalType = (typeof evalType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type RubricType = (typeof rubricType.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type { 
  User,
  Class,
  Topic,
  Profile,
  Schedule,
  Event,
  Document,
  Agent,
  Rubric,
  StandardGroup,
  Scenario,
  Standard,
  Simulation,
  SimulationAttempt,
  SimulationChatGrade,
  SimulationChat,
  SimulationMessage,
  SimulationChatFeedback,
  Eval,
  EvalRun,
  EvalChat,
  EvalMessage,
  EvalChatGrade,
  EvalChatFeedback,
  AgentType,
  ClassTerm,
  DocumentType,
  EvalType,
  ProfileRole,
  RubricType,
  SeniorityLevels
};
