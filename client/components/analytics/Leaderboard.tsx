/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/profile-context";
import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
import type { Profile } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  MessageSquareText,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AccoladeCard from "../common/cohort/AccoladeCard";
import LeaderboardTable from "../common/cohort/LeaderboardTable";

// Helper function to get initials from name
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export interface LeaderboardProps {
  cohortId?: string;
}

export default function Leaderboard({ cohortId }: LeaderboardProps) {
  const { effectiveProfile, isLoading: isProfileLoading } = useProfile();
  const router = useRouter();
  // Rotation index removed to freeze accolade set
  const [accoladePageIndex, setAccoladePageIndex] = useState(0);

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

  // Selection + rotation pause state
  const [selected, setSelected] = useState<{
    key: string;
    title: string;
    icon: React.ReactNode;
    accolade: { holder: Profile | null | undefined; details: string };
  } | null>(null);
  const [isHoveringAccolades, setIsHoveringAccolades] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotation disabled to simplify carousel behavior

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleViewReport = (profileId: string) => {
    // Disable navigation for TAs when viewing a specific cohort
    if (cohortId && effectiveProfile?.role === "ta") {
      return;
    }
    router.push(`/analytics/reports/p/${profileId}`);
  };

  // Check if navigation should be disabled for TAs viewing a specific cohort
  const shouldDisableNavigation = cohortId && effectiveProfile?.role === "ta";

  // Check if user has permission to view reports (instructional and above)
  const canViewReports =
    effectiveProfile?.role === "superadmin" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "instructional";

  // Calculate accolades from filtered data
  const accolades = useMemo(() => {
    if (!filteredData || !rubrics) {
      return {
        perfectScore: { holder: null, details: "" },
        longestConvo: { holder: null, details: "" },
        mostImproved: { holder: null, details: "" },
        quickestPass: { holder: null, details: "" },
        // New rotating accolades
        thePersistent: { holder: null, details: "" },
        marathonRunner: { holder: null, details: "" },
        rapidRiser: { holder: null, details: "" },
        highestScorer: { holder: null, details: "" },
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

    // 5. The Persistent - User with the most simulation attempts
    const attemptsByProfile = attempts.reduce(
      (acc, attempt) => {
        if (attempt.profileId) {
          acc[attempt.profileId] = (acc[attempt.profileId] || 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    let persistentHolder = null;
    let maxAttempts = 0;

    for (const profileId in attemptsByProfile) {
      const attemptCount = attemptsByProfile[profileId];
      if (attemptCount && attemptCount > maxAttempts) {
        maxAttempts = attemptCount;
        persistentHolder = profiles.find((p) => p.id === profileId) || null;
      }
    }

    // 6. Marathon Runner - User with the most time spent in simulations
    const timeByProfile = new Map<string, number>();

    for (const grade of grades) {
      const attempt = attempts.find((a) =>
        chats.some(
          (c) => c.id === grade.simulationChatId && c.attemptId === a.id
        )
      );
      if (attempt?.profileId && grade.timeTaken) {
        const currentTime = timeByProfile.get(attempt.profileId) || 0;
        timeByProfile.set(attempt.profileId, currentTime + grade.timeTaken);
      }
    }

    let marathonHolder = null;
    let maxTime = 0;

    for (const [profileId, totalTime] of timeByProfile.entries()) {
      if (totalTime > maxTime) {
        maxTime = totalTime;
        marathonHolder = profiles.find((p) => p.id === profileId) || null;
      }
    }

    // 7. Rapid Riser - Fastest velocity of improvement
    let rapidRiserHolder = null;
    let rapidRiserDetails = "";
    let maxVelocity = 0;

    for (const [, attempts] of profileSimulationAttempts) {
      if (attempts.length < 2) continue; // Need at least 2 attempts

      const sortedAttempts = attempts.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const firstAttempt = sortedAttempts[0];
      const lastAttempt = sortedAttempts[sortedAttempts.length - 1];

      if (!firstAttempt || !lastAttempt) continue;

      const scoreImprovement =
        lastAttempt.scorePercentage - firstAttempt.scorePercentage;

      // Only consider positive improvement
      if (scoreImprovement > 0) {
        const timeDiffMs =
          lastAttempt.createdAt.getTime() - firstAttempt.createdAt.getTime();
        // Convert time difference to days, ensuring it's at least 1 to avoid division by zero
        const timeDiffDays = Math.max(1, timeDiffMs / (1000 * 60 * 60 * 24));

        const velocity = scoreImprovement / timeDiffDays;

        if (velocity > maxVelocity) {
          maxVelocity = velocity;
          rapidRiserHolder =
            profiles.find((p) => p.id === firstAttempt.profileId) || null;
          rapidRiserDetails = `+${Math.round(scoreImprovement)}% in ${Math.round(timeDiffDays)} day(s)`;
        }
      }
    }

    // 8. Highest Scorer - User with the best single score percentage
    let highestScorerHolder = null;
    let maxScorePercentage = 0;

    for (const grade of grades) {
      const rubric = rubrics.find((r) => r.id === grade.rubricId);
      if (rubric && rubric.points > 0) {
        const scorePercentage = (grade.score / rubric.points) * 100;

        if (scorePercentage > maxScorePercentage) {
          maxScorePercentage = scorePercentage;
          const attempt = attempts.find((a) =>
            chats.some(
              (c) => c.id === grade.simulationChatId && c.attemptId === a.id
            )
          );
          highestScorerHolder =
            profiles.find((p) => p.id === attempt?.profileId) || null;
        }
      }
    }

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
      // New rotating accolades
      thePersistent: {
        holder: persistentHolder,
        details: `${maxAttempts} attempts made`,
      },
      marathonRunner: {
        holder: marathonHolder,
        details: `${Math.round(maxTime / 60)} minutes total`,
      },
      rapidRiser: {
        holder: rapidRiserHolder,
        details: rapidRiserDetails,
      },
      highestScorer: {
        holder: highestScorerHolder,
        details: `Top score of ${Math.round(maxScorePercentage)}%`,
      },
    };
  }, [filteredData, rubrics, messages]);

  // Accolade cards (single set; rotation removed)
  const accoladeSets = [
    [
      {
        key: "perfectScore",
        icon: <Award className="h-4 w-4" />,
        title: "Perfect Score",
        accolade: accolades.perfectScore,
      },
      {
        key: "longestConvo",
        icon: <MessageSquareText className="h-4 w-4" />,
        title: "Longest Convo",
        accolade: accolades.longestConvo,
      },
      {
        key: "mostImproved",
        icon: <Zap className="h-4 w-4" />,
        title: "Most Improved",
        accolade: accolades.mostImproved,
      },
      {
        key: "quickestPass",
        icon: <Crown className="h-4 w-4" />,
        title: "Quickest Pass",
        accolade: accolades.quickestPass,
      },
    ],
    [
      {
        key: "thePersistent",
        icon: <Target className="h-4 w-4" />,
        title: "The Persistent",
        accolade: accolades.thePersistent,
      },
      {
        key: "marathonRunner",
        icon: <Clock className="h-4 w-4" />,
        title: "Marathon Runner",
        accolade: accolades.marathonRunner,
      },
      {
        key: "rapidRiser",
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Rapid Riser",
        accolade: accolades.rapidRiser,
      },
      {
        key: "highestScorer",
        icon: <Trophy className="h-4 w-4" />,
        title: "Highest Scorer",
        accolade: accolades.highestScorer,
      },
    ],
  ];

  const currentAccolades = accoladeSets[0] || [];

  // Carousel constants and helpers
  const ACCOLADES_PER_ROW = 4; // show 4 at a time
  const MANUAL_STEP = 2; // chevrons move 2
  const AUTO_STEP = 4; // auto moves 4

  // wrap-safe window to always fill the row
  const wrapWindow = <T,>(list: T[], start: number, count: number): T[] => {
    if (list.length === 0) return [];
    const out: T[] = [];
    const length = list.length;
    for (let i = 0; i < count; i++) {
      out.push(list[(start + i) % length]!);
    }
    return out;
  };

  // total manual pages measured in steps of 2
  const manualPages = Math.max(
    1,
    Math.ceil(currentAccolades.length / MANUAL_STEP)
  );
  const clampPage = useCallback(
    (idx: number) => ((idx % manualPages) + manualPages) % manualPages,
    [manualPages]
  );

  const getVisibleAccolades = () => {
    const startIndex = accoladePageIndex * MANUAL_STEP;
    return wrapWindow(currentAccolades, startIndex, ACCOLADES_PER_ROW);
  };

  const startAuto = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setAccoladePageIndex((prev) => clampPage(prev + AUTO_STEP / MANUAL_STEP));
    }, 3500);
  };

  const resetAuto = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    startAuto();
  };

  const navigateAccolades = (direction: "prev" | "next") => {
    setAccoladePageIndex((prev) => {
      const next = direction === "prev" ? prev - 1 : prev + 1;
      return clampPage(next);
    });
    resetAuto();
  };

  // Auto-advance effect (placed before any conditional returns)
  useEffect(() => {
    if (selected || isHoveringAccolades) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => {
        setAccoladePageIndex((prev) =>
          clampPage(prev + AUTO_STEP / MANUAL_STEP)
        );
      }, 3500);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [selected, isHoveringAccolades, manualPages, clampPage]);

  // Calculate leaderboard data with detailed metrics and percentile
  const leaderboardData = useMemo(() => {
    if (!filteredData || filteredData.profiles.length === 0 || !rubrics) {
      return [];
    }

    const { profiles, grades, chats, attempts } = filteredData;

    // Build per-user metrics
    const rows = profiles.map((profile) => {
      const userAttempts = attempts.filter((a) => a.profileId === profile.id);
      const userChats = chats.filter((c) =>
        userAttempts.some((a) => a.id === c.attemptId)
      );
      const userGrades = grades.filter((g) =>
        userChats.some((c) => c.id === g.simulationChatId)
      );

      // Avg score
      let avgScore = 0;
      if (userGrades.length > 0 && rubrics.length > 0) {
        const totalScore = userGrades.reduce((acc, grade) => {
          const rubric = rubrics.find((r) => r.id === grade.rubricId);
          const rubricPoints = rubric?.points || 100;
          return acc + (grade.score / rubricPoints) * 100;
        }, 0);
        avgScore = totalScore / userGrades.length;
      }

      // (Removed older per-user fields not needed for the new table)

      // Time spent (seconds) based on chat timestamps
      const timeSpentSeconds = userChats.reduce((sum, chat) => {
        if (chat.completedAt) {
          const diff =
            (new Date(chat.completedAt).getTime() -
              new Date(chat.createdAt).getTime()) /
            1000;
          return sum + Math.max(0, diff);
        }
        return sum;
      }, 0);
      const timeSpentMinutes = timeSpentSeconds / 60;

      // Messages per session (average)
      const userMessagesCounts = userChats.map(
        (chat) => (messages || []).filter((m) => m.chatId === chat.id).length
      );
      const messagesPerSession =
        userMessagesCounts.length > 0
          ? userMessagesCounts.reduce((a, b) => a + b, 0) /
            userMessagesCounts.length
          : 0;

      // Quickest pass (minutes) - min timeTaken among passed grades
      const quickestPassMinutes = (() => {
        const passed = userGrades.filter((g) => g.passed && g.timeTaken > 0);
        if (passed.length === 0) return 0;
        const minSeconds = passed.reduce(
          (min, g) => Math.min(min, g.timeTaken),
          Number.POSITIVE_INFINITY
        );
        return Math.round(minSeconds / 60);
      })();

      // Build attempt history per simulation for improvement metrics
      const attemptsBySimulation = new Map<
        string,
        Array<{ createdAt: Date; percent: number }>
      >();
      userGrades.forEach((grade) => {
        const chat = userChats.find((c) => c.id === grade.simulationChatId);
        if (!chat) return;
        const attempt = userAttempts.find((a) => a.id === chat.attemptId);
        if (!attempt) return;
        const simId = attempt.simulationId;
        const rubric = rubrics.find((r) => r.id === grade.rubricId);
        const pct = (grade.score / (rubric?.points || 100)) * 100;
        const arr = attemptsBySimulation.get(simId) || [];
        arr.push({ createdAt: new Date(attempt.createdAt), percent: pct });
        attemptsBySimulation.set(simId, arr);
      });

      // Most Improved (percent points) and Rapid Riser (improvement rate per day)
      let mostImprovedPercent = 0;
      let improvementRatePerDay = 0;
      attemptsBySimulation.forEach((entries) => {
        if (entries.length < 2) return;
        const sorted = entries.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );
        const first = sorted[0]!;
        const last = sorted[sorted.length - 1]!;
        const improvement = last.percent - first.percent;
        if (improvement > mostImprovedPercent) {
          mostImprovedPercent = improvement;
        }
        const days = Math.max(
          1,
          (last.createdAt.getTime() - first.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const rate = improvement / days;
        if (rate > improvementRatePerDay) {
          improvementRatePerDay = rate;
        }
      });

      // Total attempts
      const totalAttempts = userAttempts.length;

      return {
        id: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
        // Accolade-aligned metrics
        timeSpentMinutes: Math.round(timeSpentMinutes),
        improvementRatePerDay: Math.round(improvementRatePerDay),
        messagesPerSession: Math.round(messagesPerSession),
        perfectScoreCount: 0, // Placeholder, will be calculated later
        quickestPassMinutes,
        totalAttempts,
        highestScoreAvg: Math.round(avgScore),
        mostImprovedPercent: Math.round(mostImprovedPercent),
        // placeholder; will set percentile below
        percentile: 0,
      };
    });

    // Compute normalized composite score for percentile calculation using table metrics
    const metricKeys = [
      "timeSpentMinutes",
      "improvementRatePerDay",
      "messagesPerSession",
      "perfectScoreCount",
      "quickestPassMinutes",
      "totalAttempts",
      "highestScoreAvg",
      "mostImprovedPercent",
    ] as const;
    type MetricKey = (typeof metricKeys)[number];

    const values: Record<MetricKey, number[]> = {
      timeSpentMinutes: rows.map((r) => r.timeSpentMinutes),
      improvementRatePerDay: rows.map((r) => r.improvementRatePerDay),
      messagesPerSession: rows.map((r) => r.messagesPerSession),
      perfectScoreCount: rows.map((r) => r.perfectScoreCount),
      quickestPassMinutes: rows.map((r) => r.quickestPassMinutes),
      totalAttempts: rows.map((r) => r.totalAttempts),
      highestScoreAvg: rows.map((r) => r.highestScoreAvg),
      mostImprovedPercent: rows.map((r) => r.mostImprovedPercent),
    };

    const minMax: Record<MetricKey, { min: number; max: number }> =
      metricKeys.reduce(
        (acc, key) => {
          const arr = values[key];
          const min = Math.min(...arr);
          const max = Math.max(...arr);
          acc[key] = { min, max };
          return acc;
        },
        {} as Record<MetricKey, { min: number; max: number }>
      );

    const normalize = (
      value: number,
      min: number,
      max: number,
      invert = false
    ) => {
      if (!isFinite(value)) return 0.5;
      if (max === min) return 0.5;
      const n = (value - min) / (max - min);
      const clamped = Math.max(0, Math.min(1, n));
      return invert ? 1 - clamped : clamped;
    };

    // Weights sum ~1.0; tune as needed
    const weights = {
      highestScoreAvg: 0.25,
      mostImprovedPercent: 0.2,
      improvementRatePerDay: 0.15,
      messagesPerSession: 0.1,
      timeSpentMinutes: 0.1,
      totalAttempts: 0.05,
      perfectScoreCount: 0.1,
      quickestPassMinutes: 0.05, // inverted
    } as const;

    const compositeById = new Map<string, number>();
    rows.forEach((r) => {
      const composite =
        normalize(
          r.highestScoreAvg,
          minMax.highestScoreAvg.min,
          minMax.highestScoreAvg.max
        ) *
          weights.highestScoreAvg +
        normalize(
          r.mostImprovedPercent,
          minMax.mostImprovedPercent.min,
          minMax.mostImprovedPercent.max
        ) *
          weights.mostImprovedPercent +
        normalize(
          r.improvementRatePerDay,
          minMax.improvementRatePerDay.min,
          minMax.improvementRatePerDay.max
        ) *
          weights.improvementRatePerDay +
        normalize(
          r.messagesPerSession,
          minMax.messagesPerSession.min,
          minMax.messagesPerSession.max
        ) *
          weights.messagesPerSession +
        normalize(
          r.timeSpentMinutes,
          minMax.timeSpentMinutes.min,
          minMax.timeSpentMinutes.max
        ) *
          weights.timeSpentMinutes +
        normalize(
          r.totalAttempts,
          minMax.totalAttempts.min,
          minMax.totalAttempts.max
        ) *
          weights.totalAttempts +
        normalize(
          r.perfectScoreCount,
          minMax.perfectScoreCount.min,
          minMax.perfectScoreCount.max
        ) *
          weights.perfectScoreCount +
        normalize(
          r.quickestPassMinutes,
          minMax.quickestPassMinutes.min,
          minMax.quickestPassMinutes.max,
          true
        ) *
          weights.quickestPassMinutes;
      compositeById.set(r.id, composite);
    });

    const composites = rows.map((r) => compositeById.get(r.id) || 0);
    const n = composites.length || 1;

    const rowsWithPercentile = rows.map((r) => {
      const comp = compositeById.get(r.id) || 0;
      const numLower = composites.filter((v) => v < comp).length;
      const numEqual = composites.filter((v) => v === comp).length;
      const percentile = Math.round(((numLower + 0.5 * numEqual) / n) * 100);
      return { ...r, percentile };
    });

    // Return only top 25% by percentile, descending
    const sortedByPercentileDesc = rowsWithPercentile.sort(
      (a, b) => b.percentile - a.percentile
    );
    const totalCount = filteredData.profiles.length;
    const topCount = Math.max(1, Math.ceil(totalCount * 0.25));
    const topQuarter = sortedByPercentileDesc.slice(0, topCount);
    return topQuarter;
  }, [filteredData, rubrics, messages]);

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
        <div className="relative">
          {/* Accolades Grid */}
          <div
            className="relative group"
            onMouseEnter={() => setIsHoveringAccolades(true)}
            onMouseLeave={() => setIsHoveringAccolades(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {getVisibleAccolades().map(({ key, icon, title, accolade }) => (
                <div
                  key={key}
                  className="transition-all duration-500 ease-in-out"
                >
                  <AccoladeCard
                    icon={icon}
                    title={title}
                    user={accolade?.holder}
                    details={accolade?.details || ""}
                    layoutId={`accolade-${key}`}
                    onClick={
                      accolade?.holder
                        ? () => setSelected({ key, title, icon, accolade })
                        : undefined
                    }
                    disabled={false}
                  />
                </div>
              ))}
            </div>

            {/* Accolade Navigation Chevrons */}
            {manualPages > 1 && (
              <>
                <button
                  aria-label="Previous accolades"
                  className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHoveringAccolades ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateAccolades("prev")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  aria-label="Next accolades"
                  className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                    isHoveringAccolades ? "opacity-100" : "opacity-0"
                  } hover:opacity-100`}
                  onClick={() => navigateAccolades("next")}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Accolade carousel indicators */}
          {manualPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: manualPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAccoladePageIndex(index);
                    resetAuto();
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === accoladePageIndex ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
        <AnimatePresence>
          {selected && (
            <motion.div
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                layoutId={`accolade-${selected.key}`}
                className="relative w-full max-w-3xl rounded-3xl bg-card shadow-2xl ring-1 ring-border p-6"
                onClick={(e) => e.stopPropagation()}
                initial={{ y: 20, scale: 0.98, opacity: 0 }}
                animate={{
                  y: 0,
                  scale: 1,
                  opacity: 1,
                  transition: { type: "spring", stiffness: 160, damping: 20 },
                }}
                exit={{ y: 20, opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-label={`${selected.title} details`}
              >
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 rounded-full p-2 hover:bg-muted text-muted-foreground"
                  aria-label="Close"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-lg p-3 bg-muted/60">
                    {selected.icon}
                  </div>
                  <div className="text-xl font-semibold">{selected.title}</div>
                </div>

                {selected.accolade.holder ? (
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Avatar
                        className="h-10 w-10 outline outline-muted-foreground"
                        style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                      >
                        <AvatarFallback>
                          {getInitials(
                            selected.accolade.holder.firstName,
                            selected.accolade.holder.lastName
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {selected.accolade.holder.firstName}{" "}
                          {selected.accolade.holder.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selected.accolade.details}
                        </div>
                      </div>
                    </div>
                    {canViewReports && (
                      <Link
                        href={`/analytics/reports/p/${selected.accolade.holder.id}`}
                        className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                      >
                        View report
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-6">
                    No winner yet.
                  </div>
                )}

                <div>
                  <div className="text-sm font-semibold mb-2">
                    Challengers (closing in)
                  </div>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Coming soon
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
