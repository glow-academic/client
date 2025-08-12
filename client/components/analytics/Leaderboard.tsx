/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { Award, Crown, MessageSquareText, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import AccoladeCard from "../common/cohort/AccoladeCard";
import LeaderboardTable from "../common/cohort/LeaderboardTable";

export interface LeaderboardProps {
  cohortId?: string;
}

export default function Leaderboard({ cohortId }: LeaderboardProps) {
  const { effectiveProfile, isLoading: isProfileLoading } = useProfile();
  const {
    startDate,
    endDate,
    effectiveCohortIds,
    cohorts,
    selectedRoles,
    showPractice,
    showGeneral,
  } = useAnalytics();
  const router = useRouter();

  const handleViewReport = (profileId: string) => {
    // Disable navigation for TAs when viewing a specific cohort
    if (cohortId && effectiveProfile?.role === "ta") {
      return;
    }
    router.push(`/analytics/reports/p/${profileId}`);
  };

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Check if user is a TA
  const isTA = effectiveProfile?.role === "ta";
  // Determine effective allowed roles
  const enforcedTARoles: Array<"ta"> | undefined =
    cohortId && isTA ? ["ta"] : undefined;
  const effectiveAllowedRoles =
    enforcedTARoles ??
    (selectedRoles && selectedRoles.length > 0 ? selectedRoles : undefined);

  // Practice/general are controlled by analytics filters

  // Check if navigation should be disabled for TAs viewing a specific cohort
  const shouldDisableNavigation = cohortId && isTA;

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

  // 5b. Fetch all simulations to filter practice vs normal
  const { data: allSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
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

  // Filter cohorts to only selected ones, or show all available cohorts if none selected
  // This ensures users always see data by default, similar to analytics filters
  const filteredCohorts = useMemo(() => {
    if (!cohorts) return [];

    // If a specific cohortId is passed, only show that cohort
    if (cohortId) {
      const specificCohort = cohorts.find((cohort) => cohort.id === cohortId);
      if (!specificCohort) return [];

      // For TAs, ensure they can only see cohorts they're assigned to
      if (isTA && effectiveProfile?.id) {
        if (!specificCohort.profileIds?.includes(effectiveProfile.id)) {
          return []; // TA is not assigned to this cohort
        }
      }

      // For instructors/admins, they can see any cohort
      return [specificCohort];
    }

    // If no cohorts are selected, show all available cohorts for the user
    if (effectiveCohortIds.length === 0) {
      return cohorts.filter((cohort) => {
        // For instructors/admins, show all active cohorts
        if (shouldShowAll || effectiveProfile?.defaultProfile) {
          return cohort.active;
        }
        // For TAs, show only their assigned active cohorts
        if (isTA && effectiveProfile?.id) {
          return (
            cohort.active && cohort.profileIds?.includes(effectiveProfile.id)
          );
        }
        return false;
      });
    }

    // Otherwise, filter to only selected cohorts
    return cohorts.filter((cohort) => effectiveCohortIds.includes(cohort.id));
  }, [
    cohorts,
    cohortId,
    effectiveCohortIds,
    shouldShowAll,
    effectiveProfile?.defaultProfile,
    isTA,
    effectiveProfile?.id,
  ]);

  // Filter profiles to only include those in the selected cohorts and allowed roles
  // Treat admins/superadmins as members of all selected cohorts
  const cohortProfiles = useMemo(() => {
    if (!allProfiles || !filteredCohorts) return [];

    // Get all profile IDs from all selected cohorts
    const allCohortProfileIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => allCohortProfileIds.add(id));
    });

    // Filter by membership and allowed roles (if provided)
    const filteredProfiles = allProfiles.filter((profile) => {
      const isPrivileged =
        profile.role === "admin" || profile.role === "superadmin";
      if (!isPrivileged && !allCohortProfileIds.has(profile.id)) return false;
      if (!effectiveAllowedRoles || effectiveAllowedRoles.length === 0) {
        return true;
      }
      return effectiveAllowedRoles.includes(profile.role);
    });

    return filteredProfiles;
  }, [allProfiles, filteredCohorts, effectiveAllowedRoles]);

  // Filter attempts to only include those from selected cohorts and date range
  const attempts = useMemo(() => {
    if (!allAttempts || !filteredCohorts) return [];

    const cohortProfileIds = new Set<string>();
    filteredCohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => cohortProfileIds.add(id));
    });

    let filteredAttempts = allAttempts.filter((attempt) => {
      // Filter by cohort membership
      const isPrivilegedAttempt = allProfiles?.some(
        (p) =>
          p.id === attempt.profileId &&
          (p.role === "admin" || p.role === "superadmin")
      );
      if (
        !attempt.profileId ||
        (!isPrivilegedAttempt && !cohortProfileIds.has(attempt.profileId))
      ) {
        return false;
      }

      // Filter by date range if dates are provided
      if (startDate && endDate && attempt.createdAt) {
        const attemptDate = new Date(attempt.createdAt);
        return attemptDate >= startDate && attemptDate <= endDate;
      }

      return true;
    });

    // Apply practice filter based on simulations
    if (allSimulations && allSimulations.length > 0) {
      const simById = new Map(allSimulations.map((s) => [s.id, s]));
      filteredAttempts = filteredAttempts.filter((attempt) => {
        const sim = simById.get(attempt.simulationId);
        const isPractice = Boolean(sim?.practiceSimulation);
        return (showPractice && isPractice) || (showGeneral && !isPractice);
      });
    }

    return filteredAttempts;
  }, [
    allAttempts,
    filteredCohorts,
    startDate,
    endDate,
    allSimulations,
    showPractice,
    showGeneral,
    allProfiles,
  ]);

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
    const filteredGrades = allGrades.filter((grade) =>
      chatIds.has(grade.simulationChatId)
    );

    return filteredGrades;
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

    // 1. Perfect Score - Find someone who achieved exactly 100% (perfect score)
    let perfectScoreHolder = null;
    let perfectScoreDetails = "";

    for (const grade of safeGrades) {
      const rubric = rubrics?.find((r) => r.id === grade.rubricId);
      if (rubric) {
        const scorePercentage = (grade.score / rubric.points) * 100;
        // Only consider it a perfect score if they got exactly 100%
        if (scorePercentage === 100) {
          const attempt = safeAttempts.find((a) =>
            chats.some(
              (c) => c.id === grade.simulationChatId && c.attemptId === a.id
            )
          );
          perfectScoreHolder = cohortProfiles.find(
            (p) => p.id === attempt?.profileId
          );
          perfectScoreDetails = `100% perfect score`;
          break; // Found a perfect score, no need to look further
        }
      }
    }

    // 2. Longest Conversation - Find the chat with the most messages
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

    // 3. Most Improved - Calculate the biggest score improvement over time
    let mostImprovedHolder = null;
    let mostImprovedDetails = "";
    let biggestImprovement = 0;

    // Group attempts by profile and simulation to track improvement
    const profileSimulationAttempts = new Map<
      string,
      Array<{
        profileId: string;
        simulationId: string;
        score: number;
        scorePercentage: number;
        createdAt: Date;
      }>
    >();

    // Build attempt history for each profile-simulation combination
    for (const grade of safeGrades) {
      const attempt = safeAttempts.find((a) =>
        chats.some(
          (c) => c.id === grade.simulationChatId && c.attemptId === a.id
        )
      );
      if (!attempt?.profileId) continue;

      const rubric = rubrics?.find((r) => r.id === grade.rubricId);
      if (!rubric) continue;

      const scorePercentage = (grade.score / rubric.points) * 100;
      const key = `${attempt.profileId}-${attempt.simulationId}`;

      if (!profileSimulationAttempts.has(key)) {
        profileSimulationAttempts.set(key, []);
      }

      profileSimulationAttempts.get(key)!.push({
        profileId: attempt.profileId,
        simulationId: attempt.simulationId,
        score: grade.score,
        scorePercentage,
        createdAt: new Date(attempt.createdAt),
      });
    }

    // Calculate improvement for each profile-simulation combination
    for (const [, attempts] of profileSimulationAttempts) {
      if (attempts.length < 2) continue; // Need at least 2 attempts to show improvement

      // Sort by creation date
      const sortedAttempts = attempts.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const firstScore = sortedAttempts[0]?.scorePercentage;
      const lastScore =
        sortedAttempts[sortedAttempts.length - 1]?.scorePercentage;

      if (firstScore === undefined || lastScore === undefined) continue;

      const improvement = lastScore - firstScore;

      if (improvement > biggestImprovement) {
        biggestImprovement = improvement;
        mostImprovedHolder = cohortProfiles.find(
          (p) => p.id === attempts[0]?.profileId
        );
        mostImprovedDetails = `+${Math.round(improvement)}% improvement`;
      }
    }

    // 4. Quickest Pass - Find the fastest completion time for a passed attempt
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
        details: mostImprovedDetails,
      },
      quickestPass: {
        holder: quickestPassHolder,
        details: quickestGrade
          ? `${Math.round(quickestGrade.timeTaken / 60)} min completion`
          : "",
      },
    };
  }, [cohortProfiles, safeGrades, messages, chats, rubrics, safeAttempts]);

  const leaderboardData = useMemo(() => {
    if (!cohortProfiles || cohortProfiles.length === 0) {
      return [];
    }

    // Note: cohortProfiles already contains only TAs due to the filtering in cohortProfiles useMemo
    let usersToRank = cohortProfiles;

    // For all roles, show TAs from the cohort
    // The filtering to only TAs is already done in cohortProfiles
    if (
      effectiveProfile?.role === "ta" ||
      effectiveProfile?.role === "instructional" ||
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      // Show TAs from the cohort
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
      };
    });

    // Sort by average score (highest first), then by name for users with same score
    const sorted = ranked.sort((a, b) => {
      if (b.avgScore !== a.avgScore) {
        return b.avgScore - a.avgScore;
      }
      return a.name.localeCompare(b.name);
    });

    // Limit to top 25% of TAs based on average score
    // This prevents users from seeing themselves at the bottom if they're not performing well
    const top25PercentCount = Math.ceil(sorted.length * 0.25);
    const top25Percent = sorted.slice(0, top25PercentCount);

    return top25Percent;
  }, [
    cohortProfiles,
    effectiveProfile,
    safeGrades,
    rubrics,
    safeAttempts,
    chats,
  ]);

  const isLoading =
    isProfileLoading ||
    !effectiveProfile ||
    loadingProfiles ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades ||
    loadingMessages ||
    loadingRubrics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  // Show error if no cohorts are available
  if (!cohorts || cohorts.length === 0) {
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
      {/* Dashboard Content */}
      {filteredCohorts.length > 0 ? (
        <div className="container mx-auto p-4 space-y-8">
          {/* Accolades Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accolades.perfectScore?.holder ? (
              shouldDisableNavigation ? (
                <AccoladeCard
                  icon={<Award className="h-4 w-4" />}
                  title="Perfect Score"
                  user={accolades.perfectScore.holder}
                  details={accolades.perfectScore.details || ""}
                />
              ) : (
                <Link
                  href={`/analytics/reports/p/${accolades.perfectScore.holder.id}`}
                  className="block h-full"
                >
                  <AccoladeCard
                    icon={<Award className="h-4 w-4" />}
                    title="Perfect Score"
                    user={accolades.perfectScore.holder}
                    details={accolades.perfectScore.details || ""}
                  />
                </Link>
              )
            ) : (
              <AccoladeCard
                icon={<Award className="h-4 w-4" />}
                title="Perfect Score"
                user={accolades.perfectScore?.holder}
                details={accolades.perfectScore?.details || ""}
              />
            )}
            {accolades.longestConvo?.holder ? (
              shouldDisableNavigation ? (
                <AccoladeCard
                  icon={<MessageSquareText className="h-4 w-4" />}
                  title="Longest Convo"
                  user={accolades.longestConvo.holder}
                  details={accolades.longestConvo.details || ""}
                />
              ) : (
                <Link
                  href={`/analytics/reports/p/${accolades.longestConvo.holder.id}`}
                  className="block h-full"
                >
                  <AccoladeCard
                    icon={<MessageSquareText className="h-4 w-4" />}
                    title="Longest Convo"
                    user={accolades.longestConvo.holder}
                    details={accolades.longestConvo.details || ""}
                  />
                </Link>
              )
            ) : (
              <AccoladeCard
                icon={<MessageSquareText className="h-4 w-4" />}
                title="Longest Convo"
                user={accolades.longestConvo?.holder}
                details={accolades.longestConvo?.details || ""}
              />
            )}
            {accolades.mostImproved?.holder ? (
              shouldDisableNavigation ? (
                <AccoladeCard
                  icon={<Zap className="h-4 w-4" />}
                  title="Most Improved"
                  user={accolades.mostImproved.holder}
                  details={accolades.mostImproved.details || ""}
                />
              ) : (
                <Link
                  href={`/analytics/reports/p/${accolades.mostImproved.holder.id}`}
                  className="block h-full"
                >
                  <AccoladeCard
                    icon={<Zap className="h-4 w-4" />}
                    title="Most Improved"
                    user={accolades.mostImproved.holder}
                    details={accolades.mostImproved.details || ""}
                  />
                </Link>
              )
            ) : (
              <AccoladeCard
                icon={<Zap className="h-4 w-4" />}
                title="Most Improved"
                user={accolades.mostImproved?.holder}
                details={accolades.mostImproved?.details || ""}
              />
            )}
            {accolades.quickestPass?.holder ? (
              shouldDisableNavigation ? (
                <AccoladeCard
                  icon={<Crown className="h-4 w-4" />}
                  title="Quickest Pass"
                  user={accolades.quickestPass.holder}
                  details={accolades.quickestPass.details || ""}
                />
              ) : (
                <Link
                  href={`/analytics/reports/p/${accolades.quickestPass.holder.id}`}
                  className="block h-full"
                >
                  <AccoladeCard
                    icon={<Crown className="h-4 w-4" />}
                    title="Quickest Pass"
                    user={accolades.quickestPass.holder}
                    details={accolades.quickestPass.details || ""}
                  />
                </Link>
              )
            ) : (
              <AccoladeCard
                icon={<Crown className="h-4 w-4" />}
                title="Quickest Pass"
                user={accolades.quickestPass?.holder}
                details={accolades.quickestPass?.details || ""}
              />
            )}
          </div>
          <div>
            <LeaderboardTable
              data={leaderboardData}
              currentUserId={effectiveProfile?.id || ""}
              {...(shouldDisableNavigation
                ? {}
                : { onViewReport: handleViewReport })}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No Cohorts Available</h2>
          <p className="text-muted-foreground">
            No cohorts are available for your role or no data is available for
            the selected filters.
          </p>
        </div>
      )}
    </div>
  );
}
