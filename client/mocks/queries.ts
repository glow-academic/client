import * as mockSchema from "@/mocks/schema";
import { vi } from "vitest";

// Generated automatically by generate-mocks.js

// ACCOUNTS QUERIES
vi.mock("@/utils/queries/accounts/get-account", () => ({
  getAccount: vi.fn(() => mockSchema.accounts?.[0] || null),
}));
vi.mock("@/utils/queries/accounts/get-all-accounts", () => ({
  getAllAccounts: vi.fn(() => mockSchema.accounts || []),
}));

// AGENTS QUERIES
vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(() => mockSchema.agents?.[0] || null),
}));
vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() => mockSchema.agents || []),
}));

// APP_LOGS QUERIES
vi.mock("@/utils/queries/app_logs/get-all-app-logs", () => ({
  getAllAppLogs: vi.fn(() => mockSchema.appLogs || []),
}));
vi.mock("@/utils/queries/app_logs/get-app-log", () => ({
  getAppLog: vi.fn(() => mockSchema.appLogs?.[0] || null),
}));

// CLASSES QUERIES
vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(() => mockSchema.classes || []),
}));
vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(() => mockSchema.classes?.[0] || null),
}));

// COHORTS QUERIES
vi.mock("@/utils/queries/cohorts/get-all-cohorts", () => ({
  getAllCohorts: vi.fn(() => mockSchema.cohorts || []),
}));
vi.mock("@/utils/queries/cohorts/get-cohort", () => ({
  getCohort: vi.fn(() => mockSchema.cohorts?.[0] || null),
}));

// DOCUMENTS QUERIES
vi.mock("@/utils/queries/documents/get-all-documents", () => ({
  getAllDocuments: vi.fn(() => mockSchema.documents || []),
}));
vi.mock("@/utils/queries/documents/get-document", () => ({
  getDocument: vi.fn(() => mockSchema.documents?.[0] || null),
}));
vi.mock("@/utils/queries/documents/get-documents-by-class", () => ({
  getDocumentsByClass: vi.fn(() => mockSchema.documents || []),
}));

// EVAL_CHAT_FEEDBACKS QUERIES
vi.mock(
  "@/utils/queries/eval_chat_feedbacks/get-all-eval-chat-feedbacks",
  () => ({
    getAllEvalChatFeedbacks: vi.fn(() => mockSchema.evalChatFeedbacks || []),
  })
);
vi.mock("@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedback", () => ({
  getEvalChatFeedback: vi.fn(() => mockSchema.evalChatFeedbacks?.[0] || null),
}));
vi.mock(
  "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrade",
  () => ({
    getEvalChatFeedbacksByEvalchatgrade: vi.fn(
      () => mockSchema.evalChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades",
  () => ({
    getEvalChatFeedbacksByEvalchatgrades: vi.fn(
      () => mockSchema.evalChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standard",
  () => ({
    getEvalChatFeedbacksByStandard: vi.fn(
      () => mockSchema.evalChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-standards",
  () => ({
    getEvalChatFeedbacksByStandards: vi.fn(
      () => mockSchema.evalChatFeedbacks || []
    ),
  })
);

// EVAL_CHAT_GRADES QUERIES
vi.mock("@/utils/queries/eval_chat_grades/get-all-eval-chat-grades", () => ({
  getAllEvalChatGrades: vi.fn(() => mockSchema.evalChatGrades || []),
}));
vi.mock("@/utils/queries/eval_chat_grades/get-eval-chat-grade", () => ({
  getEvalChatGrade: vi.fn(() => mockSchema.evalChatGrades?.[0] || null),
}));
vi.mock(
  "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchat",
  () => ({
    getEvalChatGradesByEvalchat: vi.fn(() => mockSchema.evalChatGrades || []),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats",
  () => ({
    getEvalChatGradesByEvalchats: vi.fn(() => mockSchema.evalChatGrades || []),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubric",
  () => ({
    getEvalChatGradesByRubric: vi.fn(() => mockSchema.evalChatGrades || []),
  })
);
vi.mock(
  "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-rubrics",
  () => ({
    getEvalChatGradesByRubrics: vi.fn(() => mockSchema.evalChatGrades || []),
  })
);

// EVAL_CHATS QUERIES
vi.mock("@/utils/queries/eval_chats/get-all-eval-chats", () => ({
  getAllEvalChats: vi.fn(() => mockSchema.evalChats || []),
}));
vi.mock("@/utils/queries/eval_chats/get-eval-chat", () => ({
  getEvalChat: vi.fn(() => mockSchema.evalChats?.[0] || null),
}));
vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-evalrun", () => ({
  getEvalChatsByEvalrun: vi.fn(() => mockSchema.evalChats || []),
}));
vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-evalruns", () => ({
  getEvalChatsByEvalruns: vi.fn(() => mockSchema.evalChats || []),
}));
vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-scenario", () => ({
  getEvalChatsByScenario: vi.fn(() => mockSchema.evalChats || []),
}));
vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-scenarios", () => ({
  getEvalChatsByScenarios: vi.fn(() => mockSchema.evalChats || []),
}));

// EVAL_MESSAGES QUERIES
vi.mock("@/utils/queries/eval_messages/get-all-eval-messages", () => ({
  getAllEvalMessages: vi.fn(() => mockSchema.evalMessages || []),
}));
vi.mock("@/utils/queries/eval_messages/get-eval-message", () => ({
  getEvalMessage: vi.fn(() => mockSchema.evalMessages?.[0] || null),
}));
vi.mock("@/utils/queries/eval_messages/get-eval-messages-by-chat", () => ({
  getEvalMessagesByChat: vi.fn(() => mockSchema.evalMessages || []),
}));
vi.mock("@/utils/queries/eval_messages/get-eval-messages-by-chats", () => ({
  getEvalMessagesByChats: vi.fn(() => mockSchema.evalMessages || []),
}));

// EVAL_RUNS QUERIES
vi.mock("@/utils/queries/eval_runs/get-all-eval-runs", () => ({
  getAllEvalRuns: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-run", () => ({
  getEvalRun: vi.fn(() => mockSchema.evalRuns?.[0] || null),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-agent", () => ({
  getEvalRunsByAgent: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-agents", () => ({
  getEvalRunsByAgents: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-eval", () => ({
  getEvalRunsByEval: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-evals", () => ({
  getEvalRunsByEvals: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-rubric", () => ({
  getEvalRunsByRubric: vi.fn(() => mockSchema.evalRuns || []),
}));
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-rubrics", () => ({
  getEvalRunsByRubrics: vi.fn(() => mockSchema.evalRuns || []),
}));

