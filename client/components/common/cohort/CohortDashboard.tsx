/**
 * CohortDashboard.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { useProfile } from "@/contexts/profile-context";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import SimulationHistory from "../history/SimulationHistory";
import SimulationCard from "../simulation/SimulationCard";
import SimulationProgress from "./SimulationProgress";

export interface CohortDashboardProps {
  cohortIds: string[];
}

export default function CohortDashboard({ cohortIds }: CohortDashboardProps) {
  const { effectiveProfile } = useProfile();

  // 1. Fetch the specific cohorts
  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts", cohortIds],
    queryFn: async () => {
      // Fetch all cohorts and filter by the provided IDs
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const allCohorts = await getAllCohorts();
      return allCohorts.filter((cohort) => cohortIds.includes(cohort.id));
    },
    enabled: cohortIds.length > 0,
  });

  // 2. Fetch all simulations, to be filtered by cohorts
  const { data: allSimulations, isLoading: loadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: getAllSimulations,
  });

  // 3. Get all profile IDs from the cohorts to fetch member data
  const cohortMemberIds = useMemo(() => {
    if (!cohorts) return [];
    const ids = new Set<string>();
    cohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }, [cohorts]);

  // 4. Fetch all profiles for the members
  const { data: cohortProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles", "cohortMembers", cohortMemberIds],
    queryFn: () => getAllProfiles(), // We fetch all and filter client-side for simplicity
    enabled: cohortMemberIds.length > 0,
  });

  // 5. Fetch all attempts for these members
  const { data: attempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", cohortMemberIds],
    queryFn: () => getSimulationAttemptsByProfiles(cohortMemberIds),
    enabled: cohortMemberIds.length > 0,
  });

  // 6. Fetch chats for those attempts
  const { data: chats, isLoading: loadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((a) => a.id)],
    queryFn: () => getSimulationChatsByAttempts(attempts!.map((a) => a.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  // 7. Fetch grades for those chats - this contains the critical 'passed' status
  const { data: grades, isLoading: loadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((c) => c.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((c) => c.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructor" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Data processing logic
  const processedCohortData = useMemo(() => {
    if (!cohorts || !allSimulations || !cohortProfiles || !attempts || !grades)
      return [];

    return cohorts.map((cohort) => {
      // Get simulations for this specific cohort (and exclude default/practice ones)
      const cohortSimulations = allSimulations.filter(
        (sim) => sim.cohortIds?.includes(cohort.id) && !sim.defaultSimulation
      );

      // Get the profiles of members in this cohort
      const cohortMembers = cohortProfiles.filter((p) =>
        cohort.profileIds?.includes(p.id)
      );

      // For each simulation, calculate individual TA progress
      const simulationsWithProgress = cohortSimulations.map((simulation) => {
        // Find TA's attempts for this simulation
        const taAttempts = attempts.filter(
          (att) =>
            att.profileId === effectiveProfile!.id &&
            att.simulationId === simulation.id
        );

        const taProgress = {
          totalAttempts: taAttempts.length,
          passedCount: 0,
          inProgressCount: 0,
          notStartedCount: taAttempts.length === 0 ? 1 : 0,
          passedMembers: [] as string[],
          inProgressMembers: [] as string[],
        };

        if (taAttempts.length > 0) {
          const taAttemptIds = taAttempts.map((att) => att.id);

          // Find chats and grades related to these attempts
          const taChats = chats?.filter((c) =>
            taAttemptIds.includes(c.attemptId)
          );
          const taGrades = grades?.filter((g) =>
            taChats?.some((c) => c.id === g.simulationChatId)
          );

          const hasPassed = taGrades?.some((g) => g.passed);

          if (hasPassed) {
            taProgress.passedCount = 1;
            taProgress.passedMembers = [effectiveProfile!.id];
          } else {
            taProgress.inProgressCount = 1;
            taProgress.inProgressMembers = [effectiveProfile!.id];
          }
        }

        return {
          ...simulation,
          progress: {
            totalMembers: 1, // Individual TA view
            passedCount: taProgress.passedCount,
            inProgressCount: taProgress.inProgressCount,
            notStartedCount: taProgress.notStartedCount,
            passedMembers: taProgress.passedMembers,
            inProgressMembers: taProgress.inProgressMembers,
          },
        };
      });

      return {
        cohort,
        cohortMembers,
        simulations: simulationsWithProgress,
      };
    });
  }, [
    cohorts,
    allSimulations,
    cohortProfiles,
    attempts,
    chats,
    grades,
    effectiveProfile,
  ]);

  // Loading state
  const isLoading =
    loadingCohorts ||
    loadingSimulations ||
    loadingProfiles ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cohort dashboard...</div>
        </div>
      </div>
    );
  }

  if (!effectiveProfile || effectiveProfile.role === "guest") {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600">
            You need TA permissions to view this dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!processedCohortData.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Cohorts Found</h1>
          <p className="text-gray-600">
            The requested cohorts could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      {processedCohortData.map((data) => (
        <section key={data.cohort.id} className="space-y-6">
          <h2 className="text-2xl font-semibold">{data.cohort.title}</h2>

          {/* Progress Visualization Section */}
          <div className="space-y-4">
            {data.simulations.map((sim) => (
              <SimulationProgress key={sim.id} simulation={sim} />
            ))}
          </div>

          {/* Assignments List Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.simulations.map((sim) => (
              <SimulationCard
                key={sim.id}
                simulation={sim}
                type="cohort"
                onStartSimulation={() => {}} // Placeholder - implement as needed
                loadingSimulation={null}
                effectiveProfile={effectiveProfile}
                rubricData={{ attempts: [], highestScore: 0 }} // Placeholder - implement as needed
              />
            ))}
          </div>
        </section>
      ))}

      {/* History Section */}
      <div className="mt-12">
        <SimulationHistory
          showAll={shouldShowAll}
          cohortIds={cohortIds}
          showExport={shouldShowAll}
        />
      </div>
    </div>
  );
}
