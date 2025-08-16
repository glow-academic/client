import type { SimulationFilter } from "@/contexts/analytics-context";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import type { ProfileRole, Rubric, SimulationMessage } from "@/types";
import {
  filterAnalyticsData,
  type FilteredData,
} from "@/utils/analytics/filtering";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: allCohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: allSimulations = [], isLoading: isLoadingSimulations } =
    useQuery({
      queryKey: ["simulations"],
      queryFn: () => getAllSimulations(),
    });

  const { data: allScenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Fetch attempts for all profiles
  const { data: allAttempts = [], isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", allProfiles.map((p) => p.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(allProfiles.map((p) => p.id)),
    enabled: allProfiles.length > 0,
  });

  // Fetch chats for all attempts
  const { data: allChats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", allAttempts.map((a) => a.id)],
    queryFn: () => getSimulationChatsByAttempts(allAttempts.map((a) => a.id)),
    enabled: allAttempts.length > 0,
  });

  // Fetch grades for all chats
  const { data: allGrades = [], isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", allChats.map((c) => c.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(allChats.map((c) => c.id)),
    enabled: allChats.length > 0,
  });

  // Fetch feedbacks for all grades
  const { data: allFeedbacks = [], isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", allGrades.map((g) => g.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        allGrades.map((g) => g.id)
      ),
    enabled: allGrades.length > 0,
  });

  // Fetch auxiliary datasets first (rubrics, standards)
  const { data: rubrics = [], isLoading: isLoadingRubrics } = useQuery<
    Rubric[]
  >({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Standards taxonomy for skills/heatmaps
  const { data: standardGroups = [], isLoading: isLoadingStandardGroups } =
    useQuery({
      queryKey: ["standardGroups", rubrics.map((r) => r.id)],
      queryFn: () => getStandardGroupsByRubrics(rubrics.map((r) => r.id)),
      enabled: rubrics.length > 0,
      staleTime: 5 * 60 * 1000,
    });

  const { data: standards = [], isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups.map((g) => g.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups.map((g) => g.id)),
    enabled: standardGroups.length > 0,
    staleTime: 5 * 60 * 1000,
  });

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
