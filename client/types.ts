import { 
  users as Users,
  classes as Classes,
  topics as Topics,
  schedules as Schedules,
  events as Events,
  documents as Documents,
  rubrics as Rubrics,
  standardGroups as StandardGroups,
  agents as Agents,
  standards as Standards,
  simulations as Simulations,
  scenarios as Scenarios,
  simulationAttempts as SimulationAttempts,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  simulationChatRubrics as SimulationChatRubrics,
  simulationChatStandards as SimulationChatStandards,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalChatRubrics as EvalChatRubrics,
  evalChatStandards as EvalChatStandards,
  agentType, classTerm, documentType, evalType, seniorityLevels, userRole
} from "@/drizzle/schema";

// Use Drizzle schema types
type User = typeof Users.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Topic = typeof Topics.$inferSelect;
type Schedule = typeof Schedules.$inferSelect;
type Event = typeof Events.$inferSelect;
type Document = typeof Documents.$inferSelect;
type Rubric = typeof Rubrics.$inferSelect;
type StandardGroup = typeof StandardGroups.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Standard = typeof Standards.$inferSelect;
type Simulation = typeof Simulations.$inferSelect;
type Scenario = typeof Scenarios.$inferSelect;
type SimulationAttempt = typeof SimulationAttempts.$inferSelect;
type SimulationChat = typeof SimulationChats.$inferSelect;
type SimulationMessage = typeof SimulationMessages.$inferSelect;
type SimulationChatRubric = typeof SimulationChatRubrics.$inferSelect;
type SimulationChatStandard = typeof SimulationChatStandards.$inferSelect;
type Eval = typeof Evals.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalChatRubric = typeof EvalChatRubrics.$inferSelect;
type EvalChatStandard = typeof EvalChatStandards.$inferSelect;

type AgentType = (typeof agentType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalType = (typeof evalType.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type UserRole = (typeof userRole.enumValues)[number];

export type { 
  User,
  Class,
  Topic,
  Schedule,
  Event,
  Document,
  Rubric,
  StandardGroup,
  Agent,
  Standard,
  Simulation,
  Scenario,
  SimulationAttempt,
  SimulationChat,
  SimulationMessage,
  SimulationChatRubric,
  SimulationChatStandard,
  Eval,
  EvalRun,
  EvalChat,
  EvalMessage,
  EvalChatRubric,
  EvalChatStandard,
  AgentType,
  ClassTerm,
  DocumentType,
  EvalType,
  SeniorityLevels,
  UserRole
};
