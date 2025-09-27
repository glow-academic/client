export const agentKeys = {
  all: ["agents"] as const,
  list: (filters?: unknown) => [...agentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...agentKeys.all, String(id)] as const,
};
export const appFeedbackKeys = {
  all: ["app_feedback"] as const,
  list: (filters?: unknown) => [...appFeedbackKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...appFeedbackKeys.all, String(id)] as const,
};
export const appLogKeys = {
  all: ["app_logs"] as const,
  list: (filters?: unknown) => [...appLogKeys.all, { filters }] as const,
  detail: (id: string | number) => [...appLogKeys.all, String(id)] as const,
};
export const assistantChatKeys = {
  all: ["assistant_chats"] as const,
  list: (filters?: unknown) => [...assistantChatKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...assistantChatKeys.all, String(id)] as const,
};
export const assistantMessageKeys = {
  all: ["assistant_messages"] as const,
  list: (filters?: unknown) =>
    [...assistantMessageKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...assistantMessageKeys.all, String(id)] as const,
};
export const assistantToolCallKeys = {
  all: ["assistant_tool_calls"] as const,
  list: (filters?: unknown) =>
    [...assistantToolCallKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...assistantToolCallKeys.all, String(id)] as const,
};
export const cohortKeys = {
  all: ["cohorts"] as const,
  list: (filters?: unknown) => [...cohortKeys.all, { filters }] as const,
  detail: (id: string | number) => [...cohortKeys.all, String(id)] as const,
};
export const debugInfoKeys = {
  all: ["debug_info"] as const,
  list: (filters?: unknown) => [...debugInfoKeys.all, { filters }] as const,
  detail: (id: string | number) => [...debugInfoKeys.all, String(id)] as const,
};
export const documentKeys = {
  all: ["documents"] as const,
  list: (filters?: unknown) => [...documentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...documentKeys.all, String(id)] as const,
};
export const modelRunKeys = {
  all: ["model_runs"] as const,
  list: (filters?: unknown) => [...modelRunKeys.all, { filters }] as const,
  detail: (id: string | number) => [...modelRunKeys.all, String(id)] as const,
};
export const modelKeys = {
  all: ["models"] as const,
  list: (filters?: unknown) => [...modelKeys.all, { filters }] as const,
  detail: (id: string | number) => [...modelKeys.all, String(id)] as const,
};
export const parameterItemKeys = {
  all: ["parameter_items"] as const,
  list: (filters?: unknown) => [...parameterItemKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...parameterItemKeys.all, String(id)] as const,
};
export const parameterKeys = {
  all: ["parameters"] as const,
  list: (filters?: unknown) => [...parameterKeys.all, { filters }] as const,
  detail: (id: string | number) => [...parameterKeys.all, String(id)] as const,
};
export const personaKeys = {
  all: ["personas"] as const,
  list: (filters?: unknown) => [...personaKeys.all, { filters }] as const,
  detail: (id: string | number) => [...personaKeys.all, String(id)] as const,
};
export const profileKeys = {
  all: ["profiles"] as const,
  list: (filters?: unknown) => [...profileKeys.all, { filters }] as const,
  detail: (id: string | number) => [...profileKeys.all, String(id)] as const,
};
export const providerKeys = {
  all: ["providers"] as const,
  list: (filters?: unknown) => [...providerKeys.all, { filters }] as const,
  detail: (id: string | number) => [...providerKeys.all, String(id)] as const,
};
export const rubricKeys = {
  all: ["rubrics"] as const,
  list: (filters?: unknown) => [...rubricKeys.all, { filters }] as const,
  detail: (id: string | number) => [...rubricKeys.all, String(id)] as const,
};
export const scenarioKeys = {
  all: ["scenarios"] as const,
  list: (filters?: unknown) => [...scenarioKeys.all, { filters }] as const,
  detail: (id: string | number) => [...scenarioKeys.all, String(id)] as const,
};
export const simulationAttemptKeys = {
  all: ["simulation_attempts"] as const,
  list: (filters?: unknown) =>
    [...simulationAttemptKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationAttemptKeys.all, String(id)] as const,
};
export const simulationChatCrowdsourcedFeedbackKeys = {
  all: ["simulation_chat_crowdsourced_feedbacks"] as const,
  list: (filters?: unknown) =>
    [...simulationChatCrowdsourcedFeedbackKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationChatCrowdsourcedFeedbackKeys.all, String(id)] as const,
};
export const simulationChatFeedbackKeys = {
  all: ["simulation_chat_feedbacks"] as const,
  list: (filters?: unknown) =>
    [...simulationChatFeedbackKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationChatFeedbackKeys.all, String(id)] as const,
};
export const simulationChatGradeKeys = {
  all: ["simulation_chat_grades"] as const,
  list: (filters?: unknown) =>
    [...simulationChatGradeKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationChatGradeKeys.all, String(id)] as const,
};
export const simulationChatKeys = {
  all: ["simulation_chats"] as const,
  list: (filters?: unknown) =>
    [...simulationChatKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationChatKeys.all, String(id)] as const,
};
export const simulationCrowdsourcedMessageKeys = {
  all: ["simulation_crowdsourced_messages"] as const,
  list: (filters?: unknown) =>
    [...simulationCrowdsourcedMessageKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationCrowdsourcedMessageKeys.all, String(id)] as const,
};
export const simulationMessageKeys = {
  all: ["simulation_messages"] as const,
  list: (filters?: unknown) =>
    [...simulationMessageKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...simulationMessageKeys.all, String(id)] as const,
};
export const simulationKeys = {
  all: ["simulations"] as const,
  list: (filters?: unknown) => [...simulationKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationKeys.all, String(id)] as const,
};
export const standardGroupKeys = {
  all: ["standard_groups"] as const,
  list: (filters?: unknown) => [...standardGroupKeys.all, { filters }] as const,
  detail: (id: string | number) =>
    [...standardGroupKeys.all, String(id)] as const,
};
export const standardKeys = {
  all: ["standards"] as const,
  list: (filters?: unknown) => [...standardKeys.all, { filters }] as const,
  detail: (id: string | number) => [...standardKeys.all, String(id)] as const,
};
export const analyticsLeaderboardKeys = {
  all: ["analytics:leaderboard"] as const,
  list: (filters?: unknown) =>
    [...analyticsLeaderboardKeys.all, { filters }] as const,
};
export const analyticsReportsKeys = {
  all: ["analytics:reports"] as const,
  list: (filters?: unknown) =>
    [...analyticsReportsKeys.all, { filters }] as const,
};
export const analyticsDashboardKeys = {
  all: ["analytics:dashboard"] as const,
  list: (filters?: unknown) =>
    [...analyticsDashboardKeys.all, { filters }] as const,
};
export const analyticsHomeKeys = {
  all: ["analytics:home"] as const,
  list: (filters?: unknown) => [...analyticsHomeKeys.all, { filters }] as const,
};
export const analyticsPracticeKeys = {
  all: ["analytics:practice"] as const,
  list: (filters?: unknown) =>
    [...analyticsPracticeKeys.all, { filters }] as const,
};
export const analyticsHistoryKeys = {
  all: ["analytics:history"] as const,
  list: (filters?: unknown) =>
    [...analyticsHistoryKeys.all, { filters }] as const,
};
export const agentKeysByModelId = {
  one: (id: string | number) => ["agents:by:modelId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["agents:by:modelId:batch", ids.map(String).sort()] as const,
};
export const appFeedbackKeysByProfileId = {
  one: (id: string | number) =>
    ["app_feedback:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["app_feedback:by:profileId:batch", ids.map(String).sort()] as const,
};
export const assistantChatKeysByProfileId = {
  one: (id: string | number) =>
    ["assistant_chats:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["assistant_chats:by:profileId:batch", ids.map(String).sort()] as const,
};
export const assistantMessageKeysByChatId = {
  one: (id: string | number) =>
    ["assistant_messages:by:chatId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["assistant_messages:by:chatId:batch", ids.map(String).sort()] as const,
};
export const assistantToolCallKeysByChatId = {
  one: (id: string | number) =>
    ["assistant_tool_calls:by:chatId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["assistant_tool_calls:by:chatId:batch", ids.map(String).sort()] as const,
};
export const debugInfoKeysByModelRunId = {
  one: (id: string | number) =>
    ["debug_info:by:modelRunId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["debug_info:by:modelRunId:batch", ids.map(String).sort()] as const,
};
export const modelRunKeysByModelId = {
  one: (id: string | number) => ["model_runs:by:modelId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["model_runs:by:modelId:batch", ids.map(String).sort()] as const,
};
export const modelRunKeysByPersonaId = {
  one: (id: string | number) =>
    ["model_runs:by:personaId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["model_runs:by:personaId:batch", ids.map(String).sort()] as const,
};
export const modelRunKeysByAgentId = {
  one: (id: string | number) => ["model_runs:by:agentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["model_runs:by:agentId:batch", ids.map(String).sort()] as const,
};
export const modelRunKeysByProfileId = {
  one: (id: string | number) =>
    ["model_runs:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["model_runs:by:profileId:batch", ids.map(String).sort()] as const,
};
export const parameterItemKeysByParameterId = {
  one: (id: string | number) =>
    ["parameter_items:by:parameterId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["parameter_items:by:parameterId:batch", ids.map(String).sort()] as const,
};
export const personaKeysByModelId = {
  one: (id: string | number) => ["personas:by:modelId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["personas:by:modelId:batch", ids.map(String).sort()] as const,
};
export const profileKeysByUserId = {
  one: (id: string | number) => ["profiles:by:userId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["profiles:by:userId:batch", ids.map(String).sort()] as const,
};
export const scenarioKeysByPersonaId = {
  one: (id: string | number) => ["scenarios:by:personaId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["scenarios:by:personaId:batch", ids.map(String).sort()] as const,
};
export const simulationAttemptKeysByProfileId = {
  one: (id: string | number) =>
    ["simulation_attempts:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulation_attempts:by:profileId:batch", ids.map(String).sort()] as const,
};
export const simulationAttemptKeysBySimulationId = {
  one: (id: string | number) =>
    ["simulation_attempts:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_attempts:by:simulationId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatCrowdsourcedFeedbackKeysByProfileId = {
  one: (id: string | number) =>
    [
      "simulation_chat_crowdsourced_feedbacks:by:profileId",
      String(id),
    ] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_chat_crowdsourced_feedbacks:by:profileId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatCrowdsourcedFeedbackKeysBySimulationChatFeedbackId =
  {
    one: (id: string | number) =>
      [
        "simulation_chat_crowdsourced_feedbacks:by:simulationChatFeedbackId",
        String(id),
      ] as const,
    many: (ids: Array<string | number>) =>
      [
        "simulation_chat_crowdsourced_feedbacks:by:simulationChatFeedbackId:batch",
        ids.map(String).sort(),
      ] as const,
  };
export const simulationChatFeedbackKeysByStandardId = {
  one: (id: string | number) =>
    ["simulation_chat_feedbacks:by:standardId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_chat_feedbacks:by:standardId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatFeedbackKeysBySimulationChatGradeId = {
  one: (id: string | number) =>
    ["simulation_chat_feedbacks:by:simulationChatGradeId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_chat_feedbacks:by:simulationChatGradeId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatGradeKeysByRubricId = {
  one: (id: string | number) =>
    ["simulation_chat_grades:by:rubricId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_chat_grades:by:rubricId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatGradeKeysBySimulationChatId = {
  one: (id: string | number) =>
    ["simulation_chat_grades:by:simulationChatId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_chat_grades:by:simulationChatId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationChatKeysByScenarioId = {
  one: (id: string | number) =>
    ["simulation_chats:by:scenarioId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulation_chats:by:scenarioId:batch", ids.map(String).sort()] as const,
};
export const simulationChatKeysByAttemptId = {
  one: (id: string | number) =>
    ["simulation_chats:by:attemptId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulation_chats:by:attemptId:batch", ids.map(String).sort()] as const,
};
export const simulationCrowdsourcedMessageKeysBySimulationMessageId = {
  one: (id: string | number) =>
    [
      "simulation_crowdsourced_messages:by:simulationMessageId",
      String(id),
    ] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_crowdsourced_messages:by:simulationMessageId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationCrowdsourcedMessageKeysByProfileId = {
  one: (id: string | number) =>
    ["simulation_crowdsourced_messages:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    [
      "simulation_crowdsourced_messages:by:profileId:batch",
      ids.map(String).sort(),
    ] as const,
};
export const simulationMessageKeysByChatId = {
  one: (id: string | number) =>
    ["simulation_messages:by:chatId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulation_messages:by:chatId:batch", ids.map(String).sort()] as const,
};
export const simulationKeysByRubricId = {
  one: (id: string | number) =>
    ["simulations:by:rubricId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulations:by:rubricId:batch", ids.map(String).sort()] as const,
};
export const standardGroupKeysByRubricId = {
  one: (id: string | number) =>
    ["standard_groups:by:rubricId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["standard_groups:by:rubricId:batch", ids.map(String).sort()] as const,
};
export const standardKeysByStandardGroupId = {
  one: (id: string | number) =>
    ["standards:by:standardGroupId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["standards:by:standardGroupId:batch", ids.map(String).sort()] as const,
};

export const migrationKeys = {
  all: ["migrations"] as const,
  list: (filters?: unknown) => [...migrationKeys.all, { filters }] as const,
  detail: (id: string | number) => [...migrationKeys.all, String(id)] as const,
};
