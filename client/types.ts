import { 
  account as Account,
  agents as Agents,
  authenticator as Authenticator,
  classes as Classes,
  documents as Documents,
  evalChatFeedbacks as EvalChatFeedbacks,
  evalChatGrades as EvalChatGrades,
  evalChats as EvalChats,
  evalMessages as EvalMessages,
  evalRuns as EvalRuns,
  agentType, classTerm, documentType, evalType, profileRole, rubricType, seniorityLevels
} from "@/drizzle/schema";

// Use Drizzle schema types
type Account = typeof Account.$inferSelect;
type Agent = typeof Agents.$inferSelect;
type Authenticator = typeof Authenticator.$inferSelect;
type Class = typeof Classes.$inferSelect;
type Document = typeof Documents.$inferSelect;
type EvalChatFeedback = typeof EvalChatFeedbacks.$inferSelect;
type EvalChatGrade = typeof EvalChatGrades.$inferSelect;
type EvalChat = typeof EvalChats.$inferSelect;
type EvalMessage = typeof EvalMessages.$inferSelect;
type EvalRun = typeof EvalRuns.$inferSelect;

type AgentType = (typeof agentType.enumValues)[number];
type ClassTerm = (typeof classTerm.enumValues)[number];
type DocumentType = (typeof documentType.enumValues)[number];
type EvalType = (typeof evalType.enumValues)[number];
type ProfileRole = (typeof profileRole.enumValues)[number];
type RubricType = (typeof rubricType.enumValues)[number];
type SeniorityLevels = (typeof seniorityLevels.enumValues)[number];

export type { 
  Account,
  Agent,
  Authenticator,
  Class,
  Document,
  EvalChatFeedback,
  EvalChatGrade,
  EvalChat,
  EvalMessage,
  EvalRun,
  AgentType,
  ClassTerm,
  DocumentType,
  EvalType,
  ProfileRole,
  RubricType,
  SeniorityLevels
};
