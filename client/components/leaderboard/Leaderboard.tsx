/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import type { LeaderboardOut } from "@/app/(main)/analytics/leaderboard/page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProfile } from "@/contexts/profile-context";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Clock,
  Crown,
  MessageSquareText,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AccoladeCard from "./AccoladeCard";
import LeaderboardTable from "./LeaderboardTable";

type ProfileRole = "superadmin" | "admin" | "instructional" | "ta" | "guest";

type LeaderboardMetric = {
  hasData: boolean;
  method: string;
  currentValue: number;
  keyField?: string | null;
  trendData: unknown[];
  dataPoints: unknown[];
  hover: Record<string, unknown>;
};

type LeaderboardRow = {
  profileId: string;
  firstName: string;
  lastName: string;
  metrics: {
    totalAttempts: LeaderboardMetric;
    highestScoreAvg: LeaderboardMetric;
    messagesPerSession: LeaderboardMetric;
    personaResponseSeconds: LeaderboardMetric;
    timeSpentMinutes: LeaderboardMetric;
    improvementRatePerDay: LeaderboardMetric;
    perfectScoreCount: LeaderboardMetric;
    quickestPassMinutes: LeaderboardMetric;
  };
};

// Helper function to get initials from name
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

export interface LeaderboardProps {
  cohortId?: string;
  leaderboardData: LeaderboardOut;
}