// EVALS QUERIES
vi.mock("@/utils/queries/evals/get-all-evals", () => ({
  getAllEvals: vi.fn(() => mockSchema.evals || []),
}));
vi.mock("@/utils/queries/evals/get-eval", () => ({
  getEval: vi.fn(() => mockSchema.evals?.[0] || null),
}));
vi.mock("@/utils/queries/evals/get-evals-by-baseagent", () => ({
  getEvalsByBaseagent: vi.fn(() => mockSchema.evals || []),
}));
vi.mock("@/utils/queries/evals/get-evals-by-baseagents", () => ({
  getEvalsByBaseagents: vi.fn(() => mockSchema.evals || []),
}));

// EVENTS QUERIES
vi.mock("@/utils/queries/events/get-all-events", () => ({
  getAllEvents: vi.fn(() => mockSchema.events || []),
}));
vi.mock("@/utils/queries/events/get-event", () => ({
  getEvent: vi.fn(() => mockSchema.events?.[0] || null),
}));
vi.mock("@/utils/queries/events/get-events-by-schedule", () => ({
  getEventsBySchedule: vi.fn(() => mockSchema.events || []),
}));
vi.mock("@/utils/queries/events/get-events-by-schedules", () => ({
  getEventsBySchedules: vi.fn(() => mockSchema.events || []),
}));

// MODELS QUERIES
vi.mock("@/utils/queries/models/get-all-models", () => ({
  getAllModels: vi.fn(() => mockSchema.models || []),
}));
vi.mock("@/utils/queries/models/get-model", () => ({
  getModel: vi.fn(() => mockSchema.models?.[0] || null),
}));

// PROFILES QUERIES
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(() => mockSchema.profiles || []),
}));
vi.mock("@/utils/queries/profiles/get-profile", () => ({
  getProfile: vi.fn(() => mockSchema.profiles?.[0] || null),
}));
vi.mock("@/utils/queries/profiles/get-profiles-by-user", () => ({
  getProfilesByUser: vi.fn(() => mockSchema.profiles || []),
}));
vi.mock("@/utils/queries/profiles/get-profiles-by-users", () => ({
  getProfilesByUsers: vi.fn(() => mockSchema.profiles || []),
}));

// PROVIDERS QUERIES
vi.mock("@/utils/queries/providers/get-all-providers", () => ({
  getAllProviders: vi.fn(() => mockSchema.providers || []),
}));
vi.mock("@/utils/queries/providers/get-provider", () => ({
  getProvider: vi.fn(() => mockSchema.providers?.[0] || null),
}));

