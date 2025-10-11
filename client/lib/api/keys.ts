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

// New analytics keys for header metrics
export const analyticsAverageScoreKeys = {
  all: ["analytics:header:average-score"] as const,
  list: (filters?: unknown) =>
    [...analyticsAverageScoreKeys.all, { filters }] as const,
};
export const analyticsCompletionPercentageKeys = {
  all: ["analytics:header:completion-percentage"] as const,
  list: (filters?: unknown) =>
    [...analyticsCompletionPercentageKeys.all, { filters }] as const,
};
export const analyticsFirstAttemptPassRateKeys = {
  all: ["analytics:header:first-attempt-pass-rate"] as const,
  list: (filters?: unknown) =>
    [...analyticsFirstAttemptPassRateKeys.all, { filters }] as const,
};
export const analyticsHighestScoreKeys = {
  all: ["analytics:header:highest-score"] as const,
  list: (filters?: unknown) =>
    [...analyticsHighestScoreKeys.all, { filters }] as const,
};
export const analyticsMessagesPerSessionKeys = {
  all: ["analytics:header:messages-per-session"] as const,
  list: (filters?: unknown) =>
    [...analyticsMessagesPerSessionKeys.all, { filters }] as const,
};
export const analyticsPersonaResponseTimesKeys = {
  all: ["analytics:header:persona-response-times"] as const,
  list: (filters?: unknown) =>
    [...analyticsPersonaResponseTimesKeys.all, { filters }] as const,
};
export const analyticsSessionEfficiencyKeys = {
  all: ["analytics:header:session-efficiency"] as const,
  list: (filters?: unknown) =>
    [...analyticsSessionEfficiencyKeys.all, { filters }] as const,
};
export const analyticsStagnationRateKeys = {
  all: ["analytics:header:stagnation-rate"] as const,
  list: (filters?: unknown) =>
    [...analyticsStagnationRateKeys.all, { filters }] as const,
};
export const analyticsTimeSpentKeys = {
  all: ["analytics:header:time-spent"] as const,
  list: (filters?: unknown) =>
    [...analyticsTimeSpentKeys.all, { filters }] as const,
};
export const analyticsTotalAttemptsKeys = {
  all: ["analytics:header:total-attempts"] as const,
  list: (filters?: unknown) =>
    [...analyticsTotalAttemptsKeys.all, { filters }] as const,
};

export const analyticsRubricHeatmapKeys = {
  all: ["analytics:primary:rubric-heatmap"] as const,
  list: (filters?: unknown) =>
    [...analyticsRubricHeatmapKeys.all, { filters }] as const,
};
export const analyticsGrowthDataKeys = {
  all: ["analytics:primary:growth-data"] as const,
  list: (filters?: unknown) =>
    [...analyticsGrowthDataKeys.all, { filters }] as const,
};
export const analyticsPersonaPerformanceKeys = {
  all: ["analytics:primary:persona-performance"] as const,
  list: (filters?: unknown) =>
    [...analyticsPersonaPerformanceKeys.all, { filters }] as const,
};

// Secondary Analytics Keys
export const analyticsAttemptImprovementKeys = {
  all: ["analytics:secondary:attempt-improvement"] as const,
  list: (filters?: unknown) =>
    [...analyticsAttemptImprovementKeys.all, { filters }] as const,
};

export const analyticsCohortPerformanceKeys = {
  all: ["analytics:secondary:cohort-performance"] as const,
  list: (filters?: unknown) =>
    [...analyticsCohortPerformanceKeys.all, { filters }] as const,
};

export const analyticsSkillPerformanceKeys = {
  all: ["analytics:secondary:skill-performance"] as const,
  list: (filters?: unknown) =>
    [...analyticsSkillPerformanceKeys.all, { filters }] as const,
};

// Footer Analytics Keys
export const analyticsScenarioPerformanceKeys = {
  all: ["analytics:footer:scenario-performance"] as const,
  list: (filters?: unknown) =>
    [...analyticsScenarioPerformanceKeys.all, { filters }] as const,
};

