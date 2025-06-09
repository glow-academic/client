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
  rubricGrades as RubricGrades,
  standardGrades as StandardGrades,
  scenarios as Scenarios,
  simulations as Simulations,
  attempts as Attempts,
  simulationChats as SimulationChats,
  simulationMessages as SimulationMessages,
  evals as Evals,
  evalRuns as EvalRuns,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  agentType, classTerm, documentType, evalType, seniorityLevels, userRole
} from "@/drizzle/schema";

// Use Drizzle schema types
type Users = typeof Users.$inferSelect;
type Classes = typeof Classes.$inferSelect;
type Topics = typeof Topics.$inferSelect;
type Schedules = typeof Schedules.$inferSelect;
type Events = typeof Events.$inferSelect;
type Documents = typeof Documents.$inferSelect;
type Rubrics = typeof Rubrics.$inferSelect;
type StandardGroups = typeof StandardGroups.$inferSelect;
type Agents = typeof Agents.$inferSelect;
type Standards = typeof Standards.$inferSelect;
type RubricGrades = typeof RubricGrades.$inferSelect;
type StandardGrades = typeof StandardGrades.$inferSelect;
type Scenarios = typeof Scenarios.$inferSelect;
type Simulations = typeof Simulations.$inferSelect;
type Attempts = typeof Attempts.$inferSelect;
type SimulationChats = typeof SimulationChats.$inferSelect;
type SimulationMessages = typeof SimulationMessages.$inferSelect;
type Evals = typeof Evals.$inferSelect;
type EvalRuns = typeof EvalRuns.$inferSelect;
type EvalChats = typeof EvalChats.$inferSelect;
type EvalMessages = typeof EvalMessages.$inferSelect;

type AgentType = (typeof agentType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalType = (typeof evalType.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];
type UserRole = (typeof userRole.enumValues)[number];

export type { 
  Users,
  Classes,
  Topics,
  Schedules,
  Events,
  Documents,
  Rubrics,
  StandardGroups,
  Agents,
  Standards,
  RubricGrades,
  StandardGrades,
  Scenarios,
  Simulations,
  Attempts,
  SimulationChats,
  SimulationMessages,
  Evals,
  EvalRuns,
  EvalChats,
  EvalMessages,
  AgentType,
  ClassTerm,
  DocumentType,
  EvalType,
  SeniorityLevels,
  UserRole
};