export default function Leaderboard({
  cohortId,
  leaderboardData,
}: LeaderboardProps) {
  const { effectiveProfile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  // Use the data directly from props (fetched server-side)
  const hydratedRows = useMemo(() => {
    return leaderboardData?.data || [];
  }, [leaderboardData?.data]);

  // Data is always available from server-side fetch
  const isError = false;

  // Randomize order on mount
  const [seed, setSeed] = useState(0);

  // Selection state
  const [selected, setSelected] = useState<{
    key: string;
    title: string;
    icon: React.ReactNode;
    accolade: { holder: LeaderboardRow | undefined; details: string };
  } | null>(null);

  // Randomize order when component mounts or route changes
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

  // Compute accolade winners from hydrated rows using currentValue from server
  const computedAccolades = useMemo(() => {
    // Helper to get current value from metric (now provided by server)
    const getCurrentValue = (metric: {
      hasData: boolean;
      currentValue?: number;
    }) => {
      return metric.hasData && metric.currentValue != null
        ? metric.currentValue
        : 0;
    };

    // Helper to pick winner based on current value
    const pickMaxByMetric = (metricKey: keyof LeaderboardRow["metrics"]) =>
      hydratedRows.reduce(
        (best, cur) => {
          const bestValue = best ? getCurrentValue(best.metrics[metricKey]) : 0;
          const curValue = getCurrentValue(cur.metrics[metricKey]);
          return curValue > bestValue ? cur : best;
        },
        hydratedRows[0] as LeaderboardRow | undefined,
      );

    const pickMinPositiveByMetric = (
      metricKey: keyof LeaderboardRow["metrics"],
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
          ? `${Math.round(getCurrentValue(highestScorerRow.metrics.highestScoreAvg))} avg`
          : "",
      },
      responseTimes: {
        holder: responseTimesRow,
        details: responseTimesRow
          ? `${Math.round(getCurrentValue(responseTimesRow.metrics.personaResponseSeconds))}s`
          : "",
      },
      rapidRiser: {
        holder: rapidRiserRow,
        details: rapidRiserRow
          ? `+${Math.round(getCurrentValue(rapidRiserRow.metrics.improvementRatePerDay))} pts/day`
          : "",
      },
      longestConvo: {
        holder: longestConvoRow,
        details: longestConvoRow
          ? `${Math.round(getCurrentValue(longestConvoRow.metrics.messagesPerSession))} msgs/session`
          : "",
      },
      marathonRunner: {
        holder: marathonRunnerRow,
        details: marathonRunnerRow
          ? `${Math.round(getCurrentValue(marathonRunnerRow.metrics.timeSpentMinutes))} min`
          : "",
      },
      thePersistent: {
        holder: persistentRow,
        details: persistentRow
          ? `${Math.round(getCurrentValue(persistentRow.metrics.totalAttempts))} attempts`
          : "",
      },
      quickestPass: {
        holder: quickestPassRow,
        details: quickestPassRow
          ? `${Math.round(getCurrentValue(quickestPassRow.metrics.quickestPassMinutes))} min`
          : "",
      },
      perfectScore: {
        holder: perfectScoreRow,
        details: perfectScoreRow
          ? getCurrentValue(perfectScoreRow.metrics.perfectScoreCount) > 0
            ? `${Math.round(getCurrentValue(perfectScoreRow.metrics.perfectScoreCount))} perfect`
            : `${Math.round(getCurrentValue(perfectScoreRow.metrics.highestScoreAvg))} avg`
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

  // Rotate for randomization and take first 8 items
  const displayedAccolades = useMemo(() => {
    if (!allAccolades.length) return [];
    const rotated = Array.from(
      { length: allAccolades.length },
      (_, i) => allAccolades[(i + seed) % allAccolades.length],
    );
    return rotated.slice(0, 8);
  }, [allAccolades, seed]);

  // Calculate challengers for each accolade using currentValue from server
  const getChallengers = (
    accoladeKey: string,
    currentWinner: LeaderboardRow | null | undefined,
  ) => {
    if (!hydratedRows || hydratedRows.length === 0) return [];

    // Helper to get current value from metric (now provided by server)
    const getCurrentValue = (metric: {
      hasData: boolean;
      currentValue?: number;
    }) => {
      return metric.hasData && metric.currentValue != null
        ? metric.currentValue
        : 0;
    };

    // Filter out the current winner
    const challengers = hydratedRows.filter(
      (r) => !currentWinner || r.profileId !== currentWinner.profileId,
    );

    // Sort by the relevant metric for each accolade
    const sortedChallengers = challengers.sort((a, b) => {
      switch (accoladeKey) {
        case "perfectScore":
          // Sort by perfect score count, then by highest score avg
          const aPerfect = getCurrentValue(a.metrics.perfectScoreCount);
          const bPerfect = getCurrentValue(b.metrics.perfectScoreCount);
          if (aPerfect !== bPerfect) return bPerfect - aPerfect;
          return (
            getCurrentValue(b.metrics.highestScoreAvg) -
            getCurrentValue(a.metrics.highestScoreAvg)
          );

        case "longestConvo":
          return (
            getCurrentValue(b.metrics.messagesPerSession) -
            getCurrentValue(a.metrics.messagesPerSession)
          );

        case "responseTimes":
          // For response times, we want the lowest positive values (fastest responders)
          const aResponseTime = getCurrentValue(
            a.metrics.personaResponseSeconds,
          );
          const bResponseTime = getCurrentValue(
            b.metrics.personaResponseSeconds,
          );
          if (aResponseTime <= 0 && bResponseTime <= 0) return 0;
          if (aResponseTime <= 0) return 1;
          if (bResponseTime <= 0) return -1;
          return aResponseTime - bResponseTime;

        case "quickestPass":
          // For quickest pass, we want the lowest positive values
          const aTime = getCurrentValue(a.metrics.quickestPassMinutes);
          const bTime = getCurrentValue(b.metrics.quickestPassMinutes);
          if (aTime <= 0 && bTime <= 0) return 0;
          if (aTime <= 0) return 1;
          if (bTime <= 0) return -1;
          return aTime - bTime;

        case "thePersistent":
          return (
            getCurrentValue(b.metrics.totalAttempts) -
            getCurrentValue(a.metrics.totalAttempts)
          );

        case "marathonRunner":
          return (
            getCurrentValue(b.metrics.timeSpentMinutes) -
            getCurrentValue(a.metrics.timeSpentMinutes)
          );

        case "rapidRiser":
          return (
            getCurrentValue(b.metrics.improvementRatePerDay) -
            getCurrentValue(a.metrics.improvementRatePerDay)
          );

        case "highestScorer":
          return (
            getCurrentValue(b.metrics.highestScoreAvg) -
            getCurrentValue(a.metrics.highestScoreAvg)
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
          metricValue = getCurrentValue(row.metrics.perfectScoreCount);
          metricLabel =
            metricValue > 0
              ? `${Math.round(metricValue)} perfect`
              : `${Math.round(getCurrentValue(row.metrics.highestScoreAvg))} avg`;
          break;
        case "longestConvo":
          metricValue = getCurrentValue(row.metrics.messagesPerSession);
          metricLabel = `${Math.round(metricValue)} msgs/session`;
          break;
        case "responseTimes":
          metricValue = getCurrentValue(row.metrics.personaResponseSeconds);
          metricLabel = `${Math.round(metricValue)}s`;
          break;
        case "quickestPass":
          metricValue = getCurrentValue(row.metrics.quickestPassMinutes);
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "thePersistent":
          metricValue = getCurrentValue(row.metrics.totalAttempts);
          metricLabel = `${Math.round(metricValue)} attempts`;
          break;
        case "marathonRunner":
          metricValue = getCurrentValue(row.metrics.timeSpentMinutes);
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "rapidRiser":
          metricValue = getCurrentValue(row.metrics.improvementRatePerDay);
          metricLabel = `+${Math.round(metricValue)} pts/day`;
          break;
        case "highestScorer":
          metricValue = getCurrentValue(row.metrics.highestScoreAvg);
          metricLabel = `${Math.round(metricValue)} avg`;
          break;
        default:
          metricValue = 0;
          metricLabel = "";
      }

      return { row, metricValue, metricLabel };
    });
  };

  // Calculate leaderboard data sorted by highest score using currentValue from server
  const processedLeaderboardData = useMemo(() => {
    if (hydratedRows && hydratedRows.length > 0) {
      // Helper to get current value from metric (now provided by server)
      const getCurrentValue = (metric: {
        hasData: boolean;
        currentValue?: number;
      }) => {
        return metric.hasData && metric.currentValue != null
          ? metric.currentValue
          : 0;
      };

      const rows = hydratedRows.map((r) => ({
        id: r.profileId,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.profileId,
        timeSpentMinutes: getCurrentValue(r.metrics.timeSpentMinutes),
        improvementRatePerDay: getCurrentValue(r.metrics.improvementRatePerDay),
        messagesPerSession: getCurrentValue(r.metrics.messagesPerSession),
        perfectScoreCount: getCurrentValue(r.metrics.perfectScoreCount),
        quickestPassMinutes: getCurrentValue(r.metrics.quickestPassMinutes),
        totalAttempts: getCurrentValue(r.metrics.totalAttempts),
        highestScoreAvg: getCurrentValue(r.metrics.highestScoreAvg),
        personaResponseSeconds: getCurrentValue(
          r.metrics.personaResponseSeconds,
        ),
      }));

      // Sort by highest score descending
      const sortedByHighestScore = rows.sort(
        (a, b) => b.highestScoreAvg - a.highestScoreAvg,
      );

      // Take top 25% based on highest score
      const topCount = Math.max(
        1,
        Math.ceil(sortedByHighestScore.length * 0.25),
      );
      return sortedByHighestScore.slice(0, topCount);
    }
    return [];
  }, [hydratedRows]);

  if (isError || !hydratedRows.length) {
    return (
      <div>
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
      <div className="space-y-8">
        {/* Accolades Section */}
        <div className="relative">
          {/* Accolades Grid */}
          <div className="relative group">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedAccolades
                .filter((item): item is NonNullable<typeof item> =>
                  Boolean(item),
                )
                .map(({ key, icon, title, accolade }) => (
                  <AccoladeCard
                    key={key}
                    icon={icon}
                    title={title}
                    user={
                      accolade?.holder
                        ? {
                            id: accolade.holder.profileId,
                            firstName: accolade.holder.firstName ?? "",
                            lastName: accolade.holder.lastName ?? "",
                            role: "guest" as ProfileRole,
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
                            primaryDepartmentId: null,
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
                            selected.accolade.holder.lastName ?? "",
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
                        selected.accolade.holder,
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
                                    challenger.row.lastName ?? "",
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