export const analyticsScenarioStatsKeys = {
  all: ["analytics:footer:scenario-stats"] as const,
  list: (filters?: unknown) =>
    [...analyticsScenarioStatsKeys.all, { filters }] as const,
};

export const analyticsSimulationCompositionKeys = {
  all: ["analytics:footer:simulation-composition"] as const,
  list: (filters?: unknown) =>
    [...analyticsSimulationCompositionKeys.all, { filters }] as const,
};

export const analyticsSimulationPerformanceKeys = {
  all: ["analytics:footer:simulation-performance"] as const,
  list: (filters?: unknown) =>
    [...analyticsSimulationPerformanceKeys.all, { filters }] as const,
};

// Home Analytics Keys
export const analyticsHomeOverviewKeys = {
  all: ["analytics:home:overview"] as const,
  list: (filters?: unknown) =>
    [...analyticsHomeOverviewKeys.all, { filters }] as const,
};

// Practice Analytics Keys
export const analyticsPracticeOverviewKeys = {
  all: ["analytics:practice:overview"] as const,
  list: (filters?: unknown) =>
    [...analyticsPracticeOverviewKeys.all, { filters }] as const,
};

// History Analytics Keys
export const analyticsAttemptHistoryKeys = {
  all: ["analytics:history:attempt-history"] as const,
  list: (filters?: unknown) =>
    [...analyticsAttemptHistoryKeys.all, { filters }] as const,
};

// Refresh Analytics Keys
export const analyticsRefreshKeys = {
  all: ["analytics:refresh"] as const,
};

// Reports Bundle Analytics Keys
export const analyticsReportsBundleKeys = {
  all: ["analytics:reports:bundle"] as const,
  list: (filters?: unknown) =>
    [...analyticsReportsBundleKeys.all, { filters }] as const,
};

