/**
 * Leaderboard.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import type { AnalyticsFilters, LeaderboardRow } from "@/lib/analytics";
import { useAnalyticsLeaderboardBundle } from "@/lib/api/hooks/analytics";
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
      // profileId: undefined  <-- leave undefined for the grid; filter locally per profile
    }),
    [
      startDate,
      endDate,
      cohortId,
      selectedCohortIds,
      selectedRoles,
      simulationFilters,
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

  // Compute accolade winners from hydrated rows
  const computedAccolades = useMemo(() => {
    // Helpers to pick winners
    const pickMax = (key: keyof LeaderboardRow) =>
      hydratedRows.reduce(
        (best, cur) =>
          best == null ||
          Number(cur[key] ?? 0) >
            Number((best as Record<string, unknown>)?.[key] ?? 0)
            ? cur
            : best,
        hydratedRows[0] as LeaderboardRow | undefined
      );

    const pickMinPositive = (key: keyof LeaderboardRow) => {
      const positives = hydratedRows.filter((r) => Number(r[key] ?? 0) > 0);
      if (!positives.length) return undefined;
      return positives.reduce((best, cur) =>
        Number(cur[key] ?? 0) <
        Number((best as Record<string, unknown>)?.[key] ?? 0)
          ? cur
          : best
      );
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

    const highestScorerRow = pickMax("highestScoreAvg");
    const responseTimesRow = pickMinPositive("personaResponseSeconds");
    const rapidRiserRow = pickMax("improvementRatePerDay");
    const longestConvoRow = pickMax("messagesPerSession");
    const marathonRunnerRow = pickMax("timeSpentMinutes");
    const persistentRow = pickMax("totalAttempts");
    const quickestPassRow = pickMinPositive("quickestPassMinutes");
    const perfectScoreRow = (() => {
      const byCount = pickMax("perfectScoreCount");
      if (byCount && Number(byCount.perfectScoreCount ?? 0) > 0) return byCount;
      // Only fall back to highest score if no one has perfect scores
      return highestScorerRow;
    })();
    return {
      highestScorer: {
        holder: highestScorerRow,
        details: highestScorerRow
          ? `${highestScorerRow.highestScoreAvg} avg`
          : "",
      },
      responseTimes: {
        holder: responseTimesRow,
        details: responseTimesRow
          ? `${responseTimesRow.personaResponseSeconds}s`
          : "",
      },
      rapidRiser: {
        holder: rapidRiserRow,
        details: rapidRiserRow
          ? `+${rapidRiserRow.improvementRatePerDay} pts/day`
          : "",
      },
      longestConvo: {
        holder: longestConvoRow,
        details: longestConvoRow
          ? `${longestConvoRow.messagesPerSession} msgs/session`
          : "",
      },
      marathonRunner: {
        holder: marathonRunnerRow,
        details: marathonRunnerRow
          ? `${marathonRunnerRow.timeSpentMinutes} min`
          : "",
      },
      thePersistent: {
        holder: persistentRow,
        details: persistentRow ? `${persistentRow.totalAttempts} attempts` : "",
      },
      quickestPass: {
        holder: quickestPassRow,
        details: quickestPassRow
          ? `${quickestPassRow.quickestPassMinutes} min`
          : "",
      },
      perfectScore: {
        holder: perfectScoreRow,
        details: perfectScoreRow
          ? Number(perfectScoreRow.perfectScoreCount ?? 0) > 0
            ? `${perfectScoreRow.perfectScoreCount} perfect`
            : `${perfectScoreRow.highestScoreAvg} avg`
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

  // Calculate challengers for each accolade
  const getChallengers = (
    accoladeKey: string,
    currentWinner: LeaderboardRow | null | undefined
  ) => {
    if (!hydratedRows || hydratedRows.length === 0) return [];

    // Filter out the current winner
    const challengers = hydratedRows.filter(
      (r) => !currentWinner || r.profileId !== currentWinner.profileId
    );

    // Sort by the relevant metric for each accolade
    const sortedChallengers = challengers.sort((a, b) => {
      switch (accoladeKey) {
        case "perfectScore":
          // Sort by perfect score count, then by highest score avg
          const aPerfect = Number(a.perfectScoreCount || 0);
          const bPerfect = Number(b.perfectScoreCount || 0);
          if (aPerfect !== bPerfect) return bPerfect - aPerfect;
          return (
            Number(b.highestScoreAvg || 0) - Number(a.highestScoreAvg || 0)
          );

        case "longestConvo":
          return (
            Number(b.messagesPerSession || 0) -
            Number(a.messagesPerSession || 0)
          );

        case "responseTimes":
          // For response times, we want the lowest positive values (fastest responders)
          const aResponseTime = Number(a.personaResponseSeconds || 0);
          const bResponseTime = Number(b.personaResponseSeconds || 0);
          if (aResponseTime <= 0 && bResponseTime <= 0) return 0;
          if (aResponseTime <= 0) return 1;
          if (bResponseTime <= 0) return -1;
          return aResponseTime - bResponseTime;

        case "quickestPass":
          // For quickest pass, we want the lowest positive values
          const aTime = Number(a.quickestPassMinutes || 0);
          const bTime = Number(b.quickestPassMinutes || 0);
          if (aTime <= 0 && bTime <= 0) return 0;
          if (aTime <= 0) return 1;
          if (bTime <= 0) return -1;
          return aTime - bTime;

        case "thePersistent":
          return Number(b.totalAttempts || 0) - Number(a.totalAttempts || 0);

        case "marathonRunner":
          return (
            Number(b.timeSpentMinutes || 0) - Number(a.timeSpentMinutes || 0)
          );

        case "rapidRiser":
          return (
            Number(b.improvementRatePerDay || 0) -
            Number(a.improvementRatePerDay || 0)
          );

        case "highestScorer":
          return (
            Number(b.highestScoreAvg || 0) - Number(a.highestScoreAvg || 0)
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
          metricValue = Number(row.perfectScoreCount || 0);
          metricLabel =
            metricValue > 0
              ? `${metricValue} perfect`
              : `${Math.round(Number(row.highestScoreAvg || 0))} avg`;
          break;
        case "longestConvo":
          metricValue = Math.round(Number(row.messagesPerSession || 0));
          metricLabel = `${metricValue} msgs/session`;
          break;
        case "responseTimes":
          metricValue = Math.round(Number(row.personaResponseSeconds || 0));
          metricLabel = `${metricValue}s`;
          break;
        case "quickestPass":
          metricValue = Math.round(Number(row.quickestPassMinutes || 0));
          metricLabel = `${metricValue} min`;
          break;
        case "thePersistent":
          metricValue = Number(row.totalAttempts || 0);
          metricLabel = `${metricValue} attempts`;
          break;
        case "marathonRunner":
          metricValue = Math.round(Number(row.timeSpentMinutes || 0));
          metricLabel = `${metricValue} min`;
          break;
        case "rapidRiser":
          metricValue = Math.round(Number(row.improvementRatePerDay || 0));
          metricLabel = `+${metricValue} pts/day`;
          break;
        case "highestScorer":
          metricValue = Math.round(Number(row.highestScoreAvg || 0));
          metricLabel = `${metricValue} avg`;
          break;
        default:
          metricValue = 0;
          metricLabel = "";
      }

      return { row, metricValue, metricLabel };
    });
  };

  // Calculate leaderboard data sorted by highest score
  const processedLeaderboardData = useMemo(() => {
    if (hydratedRows && hydratedRows.length > 0) {
      const rows = hydratedRows.map((r) => ({
        id: r.profileId,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || r.profileId,
        timeSpentMinutes: r.timeSpentMinutes,
        improvementRatePerDay: r.improvementRatePerDay,
        messagesPerSession: r.messagesPerSession,
        perfectScoreCount: r.perfectScoreCount,
        quickestPassMinutes: r.quickestPassMinutes,
        totalAttempts: r.totalAttempts,
        highestScoreAvg: r.highestScoreAvg,
        mostImprovedPercent: r.mostImprovedPercent ?? 0,
        personaResponseSeconds: r.personaResponseSeconds,
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
                                userId: null,
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