// RUBRICS QUERIES
vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() => mockSchema.rubrics || []),
}));
vi.mock("@/utils/queries/rubrics/get-rubric", () => ({
  getRubric: vi.fn(() => mockSchema.rubrics?.[0] || null),
}));

// SCENARIOS QUERIES
vi.mock("@/utils/queries/scenarios/get-all-scenarios", () => ({
  getAllScenarios: vi.fn(() => mockSchema.scenarios || []),
}));
vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(() => mockSchema.scenarios?.[0] || null),
}));
vi.mock("@/utils/queries/scenarios/get-scenarios-by-agent", () => ({
  getScenariosByAgent: vi.fn(() => mockSchema.scenarios || []),
}));
vi.mock("@/utils/queries/scenarios/get-scenarios-by-agents", () => ({
  getScenariosByAgents: vi.fn(() => mockSchema.scenarios || []),
}));
vi.mock("@/utils/queries/scenarios/get-scenarios-by-class", () => ({
  getScenariosByClass: vi.fn(() => mockSchema.scenarios || []),
}));

// SCHEDULES QUERIES
vi.mock("@/utils/queries/schedules/get-all-schedules", () => ({
  getAllSchedules: vi.fn(() => mockSchema.schedules || []),
}));
vi.mock("@/utils/queries/schedules/get-schedule", () => ({
  getSchedule: vi.fn(() => mockSchema.schedules?.[0] || null),
}));
vi.mock("@/utils/queries/schedules/get-schedules-by-class", () => ({
  getSchedulesByClass: vi.fn(() => mockSchema.schedules || []),
}));

// SESSIONS QUERIES
vi.mock("@/utils/queries/sessions/get-all-sessions", () => ({
  getAllSessions: vi.fn(() => mockSchema.sessions || []),
}));
vi.mock("@/utils/queries/sessions/get-session", () => ({
  getSession: vi.fn(() => mockSchema.sessions?.[0] || null),
}));