// Leaderboard Bundle Analytics Keys
export const analyticsLeaderboardBundleKeys = {
  all: ["analytics:leaderboard:bundle"] as const,
  list: (filters?: unknown) =>
    [...analyticsLeaderboardBundleKeys.all, { filters }] as const,
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

export const departmentKeys = {
  all: ["departments"] as const,
  list: (filters?: unknown) => [...departmentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...departmentKeys.all, String(id)] as const,
};
export const cohortKeysByDepartmentId = {
  one: (id: string | number) =>
    ["cohorts:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["cohorts:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const documentKeysByDepartmentId = {
  one: (id: string | number) =>
    ["documents:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["documents:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const modelRunKeysByDepartmentId = {
  one: (id: string | number) =>
    ["model_runs:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["model_runs:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const parameterKeysByDepartmentId = {
  one: (id: string | number) =>
    ["parameters:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["parameters:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const personaKeysByDepartmentId = {
  one: (id: string | number) =>
    ["personas:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["personas:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const profileKeysByDepartmentId = {
  one: (id: string | number) =>
    ["profiles:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["profiles:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const providerKeysByDepartmentId = {
  one: (id: string | number) =>
    ["providers:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["providers:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const rubricKeysByDepartmentId = {
  one: (id: string | number) =>
    ["rubrics:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["rubrics:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const scenarioKeysByDepartmentId = {
  one: (id: string | number) =>
    ["scenarios:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["scenarios:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const simulationKeysByDepartmentId = {
  one: (id: string | number) =>
    ["simulations:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["simulations:by:departmentId:batch", ids.map(String).sort()] as const,
};

export const agentKeysByDepartmentId = {
  one: (id: string | number) => ["agents:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["agents:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const modelKeysByProviderId = {
  one: (id: string | number) => ["models:by:providerId", String(id)] as const,
  many: (ids: Array<string | number>) =>
    ["models:by:providerId:batch", ids.map(String).sort()] as const,
};

export const simulationHintKeys = {
  all: ["simulation_hints"] as const,
  list: (filters?: unknown) => [...simulationHintKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationHintKeys.all, String(id)] as const,
};
export const simulationHintKeysBySimulationMessageId = {
  one: (id: string | number) => ["simulation_hints:by:simulationMessageId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_hints:by:simulationMessageId:batch", ids.map(String).sort()] as const,
};
export const cohortProfileKeys = {
  all: ["cohort_profiles"] as const,
  list: (filters?: unknown) => [...cohortProfileKeys.all, { filters }] as const,
  detail: (id: string | number) => [...cohortProfileKeys.all, String(id)] as const,
};
export const cohortSimulationKeys = {
  all: ["cohort_simulations"] as const,
  list: (filters?: unknown) => [...cohortSimulationKeys.all, { filters }] as const,
  detail: (id: string | number) => [...cohortSimulationKeys.all, String(id)] as const,
};
export const departmentAgentKeys = {
  all: ["department_agents"] as const,
  list: (filters?: unknown) => [...departmentAgentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...departmentAgentKeys.all, String(id)] as const,
};
export const profileDepartmentKeys = {
  all: ["profile_departments"] as const,
  list: (filters?: unknown) => [...profileDepartmentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...profileDepartmentKeys.all, String(id)] as const,
};
export const scenarioDocumentKeys = {
  all: ["scenario_documents"] as const,
  list: (filters?: unknown) => [...scenarioDocumentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...scenarioDocumentKeys.all, String(id)] as const,
};
export const scenarioObjectiveKeys = {
  all: ["scenario_objectives"] as const,
  list: (filters?: unknown) => [...scenarioObjectiveKeys.all, { filters }] as const,
  detail: (id: string | number) => [...scenarioObjectiveKeys.all, String(id)] as const,
};
export const scenarioParameterItemKeys = {
  all: ["scenario_parameter_items"] as const,
  list: (filters?: unknown) => [...scenarioParameterItemKeys.all, { filters }] as const,
  detail: (id: string | number) => [...scenarioParameterItemKeys.all, String(id)] as const,
};
export const scenarioTreeKeys = {
  all: ["scenario_tree"] as const,
  list: (filters?: unknown) => [...scenarioTreeKeys.all, { filters }] as const,
  detail: (id: string | number) => [...scenarioTreeKeys.all, String(id)] as const,
};
export const simulationScenarioKeys = {
  all: ["simulation_scenarios"] as const,
  list: (filters?: unknown) => [...simulationScenarioKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationScenarioKeys.all, String(id)] as const,
};
export const simulationTagDocumentKeys = {
  all: ["simulation_tag_documents"] as const,
  list: (filters?: unknown) => [...simulationTagDocumentKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationTagDocumentKeys.all, String(id)] as const,
};
export const simulationTagParameterItemKeys = {
  all: ["simulation_tag_parameter_items"] as const,
  list: (filters?: unknown) => [...simulationTagParameterItemKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationTagParameterItemKeys.all, String(id)] as const,
};
export const simulationTagKeys = {
  all: ["simulation_tags"] as const,
  list: (filters?: unknown) => [...simulationTagKeys.all, { filters }] as const,
  detail: (id: string | number) => [...simulationTagKeys.all, String(id)] as const,
};
export const cohortProfileKeysByCohortId = {
  one: (id: string | number) => ["cohort_profiles:by:cohortId", String(id)] as const,
  many: (ids: Array<string | number>) => ["cohort_profiles:by:cohortId:batch", ids.map(String).sort()] as const,
};
export const cohortProfileKeysByProfileId = {
  one: (id: string | number) => ["cohort_profiles:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) => ["cohort_profiles:by:profileId:batch", ids.map(String).sort()] as const,
};
export const cohortSimulationKeysByCohortId = {
  one: (id: string | number) => ["cohort_simulations:by:cohortId", String(id)] as const,
  many: (ids: Array<string | number>) => ["cohort_simulations:by:cohortId:batch", ids.map(String).sort()] as const,
};
export const cohortSimulationKeysBySimulationId = {
  one: (id: string | number) => ["cohort_simulations:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) => ["cohort_simulations:by:simulationId:batch", ids.map(String).sort()] as const,
};
export const departmentAgentKeysByDepartmentId = {
  one: (id: string | number) => ["department_agents:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["department_agents:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const departmentAgentKeysByAgentId = {
  one: (id: string | number) => ["department_agents:by:agentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["department_agents:by:agentId:batch", ids.map(String).sort()] as const,
};
export const profileDepartmentKeysByProfileId = {
  one: (id: string | number) => ["profile_departments:by:profileId", String(id)] as const,
  many: (ids: Array<string | number>) => ["profile_departments:by:profileId:batch", ids.map(String).sort()] as const,
};
export const profileDepartmentKeysByDepartmentId = {
  one: (id: string | number) => ["profile_departments:by:departmentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["profile_departments:by:departmentId:batch", ids.map(String).sort()] as const,
};
export const scenarioDocumentKeysByScenarioId = {
  one: (id: string | number) => ["scenario_documents:by:scenarioId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_documents:by:scenarioId:batch", ids.map(String).sort()] as const,
};
export const scenarioDocumentKeysByDocumentId = {
  one: (id: string | number) => ["scenario_documents:by:documentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_documents:by:documentId:batch", ids.map(String).sort()] as const,
};
export const scenarioObjectiveKeysByScenarioId = {
  one: (id: string | number) => ["scenario_objectives:by:scenarioId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_objectives:by:scenarioId:batch", ids.map(String).sort()] as const,
};
export const scenarioParameterItemKeysByScenarioId = {
  one: (id: string | number) => ["scenario_parameter_items:by:scenarioId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_parameter_items:by:scenarioId:batch", ids.map(String).sort()] as const,
};
export const scenarioParameterItemKeysByParameterItemId = {
  one: (id: string | number) => ["scenario_parameter_items:by:parameterItemId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_parameter_items:by:parameterItemId:batch", ids.map(String).sort()] as const,
};
export const scenarioTreeKeysByParentId = {
  one: (id: string | number) => ["scenario_tree:by:parentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_tree:by:parentId:batch", ids.map(String).sort()] as const,
};
export const scenarioTreeKeysByChildId = {
  one: (id: string | number) => ["scenario_tree:by:childId", String(id)] as const,
  many: (ids: Array<string | number>) => ["scenario_tree:by:childId:batch", ids.map(String).sort()] as const,
};
export const simulationScenarioKeysBySimulationId = {
  one: (id: string | number) => ["simulation_scenarios:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_scenarios:by:simulationId:batch", ids.map(String).sort()] as const,
};
export const simulationScenarioKeysByScenarioId = {
  one: (id: string | number) => ["simulation_scenarios:by:scenarioId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_scenarios:by:scenarioId:batch", ids.map(String).sort()] as const,
};
export const simulationTagDocumentKeysByDocumentId = {
  one: (id: string | number) => ["simulation_tag_documents:by:documentId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_tag_documents:by:documentId:batch", ids.map(String).sort()] as const,
};
export const simulationTagDocumentKeysBySimulationId = {
  one: (id: string | number) => ["simulation_tag_documents:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_tag_documents:by:simulationId:batch", ids.map(String).sort()] as const,
};
export const simulationTagParameterItemKeysByParameterItemId = {
  one: (id: string | number) => ["simulation_tag_parameter_items:by:parameterItemId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_tag_parameter_items:by:parameterItemId:batch", ids.map(String).sort()] as const,
};
export const simulationTagParameterItemKeysBySimulationId = {
  one: (id: string | number) => ["simulation_tag_parameter_items:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_tag_parameter_items:by:simulationId:batch", ids.map(String).sort()] as const,
};
export const simulationTagKeysBySimulationId = {
  one: (id: string | number) => ["simulation_tags:by:simulationId", String(id)] as const,
  many: (ids: Array<string | number>) => ["simulation_tags:by:simulationId:batch", ids.map(String).sort()] as const,
};