/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import type { LeaderboardOut } from "@/app/(main)/leaderboard/page";
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
import AccoladeCard, { AccoladeCardSkeleton } from "./AccoladeCard";
import LeaderboardTable, { LeaderboardTableSkeleton } from "./LeaderboardTable";

type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest";

type LeaderboardMetric = {
  has_data: boolean | null;
  method: string | null;
  current_value: number | null;
  key_field?: string | null;
  trend_data: string[] | null;
  data_points: string[] | null;
  hover: string | null;
};

type LeaderboardRow = {
  profile_id: string | null;
  first_name: string | null;
  last_name: string | null;
  simulation_ids: string[] | null;
  scenario_ids: string[] | null;
  metrics: {
    total_attempts: LeaderboardMetric | null;
    highest_score_avg: LeaderboardMetric | null;
    messages_per_session: LeaderboardMetric | null;
    persona_response_seconds: LeaderboardMetric | null;
    time_spent_minutes: LeaderboardMetric | null;
    improvement_rate_per_day: LeaderboardMetric | null;
    perfect_score_count: LeaderboardMetric | null;
    quickest_pass_minutes: LeaderboardMetric | null;
  } | null;
};

// Helper function to get initials from name
const getInitials = (firstName: string | null, lastName: string | null): string => {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return `${first}${last}`.toUpperCase();
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

  // Extract gradient colors from leaderboardData
  const gradientStartColor =
    leaderboardData?.primary_color || "rgba(59, 130, 246, 0.8)";
  const gradientEndColor =
    leaderboardData?.accent_color || "rgba(59, 130, 246, 0.8)";

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
    if (cohortId && effectiveProfile?.role === "member") {
      return;
    }
    router.push(`/analytics/reports/p/${profileId}`);
  };

  // Check if navigation should be disabled for TAs viewing a specific cohort
  const shouldDisableNavigation =
    cohortId && effectiveProfile?.role === "member";

  // Check if user has permission to view reports (instructional and above)
  const canViewReports =
    effectiveProfile?.role === "superadmin" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "instructional";

  // Compute accolade winners from hydrated rows using current_value from server
  const computedAccolades = useMemo(() => {
    // Helper to get current value from metric (now provided by server)
    const getCurrentValue = (metric: {
      has_data: boolean | null;
      current_value?: number | null;
    } | null | undefined) => {
      if (!metric) return 0;
      return metric.has_data && metric.current_value != null
        ? metric.current_value
        : 0;
    };

    // Helper to pick winner based on current value
    type MetricKey = "total_attempts" | "highest_score_avg" | "messages_per_session" | "persona_response_seconds" | "time_spent_minutes" | "improvement_rate_per_day" | "perfect_score_count" | "quickest_pass_minutes";
    const pickMaxByMetric = (metricKey: MetricKey) => {
      if (!hydratedRows.length) return undefined;
      return hydratedRows.reduce(
        (best, cur) => {
          if (!cur.metrics) return best;
          const bestValue = best && best.metrics ? getCurrentValue(best.metrics[metricKey]) : 0;
          const curValue = getCurrentValue(cur.metrics[metricKey]);
          return curValue > bestValue ? cur : best;
        },
        hydratedRows[0] as LeaderboardRow | undefined,
      );
    };

    const pickMinPositiveByMetric = (
      metricKey: MetricKey,
    ) => {
      const positives = hydratedRows.filter((r) => {
        if (!r.metrics) return false;
        const value = getCurrentValue(r.metrics[metricKey]);
        return value > 0;
      });
      if (!positives.length) return undefined;
      return positives.reduce((best, cur) => {
        if (!best?.metrics || !cur.metrics) return best || cur;
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

    const highestScorerRow = pickMaxByMetric("highest_score_avg");
    const responseTimesRow = pickMinPositiveByMetric("persona_response_seconds");
    const rapidRiserRow = pickMaxByMetric("improvement_rate_per_day");
    const longestConvoRow = pickMaxByMetric("messages_per_session");
    const marathonRunnerRow = pickMaxByMetric("time_spent_minutes");
    const persistentRow = pickMaxByMetric("total_attempts");
    const quickestPassRow = pickMinPositiveByMetric("quickest_pass_minutes");
    const perfectScoreRow = (() => {
      const byCount = pickMaxByMetric("perfect_score_count");
      if (byCount && byCount.metrics && getCurrentValue(byCount.metrics.perfect_score_count) > 0)
        return byCount;
      // Only fall back to highest score if no one has perfect scores
      return highestScorerRow;
    })();
    return {
      highestScorer: {
        holder: highestScorerRow,
        details: highestScorerRow && highestScorerRow.metrics
          ? `${Math.round(getCurrentValue(highestScorerRow.metrics.highest_score_avg))} avg`
          : "",
      },
      responseTimes: {
        holder: responseTimesRow,
        details: responseTimesRow && responseTimesRow.metrics
          ? `${Math.round(getCurrentValue(responseTimesRow.metrics.persona_response_seconds))}s`
          : "",
      },
      rapidRiser: {
        holder: rapidRiserRow,
        details: rapidRiserRow && rapidRiserRow.metrics
          ? `+${Math.round(getCurrentValue(rapidRiserRow.metrics.improvement_rate_per_day))} pts/day`
          : "",
      },
      longestConvo: {
        holder: longestConvoRow,
        details: longestConvoRow && longestConvoRow.metrics
          ? `${Math.round(getCurrentValue(longestConvoRow.metrics.messages_per_session))} msgs/session`
          : "",
      },
      marathonRunner: {
        holder: marathonRunnerRow,
        details: marathonRunnerRow && marathonRunnerRow.metrics
          ? `${Math.round(getCurrentValue(marathonRunnerRow.metrics.time_spent_minutes))} min`
          : "",
      },
      thePersistent: {
        holder: persistentRow,
        details: persistentRow && persistentRow.metrics
          ? `${Math.round(getCurrentValue(persistentRow.metrics.total_attempts))} attempts`
          : "",
      },
      quickestPass: {
        holder: quickestPassRow,
        details: quickestPassRow && quickestPassRow.metrics
          ? `${Math.round(getCurrentValue(quickestPassRow.metrics.quickest_pass_minutes))} min`
          : "",
      },
      perfectScore: {
        holder: perfectScoreRow,
        details: perfectScoreRow && perfectScoreRow.metrics
          ? getCurrentValue(perfectScoreRow.metrics.perfect_score_count) > 0
            ? `${Math.round(getCurrentValue(perfectScoreRow.metrics.perfect_score_count))} perfect`
            : `${Math.round(getCurrentValue(perfectScoreRow.metrics.highest_score_avg))} avg`
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

  // Calculate challengers for each accolade using current_value from server
  const getChallengers = (
    accoladeKey: string,
    currentWinner: LeaderboardRow | null | undefined,
  ) => {
    if (!hydratedRows || hydratedRows.length === 0) return [];

    // Helper to get current value from metric (now provided by server)
    const getCurrentValue = (metric: {
      has_data: boolean | null;
      current_value?: number | null;
    } | null | undefined) => {
      if (!metric) return 0;
      return metric.has_data && metric.current_value != null
        ? metric.current_value
        : 0;
    };

    // Filter out the current winner
    const challengers = hydratedRows.filter(
      (r) => !currentWinner || r.profile_id !== currentWinner.profile_id,
    );

    // Sort by the relevant metric for each accolade
    const sortedChallengers = challengers.sort((a, b) => {
      if (!a.metrics || !b.metrics) return 0;
      
      switch (accoladeKey) {
        case "perfectScore":
          // Sort by perfect score count, then by highest score avg
          const aPerfect = getCurrentValue(a.metrics.perfect_score_count);
          const bPerfect = getCurrentValue(b.metrics.perfect_score_count);
          if (aPerfect !== bPerfect) return bPerfect - aPerfect;
          return (
            getCurrentValue(b.metrics.highest_score_avg) -
            getCurrentValue(a.metrics.highest_score_avg)
          );

        case "longestConvo":
          return (
            getCurrentValue(b.metrics.messages_per_session) -
            getCurrentValue(a.metrics.messages_per_session)
          );

        case "responseTimes":
          // For response times, we want the lowest positive values (fastest responders)
          const aResponseTime = getCurrentValue(
            a.metrics.persona_response_seconds,
          );
          const bResponseTime = getCurrentValue(
            b.metrics.persona_response_seconds,
          );
          if (aResponseTime <= 0 && bResponseTime <= 0) return 0;
          if (aResponseTime <= 0) return 1;
          if (bResponseTime <= 0) return -1;
          return aResponseTime - bResponseTime;

        case "quickestPass":
          // For quickest pass, we want the lowest positive values
          const aTime = getCurrentValue(a.metrics.quickest_pass_minutes);
          const bTime = getCurrentValue(b.metrics.quickest_pass_minutes);
          if (aTime <= 0 && bTime <= 0) return 0;
          if (aTime <= 0) return 1;
          if (bTime <= 0) return -1;
          return aTime - bTime;

        case "thePersistent":
          return (
            getCurrentValue(b.metrics.total_attempts) -
            getCurrentValue(a.metrics.total_attempts)
          );

        case "marathonRunner":
          return (
            getCurrentValue(b.metrics.time_spent_minutes) -
            getCurrentValue(a.metrics.time_spent_minutes)
          );

        case "rapidRiser":
          return (
            getCurrentValue(b.metrics.improvement_rate_per_day) -
            getCurrentValue(a.metrics.improvement_rate_per_day)
          );

        case "highestScorer":
          return (
            getCurrentValue(b.metrics.highest_score_avg) -
            getCurrentValue(a.metrics.highest_score_avg)
          );

        default:
          return 0;
      }
    });

    return sortedChallengers.slice(0, 5).map((row) => {
      if (!row.metrics) {
        return { row, metricValue: 0, metricLabel: "" };
      }

      let metricValue: number;
      let metricLabel: string;

      switch (accoladeKey) {
        case "perfectScore":
          metricValue = getCurrentValue(row.metrics.perfect_score_count);
          metricLabel =
            metricValue > 0
              ? `${Math.round(metricValue)} perfect`
              : `${Math.round(getCurrentValue(row.metrics.highest_score_avg))} avg`;
          break;
        case "longestConvo":
          metricValue = getCurrentValue(row.metrics.messages_per_session);
          metricLabel = `${Math.round(metricValue)} msgs/session`;
          break;
        case "responseTimes":
          metricValue = getCurrentValue(row.metrics.persona_response_seconds);
          metricLabel = `${Math.round(metricValue)}s`;
          break;
        case "quickestPass":
          metricValue = getCurrentValue(row.metrics.quickest_pass_minutes);
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "thePersistent":
          metricValue = getCurrentValue(row.metrics.total_attempts);
          metricLabel = `${Math.round(metricValue)} attempts`;
          break;
        case "marathonRunner":
          metricValue = getCurrentValue(row.metrics.time_spent_minutes);
          metricLabel = `${Math.round(metricValue)} min`;
          break;
        case "rapidRiser":
          metricValue = getCurrentValue(row.metrics.improvement_rate_per_day);
          metricLabel = `+${Math.round(metricValue)} pts/day`;
          break;
        case "highestScorer":
          metricValue = getCurrentValue(row.metrics.highest_score_avg);
          metricLabel = `${Math.round(metricValue)} avg`;
          break;
        default:
          metricValue = 0;
          metricLabel = "";
      }

      return { row, metricValue, metricLabel };
    });
  };

  // Calculate leaderboard data sorted by highest score using current_value from server
  const processedLeaderboardData = useMemo(() => {
    if (hydratedRows && hydratedRows.length > 0) {
      // Helper to get current value from metric (now provided by server)
      const getCurrentValue = (metric: {
        has_data: boolean | null;
        current_value?: number | null;
      } | null | undefined) => {
        if (!metric) return 0;
        return metric.has_data && metric.current_value != null
          ? metric.current_value
          : 0;
      };

      const rows = hydratedRows
        .filter((r) => r.metrics !== null && r.profile_id !== null)
        .map((r) => ({
          id: r.profile_id!,
          name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || r.profile_id!,
          profileId: r.profile_id!, // Add profileId for filtering
          simulationIds: (r.simulation_ids || []).map(String), // Add simulation IDs for filtering
          scenarioIds: (r.scenario_ids || []).map(String), // Add scenario IDs for filtering
          timeSpentMinutes: getCurrentValue(r.metrics!.time_spent_minutes),
          improvementRatePerDay: getCurrentValue(r.metrics!.improvement_rate_per_day),
          messagesPerSession: getCurrentValue(r.metrics!.messages_per_session),
          perfectScoreCount: getCurrentValue(r.metrics!.perfect_score_count),
          quickestPassMinutes: getCurrentValue(r.metrics!.quickest_pass_minutes),
          totalAttempts: getCurrentValue(r.metrics!.total_attempts),
          highestScoreAvg: getCurrentValue(r.metrics!.highest_score_avg),
          personaResponseSeconds: getCurrentValue(
            r.metrics!.persona_response_seconds,
          ),
        }));

      // Server already returns top 25%, just sort by highest score descending
      return rows.sort((a, b) => b.highestScoreAvg - a.highestScoreAvg);
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
    <div className="space-y-6" data-testid="leaderboard-container">
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
                    data-testid={`accolade-${key}`}
                    user={
                      accolade?.holder && accolade.holder.profile_id
                        ? {
                            id: accolade.holder.profile_id,
                            first_name: accolade.holder.first_name ?? null,
                            last_name: accolade.holder.last_name ?? null,
                            emails: [],
                            primary_email: null,
                            role: "guest" as ProfileRole,
                            active: true,
                            created_at: new Date().toISOString(),
                            last_active: null,
                            last_login: new Date().toISOString(),
                            req_per_day: 0,
                            updated_at: new Date().toISOString(),
                            primary_department_id: null,
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
                    gradientStartColor={gradientStartColor}
                    gradientEndColor={gradientEndColor}
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
                            selected.accolade.holder.first_name ?? "",
                            selected.accolade.holder.last_name ?? "",
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {selected.accolade.holder.first_name}{" "}
                          {selected.accolade.holder.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selected.accolade.details}
                        </div>
                      </div>
                    </div>
                    {canViewReports && (
                      <Link
                        href={`/analytics/reports/p/${selected.accolade.holder.profile_id}`}
                        className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
                        data-testid={`btn-view-report-${selected.accolade.holder.profile_id}`}
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
                          key={challenger.row.profile_id}
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
                                    challenger.row.first_name ?? "",
                                    challenger.row.last_name ?? "",
                                  )}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {challenger.row.first_name}{" "}
                                {challenger.row.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {challenger.metricLabel}
                              </div>
                            </div>
                          </div>
                          {canViewReports && (
                            <Link
                              href={`/analytics/reports/p/${challenger.row.profile_id}`}
                              className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              data-testid={`btn-view-report-${challenger.row.profile_id}`}
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
            {...(leaderboardData?.simulations && {
              simulations: leaderboardData.simulations.filter((s): s is { simulation_id: string | null; name: string | null; description: string | null; time_limit: number | null; department_ids: string[] | null } => s.simulation_id !== null && s.name !== null).map(s => {
                const result: { simulation_id: string; name: string; description?: string } = { simulation_id: s.simulation_id!, name: s.name! };
                if (s.description !== null && s.description !== undefined) {
                  result.description = s.description;
                }
                return result;
              })
            })}
            {...(leaderboardData?.scenarios && {
              scenarios: leaderboardData.scenarios.filter((s): s is { scenario_id: string | null; name: string | null; description: string | null } => s.scenario_id !== null && s.name !== null).map(s => {
                const result: { scenario_id: string; name: string; description?: string } = { scenario_id: s.scenario_id!, name: s.name! };
                if (s.description !== null && s.description !== undefined) {
                  result.description = s.description;
                }
                return result;
              })
            })}
            {...(!shouldDisableNavigation && { onViewReport: handleViewReport })}
          />
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="leaderboard-container">
      <div className="space-y-8">
        {/* Accolades Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <AccoladeCardSkeleton key={i} />
          ))}
        </div>

        {/* Leaderboard Table Section */}
        <LeaderboardTableSkeleton />
      </div>
    </div>
  );
}
