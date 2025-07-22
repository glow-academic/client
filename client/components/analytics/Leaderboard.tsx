/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/contexts/profile-context";
import { logInfo } from "@/utils/logger";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { Award, Check, Crown, MessageSquareText, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AccoladeCard from "../common/cohort/AccoladeCard";
import { Cohort, CohortPicker } from "../common/cohort/CohortPicker";
import LeaderboardTable from "../common/cohort/LeaderboardTable";

export interface LeaderboardProps {
  cohortId?: string;
}

export default function Leaderboard({ cohortId }: LeaderboardProps) {
  const { effectiveProfile } = useProfile();
  const [selectedCohorts, setSelectedCohorts] = useState<Cohort[]>([]);

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Check if user is a TA
  const isTA = effectiveProfile?.role === "ta";

  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: getAllCohorts,
  });

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
    return Array.from(ids).sort(); // Sort to ensure stable array reference
  }, [cohorts]);

  // 4. Fetch all profiles for the members
  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles", "cohortMembers", cohortMemberIds],
    queryFn: () => getAllProfiles(), // We fetch all and filter client-side for simplicity
    enabled: cohortMemberIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // 5. Fetch all attempts for these members
  const { data: allAttempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", cohortMemberIds],
    queryFn: () => getSimulationAttemptsByProfiles(cohortMemberIds),
    enabled: cohortMemberIds.length > 0,
  });

  // 6. Fetch chats for those attempts
  const { data: allChats, isLoading: loadingChats } = useQuery({
    queryKey: ["simulationChats", allAttempts?.map((a) => a.id)?.sort() || []],
    queryFn: () => getSimulationChatsByAttempts(allAttempts!.map((a) => a.id)),
    enabled: !!allAttempts && allAttempts.length > 0,
  });

  // 7. Fetch grades for those chats - this contains the critical 'passed' status
  const { data: allGrades, isLoading: loadingGrades } = useQuery({
    queryKey: ["simulationGrades", allChats?.map((c) => c.id)?.sort() || []],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(allChats!.map((c) => c.id)),
    enabled: !!allChats && allChats.length > 0,
  });

  // 8. Fetch messages for those chats (for accolades calculation)
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["simulationMessages", allChats?.map((c) => c.id)?.sort() || []],
    queryFn: async () => {
      const { getSimulationMessagesByChats } = await import(
        "@/utils/queries/simulation_messages/get-simulation-messages-by-chats"
      );
      return getSimulationMessagesByChats(allChats!.map((c) => c.id));
    },
    enabled: !!allChats && allChats.length > 0,
  });

  // 9. Fetch all rubrics (for accolades and leaderboard calculation)
  const { data: rubrics, isLoading: loadingRubrics } = useQuery({
    queryKey: ["allRubrics"],
    queryFn: async () => {
      const { getAllRubrics } = await import(
        "@/utils/queries/rubrics/get-all-rubrics"
      );
      return getAllRubrics();
    },
  });

  // Transform cohorts for the picker with completion status
  const cohortsForPicker = useMemo(() => {
    if (
      !cohorts ||
      !allSimulations ||
      !allProfiles ||
      !allAttempts ||
      !allChats ||
      !allGrades
    ) {
      return [];
    }

    return cohorts.map((cohort) => {
      // Get simulations for this cohort
      const cohortSimulations = allSimulations.filter((sim) =>
        cohort.simulationIds?.includes(sim.id)
      );

      // Get the profiles of members in this cohort
      const cohortMembers = allProfiles.filter((p) =>
        cohort.profileIds?.includes(p.id)
      );

      // Calculate completion status
      let isCompleted = false;

      if (shouldShowAll) {
        // Instructor view: Check if all members have completed all simulations
        const cohortAttempts = allAttempts.filter(
          (att) =>
            att.profileId &&
            cohort.profileIds?.includes(att.profileId) &&
            cohortSimulations.some((sim) => sim.id === att.simulationId)
        );

        const cohortAttemptIds = cohortAttempts.map((att) => att.id);
        const cohortChats = allChats?.filter((c) =>
          cohortAttemptIds.includes(c.attemptId)
        );
        const cohortGrades = allGrades.filter((g) =>
          cohortChats?.some((c) => c.id === g.simulationChatId)
        );

        const passedCount = cohortGrades.filter((g) => g.passed).length || 0;
        const totalExpectedAttempts =
          cohortMembers.length * cohortSimulations.length;

        isCompleted = passedCount >= totalExpectedAttempts;
      } else {
        // TA view: Check if current TA has completed all simulations
        if (!effectiveProfile?.id) {
          isCompleted = false;
        } else {
          const taAttempts = allAttempts.filter(
            (att) =>
              att.profileId === effectiveProfile.id! &&
              cohortSimulations.some((sim) => sim.id === att.simulationId)
          );

          const taAttemptIds = taAttempts.map((att) => att.id);
          const taChats = allChats?.filter((c) =>
            taAttemptIds.includes(c.attemptId)
          );
          const taGrades = allGrades.filter((g) =>
            taChats?.some((c) => c.id === g.simulationChatId)
          );

          const passedCount = taGrades.filter((g) => g.passed).length || 0;
          isCompleted = passedCount >= cohortSimulations.length;
        }
      }

      return {
        id: cohort.id,
        title: cohort.title,
        description: `Cohort with ${cohort.profileIds?.length || 0} members`,
        memberCount: cohort.profileIds?.length || 0,
        isCompleted,
      };
    });
  }, [
    cohorts,
    allSimulations,
    allProfiles,
    allAttempts,
    allChats,
    allGrades,
    shouldShowAll,
    effectiveProfile?.id,
  ]);

  // Get available cohorts based on user role and cohortId prop
  const availableCohorts = useMemo(() => {
    if (!cohortsForPicker) return [];

    if (cohortId) {
      // If cohortId is provided, only show that specific cohort
      return cohortsForPicker.filter((cohort) => cohort.id === cohortId);
    }

    if (shouldShowAll) {
      // Instructors see all cohorts
      return cohortsForPicker;
    } else if (isTA && effectiveProfile?.id) {
      // TAs see only their assigned cohorts
      return cohortsForPicker.filter((cohort) => {
        const originalCohort = cohorts?.find((c) => c.id === cohort.id);
        return originalCohort?.profileIds?.includes(effectiveProfile.id);
      });
    }

    return [];
  }, [
    cohortsForPicker,
    shouldShowAll,
    isTA,
    effectiveProfile?.id,
    cohorts,
    cohortId,
  ]);

  // Set default selection based on cohortId prop or incomplete cohorts
  useEffect(() => {
    if (availableCohorts.length > 0 && selectedCohorts.length === 0) {
      if (cohortId) {
        // If cohortId is provided, select that specific cohort
        const specificCohort = availableCohorts.find(
          (cohort) => cohort.id === cohortId
        );
        if (specificCohort) {
          setSelectedCohorts([specificCohort]);
        }
      } else {
        // Otherwise, select incomplete cohorts by default
        const incompleteCohorts = availableCohorts.filter(
          (cohort) => !cohort.isCompleted
        );
        setSelectedCohorts(
          incompleteCohorts.length > 0 ? incompleteCohorts : availableCohorts
        );
      }
    }
  }, [availableCohorts, selectedCohorts.length, cohortId]);

  // Get selected cohort IDs
  const selectedCohortIds = useMemo(() => {
    return selectedCohorts.map((cohort) => cohort.id);
  }, [selectedCohorts]);

  // Filter cohorts to only selected ones
  const filteredCohorts = useMemo(() => {
    if (!cohorts) return [];
    return cohorts.filter((cohort) => selectedCohortIds.includes(cohort.id));
  }, [cohorts, selectedCohortIds]);

  // Filter profiles to only include those in the selected cohorts
  const cohortProfiles = useMemo(() => {
    if (!allProfiles || !filteredCohorts) return [];

    // Get all profile IDs from all selected cohorts
    const allCohortProfileIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => allCohortProfileIds.add(id));
    });

    // Filter profiles to only include those in the cohort
    const filteredProfiles = allProfiles.filter((profile) =>
      allCohortProfileIds.has(profile.id)
    );

    return filteredProfiles;
  }, [allProfiles, filteredCohorts]);

  // Filter attempts to only include those from selected cohorts
  const attempts = useMemo(() => {
    if (!allAttempts || !filteredCohorts) return [];

    const cohortProfileIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => cohortProfileIds.add(id));
    });

    return allAttempts.filter(
      (attempt) => attempt.profileId && cohortProfileIds.has(attempt.profileId)
    );
  }, [allAttempts, filteredCohorts]);

  // Filter chats to only include those from selected cohort attempts
  const chats = useMemo(() => {
    if (!allChats || !attempts) return [];

    const attemptIds = new Set(attempts.map((a) => a.id));
    return allChats.filter((chat) => attemptIds.has(chat.attemptId));
  }, [allChats, attempts]);

  // Filter grades to only include those from selected cohort chats
  const grades = useMemo(() => {
    if (!allGrades || !chats) return [];

    const chatIds = new Set(chats.map((c) => c.id));
    return allGrades.filter((grade) => chatIds.has(grade.simulationChatId));
  }, [allGrades, chats]);

  const safeAttempts = useMemo(() => attempts || [], [attempts]);
  const safeGrades = useMemo(() => grades || [], [grades]);

  const accolades = useMemo(() => {
    if (
      !cohortProfiles ||
      !safeGrades ||
      !messages ||
      !chats ||
      !rubrics ||
      !safeAttempts
    )
      return {
        perfectScore: { holder: null, details: "" },
        longestConvo: { holder: null, details: "" },
        mostImproved: { holder: null, details: "" },
        quickestPass: { holder: null, details: "" },
      };

    // 1. Perfect Score
    let perfectScoreHolder = null;
    let perfectScoreDetails = "";
    for (const grade of safeGrades) {
      const rubric = rubrics?.find((r) => r.id === grade.rubricId);
      if (rubric && grade.score === rubric.points) {
        const attempt = safeAttempts.find((a) =>
          chats.some(
            (c) => c.id === grade.simulationChatId && c.attemptId === a.id
          )
        );
        perfectScoreHolder = cohortProfiles.find(
          (p) => p.id === attempt?.profileId
        );
        perfectScoreDetails = `on a simulation.`;
        break;
      }
    }

    // 2. Longest Conversation
    const chatMessageCounts = chats.map((chat) => ({
      chatId: chat.id,
      count: messages?.filter((m) => m.chatId === chat.id).length || 0,
    }));
    const longestChat = chatMessageCounts.sort((a, b) => b.count - a.count)[0];
    const longestChatAttempt = safeAttempts.find((a) =>
      chats.some((c) => c.id === longestChat?.chatId && c.attemptId === a.id)
    );
    const longestConvoHolder = cohortProfiles.find(
      (p) => p.id === longestChatAttempt?.profileId
    );

    // 3. Most Improved (Simplified: Biggest score jump on any simulation)
    // For now, we'll use a placeholder - this would require more complex logic to track improvement over time
    const mostImprovedHolder = cohortProfiles?.[1]; // Placeholder

    // 4. Quickest Pass
    const passedGrades = safeGrades.filter((g) => g.passed);
    const quickestGrade = passedGrades.sort(
      (a, b) => a.timeTaken - b.timeTaken
    )[0];
    const quickestPassAttempt = safeAttempts.find((a) =>
      chats.some(
        (c) => c.id === quickestGrade?.simulationChatId && c.attemptId === a.id
      )
    );
    const quickestPassHolder = cohortProfiles.find(
      (p) => p.id === quickestPassAttempt?.profileId
    );

    return {
      perfectScore: {
        holder: perfectScoreHolder,
        details: perfectScoreDetails,
      },
      longestConvo: {
        holder: longestConvoHolder,
        details: `${longestChat?.count || 0} messages`,
      },
      mostImproved: {
        holder: mostImprovedHolder,
        details: `+45% score increase`,
      },
      quickestPass: {
        holder: quickestPassHolder,
        details: `${Math.round((quickestGrade?.timeTaken || 0) / 60)} min completion`,
      },
    };
  }, [cohortProfiles, safeGrades, messages, chats, rubrics, safeAttempts]);

  const leaderboardData = useMemo(() => {
    if (!cohortProfiles || cohortProfiles.length === 0) {
      logInfo("Leaderboard: No cohort profiles found", {
        cohortProfilesLength: cohortProfiles?.length || 0,
        cohorts: filteredCohorts?.map((c) => ({
          id: c.id,
          title: c.title,
          profileCount: c.profileIds?.length || 0,
        })),
      });
      return [];
    }

    let usersToRank = cohortProfiles;

    // For instructional roles, show all users in the cohort
    // For TA roles, show all users in the cohort (not just other TAs)
    // This allows TAs to see everyone's progress, not just other TAs
    if (
      effectiveProfile?.role === "ta" ||
      effectiveProfile?.role === "instructional"
    ) {
      // Show all users in the cohort
      usersToRank = cohortProfiles;
    } else if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      // Admins can see all users
      usersToRank = cohortProfiles;
    }

    // Always show all users in the cohort, even if they have no simulation data yet
    const ranked = usersToRank.map((profile) => {
      // Get user's grades (if any)
      const userGrades = safeGrades.filter((g) => {
        const attempt = safeAttempts.find((a) =>
          chats?.some(
            (c) => c.id === g.simulationChatId && c.attemptId === a.id
          )
        );
        return attempt?.profileId === profile.id;
      });

      // Calculate metrics
      const totalSims = new Set(
        userGrades.map(
          (g) => chats?.find((c) => c.id === g.simulationChatId)?.attemptId
        )
      ).size;

      const passRate =
        userGrades.length > 0
          ? (userGrades.filter((g) => g.passed).length / userGrades.length) *
            100
          : 0;

      let avgScore = 0;
      if (userGrades.length > 0 && rubrics) {
        const totalScore = userGrades.reduce((acc, grade) => {
          const rubric = rubrics.find((r) => r.id === grade.rubricId);
          return acc + (grade.score / (rubric?.points || 100)) * 100;
        }, 0);
        avgScore = totalScore / userGrades.length;
      }

      return {
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        avgScore: Math.round(avgScore),
        passRate: Math.round(passRate),
        simsCompleted: totalSims,
        role: profile.role,
      };
    });

    // Sort by average score (highest first), then by name for users with same score
    return ranked.sort((a, b) => {
      if (b.avgScore !== a.avgScore) {
        return b.avgScore - a.avgScore;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    cohortProfiles,
    effectiveProfile,
    safeGrades,
    rubrics,
    safeAttempts,
    chats,
    filteredCohorts,
  ]);

  const isLoading =
    loadingCohorts ||
    loadingSimulations ||
    loadingProfiles ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades ||
    loadingMessages ||
    loadingRubrics;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  // Show error if no cohorts are available
  if (!availableCohorts.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Cohorts Available</h1>
          <p className="text-gray-600">
            {cohortId
              ? "The specified cohort could not be found or you don't have access to it."
              : "There are no cohorts assigned to you. Please contact an administrator."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with title and cohort picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        {!cohortId && (
          <CohortPicker
            cohorts={availableCohorts.map((cohort) => ({
              ...cohort,
              title: cohort.isCompleted ? (
                <div className="flex items-center gap-2">
                  <span>{cohort.title}</span>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 border-green-200"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Complete
                  </Badge>
                </div>
              ) : (
                cohort.title
              ),
            }))}
            label="Filter Cohorts"
            placeholder="Select cohorts..."
            description="Select one or more cohorts to filter the leaderboard view."
            onSelect={setSelectedCohorts}
            selectedCohorts={selectedCohorts}
            hideSelectedChips={true}
          />
        )}
      </div>

      {/* Dashboard Content */}
      {selectedCohortIds.length > 0 ? (
        <div className="container mx-auto p-4 space-y-8">
          {/* Accolades Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AccoladeCard
              icon={<Award className="h-4 w-4" />}
              title="Perfect Score"
              user={accolades.perfectScore?.holder}
              details={accolades.perfectScore?.details || ""}
            />
            <AccoladeCard
              icon={<MessageSquareText className="h-4 w-4" />}
              title="Longest Convo"
              user={accolades.longestConvo?.holder}
              details={accolades.longestConvo?.details || ""}
            />
            <AccoladeCard
              icon={<Zap className="h-4 w-4" />}
              title="Most Improved"
              user={accolades.mostImproved?.holder}
              details={accolades.mostImproved?.details || ""}
            />
            <AccoladeCard
              icon={<Crown className="h-4 w-4" />}
              title="Quickest Pass"
              user={accolades.quickestPass?.holder}
              details={accolades.quickestPass?.details || ""}
            />
          </div>
          <div>
            <LeaderboardTable
              data={leaderboardData}
              currentUserId={effectiveProfile?.id || ""}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Select Cohorts</h2>
          <p className="text-muted-foreground">
            Use the filter above to select cohorts and view their progress
          </p>
        </div>
      )}
    </div>
  );
}
