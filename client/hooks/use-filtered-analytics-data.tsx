import type { SimulationFilter } from "@/contexts/analytics-context";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useAgents } from "@/lib/api/hooks/agents";
import { useCohorts } from "@/lib/api/hooks/cohorts";
import { useParameterItems } from "@/lib/api/hooks/parameter_items";
import { useParameters } from "@/lib/api/hooks/parameters";
import { usePersonas } from "@/lib/api/hooks/personas";
import { useProfiles } from "@/lib/api/hooks/profiles";
import { useScenarios } from "@/lib/api/hooks/scenarios";
import { useSimulationChatsByAttemptIdBatch } from "@/lib/api/hooks/simulation_chats";
import { useSimulationAttemptsByProfileIdBatch } from "@/lib/api/hooks/simulation_attempts";
import { useSimulations } from "@/lib/api/hooks/simulations";
import type { ProfileRole, SimulationMessage } from "@/types";
import {
  filterAnalyticsData,
  type FilteredData,
} from "@/utils/analytics/filtering";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSimulationChatGradesBySimulationChatIdBatch } from "@/lib/api/hooks/simulation_chat_grades";
import { useSimulationChatFeedbacksBySimulationChatGradeIdBatch } from "@/lib/api/hooks/simulation_chat_feedbacks";
import { useRubrics } from "@/lib/api/hooks/rubrics";
import { useStandardGroupsByRubricIdBatch } from "@/lib/api/hooks/standard_groups";
import { useStandardsByStandardGroupIdBatch } from "@/lib/api/hooks/standards";

export interface UseFilteredAnalyticsDataOptions {
  // Optional profile-specific filtering
  profileId?: string;

  // Optional cohort-specific filtering (overrides context)
  cohortIds?: string[];

  // Optional role filtering (overrides context)
  roles?: ProfileRole[];

  // Optional simulation filters (overrides context)
  simulationFilters?: SimulationFilter[];
}

export function useFilteredAnalyticsData(
  options: UseFilteredAnalyticsDataOptions = {}
) {
  const { effectiveProfile } = useProfile();
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Use provided options or fall back to context values
  const effectiveCohortIds = options.cohortIds ?? selectedCohortIds;
  const effectiveRoles = options.roles ?? selectedRoles;
  const effectiveSimulationFilters =
    options.simulationFilters ?? simulationFilters;
  const effectiveProfileId = options.profileId;

  // Fetch all raw data
  const { data: allProfiles = [], isLoading: isLoadingProfiles } =
    useProfiles();
  const { data: allCohorts = [], isLoading: isLoadingCohorts } = useCohorts();
  const { data: allSimulations = [], isLoading: isLoadingSimulations } =
    useSimulations();
  const { data: allScenarios = [], isLoading: isLoadingScenarios } =
    useScenarios();
  const { data: allParameters = [], isLoading: isLoadingParameters } =
    useParameters();
  const { data: allParameterItems = [], isLoading: isLoadingParameterItems } =
    useParameterItems();
  const { data: allPersonas = [], isLoading: isLoadingPersonas } =
    usePersonas();
  const { data: allAgents = [], isLoading: isLoadingAgents } = useAgents();
  const { data: allAttempts = [], isLoading: isLoadingAttempts } =
    useSimulationAttemptsByProfileIdBatch(allProfiles.map((p) => p.id));
  const { data: allChats = [], isLoading: isLoadingChats } =
    useSimulationChatsByAttemptIdBatch(allAttempts.map((a) => a.id));
  const { data: allGrades = [], isLoading: isLoadingGrades } =
    useSimulationChatGradesBySimulationChatIdBatch(allChats.map((c) => c.id));
  const { data: allFeedbacks = [], isLoading: isLoadingFeedbacks } =
    useSimulationChatFeedbacksBySimulationChatGradeIdBatch(
      allGrades.map((g) => g.id)
    );
  const { data: rubrics = [], isLoading: isLoadingRubrics } = useRubrics();
  const { data: standardGroups = [], isLoading: isLoadingStandardGroups } =
    useStandardGroupsByRubricIdBatch(rubrics.map((r) => r.id));

  const { data: standards = [], isLoading: isLoadingStandards } =
    useStandardsByStandardGroupIdBatch(standardGroups.map((g) => g.id));

  // Apply centralized filtering (include rubrics/standards)
  const filteredDataBase = useMemo((): FilteredData | null => {
    if (!effectiveProfile) return null;

    return filterAnalyticsData({
      startDate,
      endDate,
      cohortIds: effectiveCohortIds,
      roles: effectiveRoles,
      simulationFilters: effectiveSimulationFilters,
      profileId: effectiveProfileId,
      allAttempts,
      allChats,
      allGrades,
      allFeedbacks,
      allSimulations,
      allScenarios,
      allProfiles,
      allCohorts,
      allParameters,
      allParameterItems,
      allPersonas,
      allAgents,
      allRubrics: rubrics,
      allStandardGroups: standardGroups,
      allStandards: standards,
    });
  }, [
    startDate,
    endDate,
    effectiveCohortIds,
    effectiveRoles,
    effectiveSimulationFilters,
    effectiveProfileId,
    allAttempts,
    allChats,
    allGrades,
    allFeedbacks,
    allSimulations,
    allScenarios,
    allProfiles,
    allCohorts,
    allParameters,
    allParameterItems,
    allPersonas,
    allAgents,
    rubrics,
    standardGroups,
    standards,
    effectiveProfile,
  ]);

  const chatIdsForMessages = useMemo(
    () => (filteredDataBase?.chats ?? []).map((c) => c.id),
    [filteredDataBase?.chats]
  );

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<
    SimulationMessage[]
  >({
    queryKey: ["simulationMessages", chatIdsForMessages],
    queryFn: () =>
      chatIdsForMessages.length > 0
        ? getSimulationMessagesByChats(chatIdsForMessages)
        : Promise.resolve([]),
    enabled: chatIdsForMessages.length > 0,
  });

  // Final filtered data including messages
  const filteredData = useMemo((): FilteredData | null => {
    if (!filteredDataBase) return null;
    return {
      ...filteredDataBase,
      messages,
    };
  }, [filteredDataBase, messages]);

  const isLoading =
    isLoadingProfiles ||
    isLoadingCohorts ||
    isLoadingSimulations ||
    isLoadingScenarios ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingRubrics ||
    isLoadingParameters ||
    isLoadingParameterItems ||
    isLoadingPersonas ||
    isLoadingAgents ||
    isLoadingMessages ||
    isLoadingStandardGroups ||
    isLoadingStandards ||
    !effectiveProfile;

  return {
    data: filteredData,
    isLoading,
    // Legacy fields (prefer using data.* in components)
    rubrics,
    messages,
    standardGroups,
    standards,
    // Raw data for components that need it
    rawData: {
      allProfiles,
      allCohorts,
      allSimulations,
      allScenarios,
      allAttempts,
      allChats,
      allGrades,
      allFeedbacks,
    },
    // Filter metadata
    filters: {
      startDate,
      endDate,
      cohortIds: effectiveCohortIds,
      roles: effectiveRoles,
      simulationFilters: effectiveSimulationFilters,
      profileId: effectiveProfileId,
    },
  };
}
