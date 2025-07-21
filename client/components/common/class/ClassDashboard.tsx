/**
 * ClassDashboard.tsx
 * This is the class dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { useProfile } from "@/contexts/profile-context";
import { useQuery } from "@tanstack/react-query";
import { Award, Crown, MessageSquareText, Zap } from "lucide-react";
import { useMemo } from "react";

// Import query functions
import { getProfilesByClass } from "@/utils/queries/profiles/get-profiles-by-class";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import AccoladeCard from "./AccoladeCard";
import LeaderboardTable from "./LeaderboardTable";

// Import sub-components

// Import types

export interface ClassDashboardProps {
  classId: string;
}

export default function ClassDashboard({ classId }: ClassDashboardProps) {
  const { effectiveProfile } = useProfile();

  // 1. Fetch all profiles associated with the classId
  const { data: classProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["classProfiles", classId],
    queryFn: () => getProfilesByClass(classId),
    enabled: !!classId,
  });

  const profileIds = useMemo(
    () => classProfiles?.map((p) => p.id) || [],
    [classProfiles]
  );

  // 2. Fetch all related performance data for these profiles
  const { data: attempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["classAttempts", profileIds],
    queryFn: () => getSimulationAttemptsByProfiles(profileIds),
    enabled: profileIds.length > 0,
  });

  const { data: chats, isLoading: loadingChats } = useQuery({
    queryKey: ["classChats", attempts?.map((a) => a.id)],
    queryFn: () => getSimulationChatsByAttempts(attempts!.map((a) => a.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: loadingGrades } = useQuery({
    queryKey: ["classGrades", chats?.map((c) => c.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((c) => c.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["classMessages", chats?.map((c) => c.id)],
    queryFn: () => getSimulationMessagesByChats(chats!.map((c) => c.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: rubrics, isLoading: loadingRubrics } = useQuery({
    queryKey: ["allRubrics"],
    queryFn: getAllRubrics,
  });

  // Memoized calculation for accolades
  const accolades = useMemo(() => {
    if (
      !classProfiles ||
      !grades ||
      !messages ||
      !chats ||
      !rubrics ||
      !attempts
    )
      return {};

    // 1. Perfect Score
    let perfectScoreHolder = null;
    let perfectScoreDetails = "";
    for (const grade of grades) {
      const rubric = rubrics.find((r) => r.id === grade.rubricId);
      if (rubric && grade.score === rubric.points) {
        const attempt = attempts.find((a) =>
          chats.some(
            (c) => c.id === grade.simulationChatId && c.attemptId === a.id
          )
        );
        perfectScoreHolder = classProfiles.find(
          (p) => p.id === attempt?.profileId
        );
        perfectScoreDetails = `on a simulation.`;
        break;
      }
    }

    // 2. Longest Conversation
    const chatMessageCounts = chats.map((chat) => ({
      chatId: chat.id,
      count: messages.filter((m) => m.chatId === chat.id).length,
    }));
    const longestChat = chatMessageCounts.sort((a, b) => b.count - a.count)[0];
    const longestChatAttempt = attempts.find((a) =>
      chats.some((c) => c.id === longestChat?.chatId && c.attemptId === a.id)
    );
    const longestConvoHolder = classProfiles.find(
      (p) => p.id === longestChatAttempt?.profileId
    );

    // 3. Most Improved (Simplified: Biggest score jump on any simulation)
    // For now, we'll use a placeholder - this would require more complex logic to track improvement over time
    const mostImprovedHolder = classProfiles?.[1]; // Placeholder

    // 4. Quickest Pass
    const passedGrades = grades.filter((g) => g.passed);
    const quickestGrade = passedGrades.sort(
      (a, b) => a.timeTaken - b.timeTaken
    )[0];
    const quickestPassAttempt = attempts.find((a) =>
      chats.some(
        (c) => c.id === quickestGrade?.simulationChatId && c.attemptId === a.id
      )
    );
    const quickestPassHolder = classProfiles.find(
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
  }, [classProfiles, grades, messages, chats, rubrics, attempts]);

  // Memoized calculation for the leaderboard
  const leaderboardData = useMemo(() => {
    let usersToRank = classProfiles;
    // If the user is a TA, filter the leaderboard to only show other TAs in the class
    if (effectiveProfile?.role === "ta") {
      usersToRank = classProfiles?.filter((p) => p.role === "ta");
    }
    if (!usersToRank || !grades || !rubrics || !attempts || !chats) return [];

    const ranked = usersToRank.map((profile) => {
      const userGrades = grades.filter((g) => {
        const attempt = attempts.find((a) =>
          chats.some((c) => c.id === g.simulationChatId && c.attemptId === a.id)
        );
        return attempt?.profileId === profile.id;
      });

      const totalSims = new Set(
        userGrades.map(
          (g) => chats.find((c) => c.id === g.simulationChatId)?.attemptId
        )
      ).size;
      const passRate =
        userGrades.length > 0
          ? (userGrades.filter((g) => g.passed).length / userGrades.length) *
            100
          : 0;

      let avgScore = 0;
      if (userGrades.length > 0) {
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

    return ranked.sort((a, b) => b.avgScore - a.avgScore);
  }, [classProfiles, effectiveProfile, grades, rubrics, attempts, chats]);

  const isLoading =
    loadingProfiles ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades ||
    loadingMessages ||
    loadingRubrics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {/* Leaderboard Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Class Leaderboard</h2>
        <LeaderboardTable
          data={leaderboardData}
          currentUserId={effectiveProfile!.id}
        />
      </div>
    </div>
  );
}