// SIMULATION_ATTEMPTS QUERIES
vi.mock(
  "@/utils/queries/simulation_attempts/get-all-simulation-attempts",
  () => ({
    getAllSimulationAttempts: vi.fn(() => mockSchema.simulationAttempts || []),
  })
);
vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(() => mockSchema.simulationAttempts?.[0] || null),
}));
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profile",
  () => ({
    getSimulationAttemptsByProfile: vi.fn(
      () => mockSchema.simulationAttempts || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
  () => ({
    getSimulationAttemptsByProfiles: vi.fn(
      () => mockSchema.simulationAttempts || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-simulation",
  () => ({
    getSimulationAttemptsBySimulation: vi.fn(
      () => mockSchema.simulationAttempts || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-simulations",
  () => ({
    getSimulationAttemptsBySimulations: vi.fn(
      () => mockSchema.simulationAttempts || []
    ),
  })
);

// SIMULATION_CHAT_FEEDBACKS QUERIES
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks",
  () => ({
    getAllSimulationChatFeedbacks: vi.fn(
      () => mockSchema.simulationChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback",
  () => ({
    getSimulationChatFeedback: vi.fn(
      () => mockSchema.simulationChatFeedbacks?.[0] || null
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrade",
  () => ({
    getSimulationChatFeedbacksBySimulationchatgrade: vi.fn(
      () => mockSchema.simulationChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationchatgrades: vi.fn(
      () => mockSchema.simulationChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standard",
  () => ({
    getSimulationChatFeedbacksByStandard: vi.fn(
      () => mockSchema.simulationChatFeedbacks || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standards",
  () => ({
    getSimulationChatFeedbacksByStandards: vi.fn(
      () => mockSchema.simulationChatFeedbacks || []
    ),
  })
);

// SIMULATION_CHAT_GRADES QUERIES
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades",
  () => ({
    getAllSimulationChatGrades: vi.fn(
      () => mockSchema.simulationChatGrades || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grade",
  () => ({
    getSimulationChatGrade: vi.fn(
      () => mockSchema.simulationChatGrades?.[0] || null
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubric",
  () => ({
    getSimulationChatGradesByRubric: vi.fn(
      () => mockSchema.simulationChatGrades || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics",
  () => ({
    getSimulationChatGradesByRubrics: vi.fn(
      () => mockSchema.simulationChatGrades || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchat",
  () => ({
    getSimulationChatGradesBySimulationchat: vi.fn(
      () => mockSchema.simulationChatGrades || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationchats: vi.fn(
      () => mockSchema.simulationChatGrades || []
    ),
  })
);

// SIMULATION_CHATS QUERIES
vi.mock("@/utils/queries/simulation_chats/get-all-simulation-chats", () => ({
  getAllSimulationChats: vi.fn(() => mockSchema.simulationChats || []),
}));
vi.mock("@/utils/queries/simulation_chats/get-simulation-chat", () => ({
  getSimulationChat: vi.fn(() => mockSchema.simulationChats?.[0] || null),
}));
vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt",
  () => ({
    getSimulationChatsByAttempt: vi.fn(() => mockSchema.simulationChats || []),
  })
);
vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(() => mockSchema.simulationChats || []),
  })
);
vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-scenario",
  () => ({
    getSimulationChatsByScenario: vi.fn(() => mockSchema.simulationChats || []),
  })
);
vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-scenarios",
  () => ({
    getSimulationChatsByScenarios: vi.fn(
      () => mockSchema.simulationChats || []
    ),
  })
);

// SIMULATION_MESSAGES QUERIES
vi.mock(
  "@/utils/queries/simulation_messages/get-all-simulation-messages",
  () => ({
    getAllSimulationMessages: vi.fn(() => mockSchema.simulationMessages || []),
  })
);
vi.mock("@/utils/queries/simulation_messages/get-simulation-message", () => ({
  getSimulationMessage: vi.fn(() => mockSchema.simulationMessages?.[0] || null),
}));
vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-chat",
  () => ({
    getSimulationMessagesByChat: vi.fn(
      () => mockSchema.simulationMessages || []
    ),
  })
);
vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-chats",
  () => ({
    getSimulationMessagesByChats: vi.fn(
      () => mockSchema.simulationMessages || []
    ),
  })
);

// SIMULATIONS QUERIES
vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(() => mockSchema.simulations || []),
}));
vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(() => mockSchema.simulations?.[0] || null),
}));
vi.mock("@/utils/queries/simulations/get-simulations-by-rubric", () => ({
  getSimulationsByRubric: vi.fn(() => mockSchema.simulations || []),
}));
vi.mock("@/utils/queries/simulations/get-simulations-by-rubrics", () => ({
  getSimulationsByRubrics: vi.fn(() => mockSchema.simulations || []),
}));

// STANDARD_GROUPS QUERIES
vi.mock("@/utils/queries/standard_groups/get-all-standard-groups", () => ({
  getAllStandardGroups: vi.fn(() => mockSchema.standardGroups || []),
}));
vi.mock("@/utils/queries/standard_groups/get-standard-group", () => ({
  getStandardGroup: vi.fn(() => mockSchema.standardGroups?.[0] || null),
}));
vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubric",
  () => ({
    getStandardGroupsByRubric: vi.fn(() => mockSchema.standardGroups || []),
  })
);
vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(() => mockSchema.standardGroups || []),
  })
);

// STANDARDS QUERIES
vi.mock("@/utils/queries/standards/get-all-standards", () => ({
  getAllStandards: vi.fn(() => mockSchema.standards || []),
}));
vi.mock("@/utils/queries/standards/get-standard", () => ({
  getStandard: vi.fn(() => mockSchema.standards?.[0] || null),
}));
vi.mock("@/utils/queries/standards/get-standards-by-standardgroup", () => ({
  getStandardsByStandardgroup: vi.fn(() => mockSchema.standards || []),
}));
vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardgroups: vi.fn(() => mockSchema.standards || []),
}));

// TOPICS QUERIES
vi.mock("@/utils/queries/topics/get-all-topics", () => ({
  getAllTopics: vi.fn(() => mockSchema.topics || []),
}));
vi.mock("@/utils/queries/topics/get-topic", () => ({
  getTopic: vi.fn(() => mockSchema.topics?.[0] || null),
}));
vi.mock("@/utils/queries/topics/get-topics-by-class", () => ({
  getTopicsByClass: vi.fn(() => mockSchema.topics || []),
}));

// USERS QUERIES
vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(() => mockSchema.users || []),
}));
vi.mock("@/utils/queries/users/get-user", () => ({
  getUser: vi.fn(() => mockSchema.users?.[0] || null),
}));

// VERIFICATION_TOKEN QUERIES
vi.mock(
  "@/utils/queries/verification_token/get-all-verification-token",
  () => ({
    getAllVerificationToken: vi.fn(() => mockSchema.verificationToken || []),
  })
);
