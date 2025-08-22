/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
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
  const router = useRouter();

  // Use filtered analytics data with cohort-specific filtering if cohortId is provided
  const {
    data: filteredData,
    isLoading: isFilteredDataLoading,
    rubrics,
    messages,
  } = useFilteredAnalyticsData(
    cohortId
      ? {
          cohortIds: [cohortId],
        }
      : undefined
  );

  const handleViewReport = (profileId: string) => {
    // Disable navigation for TAs when viewing a specific cohort
    if (cohortId && effectiveProfile?.role === "ta") {
      return;
    }
    router.push(`/analytics/reports/p/${profileId}`);
  };

  // Check if navigation should be disabled for TAs viewing a specific cohort
  const shouldDisableNavigation = cohortId && effectiveProfile?.role === "ta";

  // Calculate accolades from filtered data
  const accolades = useMemo(() => {
    if (!filteredData || !rubrics) {
      return {
        perfectScore: { holder: null, details: "" },
        longestConvo: { holder: null, details: "" },
        mostImproved: { holder: null, details: "" },
        quickestPass: { holder: null, details: "" },
      };
    }

    const { profiles, grades, chats, attempts } = filteredData;

    // 1. Perfect Score - Find someone who achieved exactly 100% (perfect score)
    let perfectScoreHolder = null;
    let perfectScoreDetails = "";

    for (const grade of grades) {
      const rubric = rubrics.find((r) => r.id === grade.rubricId);
      if (rubric) {
        const scorePercentage = (grade.score / rubric.points) * 100;
        // Only consider it a perfect score if they got exactly 100%
        if (scorePercentage === 100) {
          const attempt = attempts.find((a) =>
            chats.some(
              (c) => c.id === grade.simulationChatId && c.attemptId === a.id
            )
          );
          perfectScoreHolder = profiles.find(
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
    const longestChatAttempt = attempts.find((a) =>
      chats.some((c) => c.id === longestChat?.chatId && c.attemptId === a.id)
    );
    const longestConvoHolder = profiles.find(
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
    for (const grade of grades) {
      const attempt = attempts.find((a) =>
        chats.some(
          (c) => c.id === grade.simulationChatId && c.attemptId === a.id
        )
      );
      if (!attempt?.profileId) continue;

      const rubric = rubrics.find((r) => r.id === grade.rubricId);
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
        mostImprovedHolder = profiles.find(
          (p) => p.id === attempts[0]?.profileId
        );
        mostImprovedDetails = `+${Math.round(improvement)}% improvement`;
      }
    }

    // 4. Quickest Pass - Find the fastest completion time for a passed attempt
    const passedGrades = grades.filter((g) => g.passed);
    const quickestGrade = passedGrades.sort(
      (a, b) => a.timeTaken - b.timeTaken
    )[0];
    const quickestPassAttempt = attempts.find((a) =>
      chats.some(
        (c) => c.id === quickestGrade?.simulationChatId && c.attemptId === a.id
      )
    );
    const quickestPassHolder = profiles.find(
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
  }, [filteredData, rubrics, messages]);

  // Calculate leaderboard data from filtered data
  const leaderboardData = useMemo(() => {
    if (!filteredData || filteredData.profiles.length === 0 || !rubrics) {
      return [];
    }

    const { profiles, grades, chats, attempts } = filteredData;

    // Always show all users in the cohort, even if they have no simulation data yet
    const ranked = profiles.map((profile) => {
      // Get user's grades (if any)
      const userGrades = grades.filter((g) => {
        const attempt = attempts.find((a) =>
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
      if (userGrades.length > 0 && rubrics.length > 0) {
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

    // Limit to top 25% of users based on average score
    // This prevents users from seeing themselves at the bottom if they're not performing well
    const top25PercentCount = Math.ceil(sorted.length * 0.25);
    const top25Percent = sorted.slice(0, top25PercentCount);

    return top25Percent;
  }, [filteredData, rubrics]);

  const isLoading =
    isProfileLoading || isFilteredDataLoading || !effectiveProfile;

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

  // Show error if no data is available
  if (!filteredData || filteredData.profiles.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Data Available</h1>
          <p className="text-gray-600">
            {cohortId
              ? "The specified cohort could not be found or you don't have access to it."
              : "There is no data available for the current filters. Please adjust your filters or contact an administrator."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Content */}
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
    </div>
  );
}
