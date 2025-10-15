/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAnalytics } from "@/contexts/analytics-context";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import type { LeaderboardRow } from "@/lib/analytics";
import type { AnalyticsFilters } from "@/lib/api/v2/schemas/analytics";
import { useAnalyticsLeaderboardBundle } from "@/lib/api/v2/hooks/analytics";
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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const { effectiveDepartmentIds } = useDepartments();
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();
  const router = useRouter();
  const pathname = usePathname();

  // Build the shared filters
  const filters: AnalyticsFilters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: cohortId ? [cohortId] : selectedCohortIds,
      roles: selectedRoles as unknown as string[],
      simulationFilters,
      departmentIds: effectiveDepartmentIds,
      // profileId: undefined  <-- leave undefined for the grid; filter locally per profile
    }),
    [
      startDate,
      endDate,
      cohortId,
      selectedCohortIds,
      selectedRoles,
      simulationFilters,
      effectiveDepartmentIds,
    ]
  );

  // Load the leaderboard data
  const {
    data: leaderboardResponse,
    isLoading,
    isError,
  } = useAnalyticsLeaderboardBundle(filters);

  // Use the data directly from the API (no hydration needed)
  const hydratedRows = useMemo(() => {
    return leaderboardResponse?.data || [];
  }, [leaderboardResponse?.data]);

  // Two-page carousel state
  const [page, setPage] = useState(0);
  const [seed, setSeed] = useState(0);

  // Track nav direction for animation
  const navDirRef = useRef<"next" | "prev">("next");
  // Prevent initial mount animation
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Selection + rotation pause state
  const [selected, setSelected] = useState<{
    key: string;
    title: string;
    icon: React.ReactNode;
    accolade: { holder: LeaderboardRow | undefined; details: string };
  } | null>(null);
  const [isHoveringAccolades, setIsHoveringAccolades] = useState(false);

  // Randomize which 4 are on page 1 vs page 2 when component mounts or route changes
  useEffect(() => setSeed(Math.floor(Math.random() * 8)), [pathname]);

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

  // Compute accolade winners from hydrated rows using computeCurrent
  const computedAccolades = useMemo(() => {
    // Helper to compute current value from metric with explicit casting
    const getCurrentValue = <
      T extends {
        hasData: boolean;
        method: string;
        dataPoints: DataPoint[];
        keyField?: string | undefined;
      },
    >(
      metric: T
    ) => {
      if (!metric.hasData || !metric.dataPoints.length) return 0;
      return computeCurrent(
        metric.method as
          | "avg"
          | "max"
          | "sum"
          | "rate"
          | "countDistinct"
          | "min"
          | "slope",
        metric.dataPoints,
        "value",
        metric.keyField as
          | "attemptId"
          | "simulationId"
          | "profileId"
          | "date"
          | undefined
      );
    };

    // Helper to pick winner based on computed current value
    const pickMaxByMetric = (metricKey: keyof LeaderboardRow["metrics"]) =>
      hydratedRows.reduce(
        (best, cur) => {
          const bestValue = best ? getCurrentValue(best.metrics[metricKey]) : 0;
          const curValue = getCurrentValue(cur.metrics[metricKey]);
          return curValue > bestValue ? cur : best;
        },
        hydratedRows[0] as LeaderboardRow | undefined
      );

    const pickMinPositiveByMetric = (
      metricKey: keyof LeaderboardRow["metrics"]
    ) => {
      const positives = hydratedRows.filter((r) => {
        const value = getCurrentValue(r.metrics[metricKey]);
        return value > 0;
      });
      if (!positives.length) return undefined;
      return positives.reduce((best, cur) => {
        const bestValue = getCurrentValue(best.metrics[metricKey]);
        const curValue = getCurrentValue(cur.metrics[metricKey]);
        return curValue < bestValue ? cur : best;
      });
    };

    if (!hydratedRows.length) {
      return {
        perfectScore: { holder: undefined, details: "" },
        longestConvo: { holder: undefined, details: "" },
        responseTimes: { holder: undefined, details: "" },
        quickestPass: { holder: undefined, details: "" },
        thePersistent: { holder: undefined, details: "" },
        marathonRunner: { holder: undefined, details: "" },
        rapidRiser: { holder: undefined, details: "" },
        highestScorer: { holder: undefined, details: "" },
      } as const;
    }

    const highestScorerRow = pickMaxByMetric("highestScoreAvg");
    const responseTimesRow = pickMinPositiveByMetric("personaResponseSeconds");
    const rapidRiserRow = pickMaxByMetric("improvementRatePerDay");
    const longestConvoRow = pickMaxByMetric("messagesPerSession");
    const marathonRunnerRow = pickMaxByMetric("timeSpentMinutes");
    const persistentRow = pickMaxByMetric("totalAttempts");
    const quickestPassRow = pickMinPositiveByMetric("quickestPassMinutes");
    const perfectScoreRow = (() => {
      const byCount = pickMaxByMetric("perfectScoreCount");
      if (byCount && getCurrentValue(byCount.metrics.perfectScoreCount) > 0)
        return byCount;
      // Only fall back to highest score if no one has perfect scores
      return highestScorerRow;
    })();
    return {
      highestScorer: {
        holder: highestScorerRow,
        details: highestScorerRow
          ? `${Math.round(getCurrentValue(highestScorerRow.metrics.highestScoreAvg as HighestScoreAvgMetricResponse))} avg`
          : "",
      },
      responseTimes: {
        holder: responseTimesRow,
        details: responseTimesRow
          ? `${Math.round(getCurrentValue(responseTimesRow.metrics.personaResponseSeconds as PersonaResponseSecondsMetricResponse))}s`
          : "",
      },
      rapidRiser: {
        holder: rapidRiserRow,
        details: rapidRiserRow
          ? `+${Math.round(getCurrentValue(rapidRiserRow.metrics.improvementRatePerDay as ImprovementRatePerDayMetricResponse))} pts/day`
          : "",
      },
      longestConvo: {
        holder: longestConvoRow,
        details: longestConvoRow
          ? `${Math.round(getCurrentValue(longestConvoRow.metrics.messagesPerSession as MessagesPerSessionMetricResponse))} msgs/session`
          : "",
      },
      marathonRunner: {
        holder: marathonRunnerRow,
        details: marathonRunnerRow
          ? `${Math.round(getCurrentValue(marathonRunnerRow.metrics.timeSpentMinutes as TimeSpentMinutesMetricResponse))} min`
          : "",
      },
      thePersistent: {
        holder: persistentRow,
        details: persistentRow
          ? `${Math.round(getCurrentValue(persistentRow.metrics.totalAttempts as TotalAttemptsMetricResponse))} attempts`
          : "",
      },
      quickestPass: {
        holder: quickestPassRow,
        details: quickestPassRow
          ? `${Math.round(getCurrentValue(quickestPassRow.metrics.quickestPassMinutes as QuickestPassMinutesMetricResponse))} min`
          : "",
      },
      perfectScore: {
        holder: perfectScoreRow,
        details: perfectScoreRow
          ? getCurrentValue(
              perfectScoreRow.metrics
                .perfectScoreCount as PerfectScoreCountMetricResponse
            ) > 0
            ? `${Math.round(getCurrentValue(perfectScoreRow.metrics.perfectScoreCount as PerfectScoreCountMetricResponse))} perfect`
            : `${Math.round(getCurrentValue(perfectScoreRow.metrics.highestScoreAvg as HighestScoreAvgMetricResponse))} avg`
          : "",
      },
    } as const;
  }, [hydratedRows]);

  // Accolade cards (single set; rotation removed)
  const accoladeSets = useMemo(() => {
    const accolades = computedAccolades;
    const set1 = [
      {
        key: "perfectScore",
        icon: <Award className="h-4 w-4" />,
        title: "Perfect Score",
        accolade: accolades?.perfectScore,
      },
      {
        key: "longestConvo",
        icon: <MessageSquareText className="h-4 w-4" />,
        title: "Longest Convo",
        accolade: accolades?.longestConvo,
      },
      {
        key: "responseTimes",
        icon: <Clock className="h-4 w-4" />,
        title: "Fastest Responses",
        accolade: accolades?.responseTimes,
      },
      {
        key: "quickestPass",
        icon: <Crown className="h-4 w-4" />,
        title: "Quickest Pass",
        accolade: accolades?.quickestPass,
      },
    ];
    const set2 = [
      {
        key: "thePersistent",
        icon: <Target className="h-4 w-4" />,
        title: "The Persistent",
        accolade: accolades?.thePersistent,
      },
      {
        key: "marathonRunner",
        icon: <Clock className="h-4 w-4" />,
        title: "Marathon Runner",
        accolade: accolades?.marathonRunner,
      },
      {
        key: "rapidRiser",
        icon: <TrendingUp className="h-4 w-4" />,
        title: "Rapid Riser",
        accolade: accolades?.rapidRiser,
      },
      {
        key: "highestScorer",
        icon: <Trophy className="h-4 w-4" />,
        title: "Highest Scorer",
        accolade: accolades?.highestScorer,
      },
    ];
    return [set1, set2];
  }, [computedAccolades]);

  // 1) Flatten your two sets once
  const allAccolades = useMemo(() => {
    const set1 = accoladeSets[0] || [];
    const set2 = accoladeSets[1] || [];
    return [...set1, ...set2];
  }, [accoladeSets]);

  // Rotate for randomization
  const rotated = useMemo(() => {
    if (!allAccolades.length) return [];
    return Array.from(
      { length: allAccolades.length },
      (_, i) => allAccolades[(i + seed) % allAccolades.length]
    );
  }, [allAccolades, seed]);

  // 2) Exactly two pages (4 per page)
  const pages = useMemo(() => {
    const a = rotated.slice(0, 4);
    const b = rotated.slice(4, 8);
    return [a, b];
  }, [rotated]);

  const goto = (next: "prev" | "next") => {
    navDirRef.current = next;
    setPage((p) => (next === "next" ? (p + 1) % 2 : (p + 1) % 2)); // toggles 0 ↔ 1 either way
  };

  // Optional: if you still want auto-advance every 3.5s
  // (pause on hover/selected just like before)
  useEffect(() => {
    if (selected || isHoveringAccolades) return;
    const t = setInterval(() => goto("next"), 3500);
    return () => clearInterval(t);
  }, [selected, isHoveringAccolades]);

  // 3) "Split" animation variants (Framer Motion)
  const splitVariants = {
    initial: (ctx: { i: number; dir: "next" | "prev" }) => {
      // For entering items: start slightly off-center toward where they came from
      const leftHalf = ctx.i < 2;
      const bias = 60; // px
      const from =
        ctx.dir === "next"
          ? leftHalf
            ? -bias
            : bias // page slides in opposite lanes
          : leftHalf
            ? bias
            : -bias;
      return { x: from, opacity: 0.0, scale: 0.98 };
    },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 220, damping: 24 },
    },
    exit: (ctx: { i: number; dir: "next" | "prev" }) => {
      // For exiting items: split—left two go right, right two go left
      const leftHalf = ctx.i < 2;
      const to =
        ctx.dir === "next" ? (leftHalf ? 60 : -60) : leftHalf ? -60 : 60;
      return { x: to, opacity: 0, scale: 0.98, transition: { duration: 0.28 } };
    },
  } as const;

  // Calculate challengers for each accolade using computeCurrent
  const getChallengers = (
    accoladeKey: string,
    currentWinner: LeaderboardRow | null | undefined
  ) => {
    if (!hydratedRows || hydratedRows.length === 0) return [];

    // Helper to compute current value from metric with explicit casting
    const getCurrentValue = <
      T extends {
        hasData: boolean;
        method: string;
        dataPoints: DataPoint[];
        keyField?: string | undefined;
      },
    >(
      metric: T
    ) => {
      if (!metric.hasData || !metric.dataPoints.length) return 0;
      return computeCurrent(
        metric.method as
          | "avg"
          | "max"
          | "sum"
          | "rate"
          | "countDistinct"
          | "min"
          | "slope",
        metric.dataPoints,
        "value",
        metric.keyField as
          | "attemptId"
          | "simulationId"
          | "profileId"
          | "date"
          | undefined
      );
    };

    // Filter out the current winner
    const challengers = hydratedRows.filter(
      (r) => !currentWinner || r.profileId !== currentWinner.profileId
    );

    // Sort by the relevant metric for each accolade
    const sortedChallengers = challengers.sort((a, b) => {
      switch (accoladeKey) {
        case "perfectScore":
          // Sort by perfect score count, then by highest score avg
          const aPerfect = getCurrentValue(
            a.metrics.perfectScoreCount as PerfectScoreCountMetricResponse
          );
          const bPerfect = getCurrentValue(
            b.metrics.perfectScoreCount as PerfectScoreCountMetricResponse
          );
          if (aPerfect !== bPerfect) return bPerfect - aPerfect;
          return (
            getCurrentValue(
              b.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
            ) -
            getCurrentValue(
              a.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
            )
          );

        case "longestConvo":
          return (
            getCurrentValue(
              b.metrics.messagesPerSession as MessagesPerSessionMetricResponse
            ) -
            getCurrentValue(
              a.metrics.messagesPerSession as MessagesPerSessionMetricResponse
            )
          );

        case "responseTimes":
          // For response times, we want the lowest positive values (fastest responders)
          const aResponseTime = getCurrentValue(
            a.metrics
              .personaResponseSeconds as PersonaResponseSecondsMetricResponse
          );
          const bResponseTime = getCurrentValue(
            b.metrics
              .personaResponseSeconds as PersonaResponseSecondsMetricResponse
          );
          if (aResponseTime <= 0 && bResponseTime <= 0) return 0;
          if (aResponseTime <= 0) return 1;
          if (bResponseTime <= 0) return -1;
          return aResponseTime - bResponseTime;

        case "quickestPass":
          // For quickest pass, we want the lowest positive values
          const aTime = getCurrentValue(
            a.metrics.quickestPassMinutes as QuickestPassMinutesMetricResponse
          );
          const bTime = getCurrentValue(
            b.metrics.quickestPassMinutes as QuickestPassMinutesMetricResponse
          );
          if (aTime <= 0 && bTime <= 0) return 0;
          if (aTime <= 0) return 1;
          if (bTime <= 0) return -1;
          return aTime - bTime;

        case "thePersistent":
          return (
            getCurrentValue(
              b.metrics.totalAttempts as TotalAttemptsMetricResponse
            ) -
            getCurrentValue(
              a.metrics.totalAttempts as TotalAttemptsMetricResponse
            )
          );

        case "marathonRunner":
          return (
            getCurrentValue(
              b.metrics.timeSpentMinutes as TimeSpentMinutesMetricResponse
            ) -
            getCurrentValue(
              a.metrics.timeSpentMinutes as TimeSpentMinutesMetricResponse
            )
          );

        case "rapidRiser":
          return (
            getCurrentValue(
              b.metrics
                .improvementRatePerDay as ImprovementRatePerDayMetricResponse
            ) -
            getCurrentValue(
              a.metrics
                .improvementRatePerDay as ImprovementRatePerDayMetricResponse
            )
          );

        case "highestScorer":
          return (
            getCurrentValue(
              b.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
            ) -
            getCurrentValue(
              a.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
            )
          );

        default:
          return 0;
      }
    });

    return sortedChallengers.slice(0, 5).map((row) => {
      let metricValue: number;
      let metricLabel: string;

      switch (accoladeKey) {
        case "perfectScore":
          metricValue = getCurrentValue(
            row.metrics.perfectScoreCount as PerfectScoreCountMetricResponse
          );
          metricLabel =
            metricValue > 0
              ? `${Math.round(metricValue)} perfect`
              : `${Math.round(getCurrentValue(row.metrics.highestScoreAvg as HighestScoreAvgMetricResponse))} avg`;
          break;
        case "longestConvo":
          metricValue = getCurrentValue(
            row.metrics.messagesPerSession as MessagesPerSessionMetricResponse
          );
          metricLabel = `${Math.round(metricValue)} msgs/session`;
          break;
        case "responseTimes":
          metricValue = getCurrentValue(
            row.metrics
              .personaResponseSeconds as PersonaResponseSecondsMetricResponse
          );
          metricLabel = `${Math.round(metricValue)}s`;
          break;
        case "quickestPass":
          metricValue = getCurrentValue(
            row.metrics.quickestPassMinutes as QuickestPassMinutesMetricResponse
          );
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "thePersistent":
          metricValue = getCurrentValue(
            row.metrics.totalAttempts as TotalAttemptsMetricResponse
          );
          metricLabel = `${Math.round(metricValue)} attempts`;
          break;
        case "marathonRunner":
          metricValue = getCurrentValue(
            row.metrics.timeSpentMinutes as TimeSpentMinutesMetricResponse
          );
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "rapidRiser":
          metricValue = getCurrentValue(
            row.metrics
              .improvementRatePerDay as ImprovementRatePerDayMetricResponse
          );
          metricLabel = `+${Math.round(metricValue)} pts/day`;
          break;
        case "highestScorer":
          metricValue = getCurrentValue(
            row.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
          );
          metricLabel = `${Math.round(metricValue)} avg`;
          break;
        default:
          metricValue = 0;
          metricLabel = "";
      }

      return { row, metricValue, metricLabel };
    });
  };

  // Calculate leaderboard data sorted by highest score using computeCurrent
  const processedLeaderboardData = useMemo(() => {
    if (hydratedRows && hydratedRows.length > 0) {
      // Helper to compute current value from metric with explicit casting
      const getCurrentValue = <
        T extends {
          hasData: boolean;
          method: string;
          dataPoints: DataPoint[];
          keyField?: string | undefined;
        },
      >(
        metric: T
      ) => {
        if (!metric.hasData || !metric.dataPoints.length) return 0;
        return computeCurrent(
          metric.method as
            | "avg"
            | "max"
            | "sum"
            | "rate"
            | "countDistinct"
            | "min"
            | "slope",
          metric.dataPoints,
          "value",
          metric.keyField as
            | "attemptId"
            | "simulationId"
            | "profileId"
            | "date"
            | undefined
        );
      };

      const rows = hydratedRows.map((r) => ({
        id: r.profileId,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.profileId,
        timeSpentMinutes: getCurrentValue(
          r.metrics.timeSpentMinutes as TimeSpentMinutesMetricResponse
        ),
        improvementRatePerDay: getCurrentValue(
          r.metrics.improvementRatePerDay as ImprovementRatePerDayMetricResponse
        ),
        messagesPerSession: getCurrentValue(
          r.metrics.messagesPerSession as MessagesPerSessionMetricResponse
        ),
        perfectScoreCount: getCurrentValue(
          r.metrics.perfectScoreCount as PerfectScoreCountMetricResponse
        ),
        quickestPassMinutes: getCurrentValue(
          r.metrics.quickestPassMinutes as QuickestPassMinutesMetricResponse
        ),
        totalAttempts: getCurrentValue(
          r.metrics.totalAttempts as TotalAttemptsMetricResponse
        ),
        highestScoreAvg: getCurrentValue(
          r.metrics.highestScoreAvg as HighestScoreAvgMetricResponse
        ),
        personaResponseSeconds: getCurrentValue(
          r.metrics
            .personaResponseSeconds as PersonaResponseSecondsMetricResponse
        ),
      }));

      // Sort by highest score descending
      const sortedByHighestScore = rows.sort(
        (a, b) => b.highestScoreAvg - a.highestScoreAvg
      );

      // Take top 25% based on highest score
      const topCount = Math.max(
        1,
        Math.ceil(sortedByHighestScore.length * 0.25)
      );
      return sortedByHighestScore.slice(0, topCount);
    }
    return [];
  }, [hydratedRows]);

  if (isProfileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (isError || !hydratedRows.length) {
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
              <AnimatePresence mode="popLayout" initial={false}>
                {pages[page]
                  ?.filter((item): item is NonNullable<typeof item> =>
                    Boolean(item)
                  )
                  .map(({ key, icon, title, accolade }, i) => (
                    <motion.div
                      key={`${page}-${key}`} // key must change per page so exit/enter runs
                      custom={{ i, dir: navDirRef.current }}
                      variants={splitVariants}
                      initial={hasMountedRef.current ? "initial" : false}
                      animate="animate"
                      exit="exit"
                      layout
                      className="transition-all duration-500"
                    >
                      <AccoladeCard
                        icon={icon}
                        title={title}
                        user={
                          accolade?.holder
                            ? {
                                id: accolade.holder.profileId,
                                firstName: accolade.holder.firstName ?? "",
                                lastName: accolade.holder.lastName ?? "",
                                role: "guest" as Profile["role"],
                                alias: "",
                                active: true,
                                createdAt: new Date().toISOString(),
                                defaultProfile: false,
                                lastActive: null,
                                lastLogin: new Date().toISOString(),
                                reqPerDay: 0,
                                updatedAt: new Date().toISOString(),
                                viewedChat: false,
                                viewedIntro: false,
                              }
                            : undefined
                        }
                        details={accolade?.details || ""}
                        layoutId={`accolade-${key}`}
                        onClick={
                          accolade?.holder
                            ? () => setSelected({ key, title, icon, accolade })
                            : undefined
                        }
                        disabled={false}
                      />
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>

            {/* Two chevrons; each toggles the page and sets direction */}
            <button
              aria-label="Previous accolades"
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isHoveringAccolades ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => goto("prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Next accolades"
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isHoveringAccolades ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => goto("next")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Two dots */}
            <div className="flex justify-center gap-2 mt-4">
              {[0, 1].map((idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    navDirRef.current = idx > page ? "next" : "prev";
                    setPage(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === page ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {selected && (
            <motion.div
              className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
              style={{ minHeight: "100vh", minWidth: "100vw" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                layoutId={`accolade-${selected.key}`}
                className="relative w-full max-w-3xl rounded-3xl bg-card shadow-2xl ring-1 ring-border p-6 max-h-[90vh] overflow-y-auto"
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
                            selected.accolade.holder.firstName ?? "",
                            selected.accolade.holder.lastName ?? ""
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
                        href={`/analytics/reports/p/${selected.accolade.holder.profileId}`}
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
                    {(() => {
                      const challengers = getChallengers(
                        selected.key,
                        selected.accolade.holder
                      );
                      if (challengers.length === 0) {
                        return (
                          <div className="text-sm text-muted-foreground">
                            No challengers yet.
                          </div>
                        );
                      }
                      return challengers.map((challenger, index) => (
                        <div
                          key={challenger.row.profileId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground w-6">
                                #{index + 1}
                              </span>
                              <Avatar
                                className="h-8 w-8 outline outline-muted-foreground"
                                style={{
                                  outlineWidth: "1px",
                                  outlineStyle: "solid",
                                }}
                              >
                                <AvatarFallback>
                                  {getInitials(
                                    challenger.row.firstName ?? "",
                                    challenger.row.lastName ?? ""
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {challenger.row.firstName}{" "}
                                {challenger.row.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {challenger.metricLabel}
                              </div>
                            </div>
                          </div>
                          {canViewReports && (
                            <Link
                              href={`/analytics/reports/p/${challenger.row.profileId}`}
                              className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              View
                            </Link>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div>
          <LeaderboardTable
            data={processedLeaderboardData}
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
