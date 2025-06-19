/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import CohortCompletion from "@/components/common/analytics/footer/CohortCompletion";
import SkillGrowth from "@/components/common/analytics/footer/SkillGrowth";
import ActiveTAs from "@/components/common/analytics/header/ActiveTAs";
import AverageScore from "@/components/common/analytics/header/AverageScore";
import CompletionRate from "@/components/common/analytics/header/CompletionRate";
import NeedSupport from "@/components/common/analytics/header/NeedSupport";
import PassRate from "@/components/common/analytics/header/PassRate";
import TotalSessions from "@/components/common/analytics/header/TotalSessions";
import TotalTAs from "@/components/common/analytics/header/TotalTAs";
import TrainingHours from "@/components/common/analytics/header/TrainingHours";
import TrainingSessions from "@/components/common/analytics/header/TrainingSessions";
import PerformanceByPersonality from "@/components/common/analytics/main/primary/PerformanceByPersonality";
import PerformanceTrends from "@/components/common/analytics/main/primary/PerformanceTrends";
import SessionActivity from "@/components/common/analytics/main/primary/SessionActivity";
import SkillBreakdown from "@/components/common/analytics/main/secondary/SkillBreakdown";
import TrainingInsights from "@/components/common/analytics/main/secondary/TrainingInsights";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Color palette for charts
const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  orange: "#f97316",
};

// Type for chart data entries with fill property
interface ChartDataEntry {
  fill: string;
  count?: number;
  range?: string;
}

export default function Dashboard() {
  // Carousel states
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [sideCarouselIndex, setSideCarouselIndex] = useState(0);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const totalSlides = 3; // Main carousel slides
  const totalSideSlides = 2; // Side carousel slides

  // Time range states
  const [performanceTrendTimeRange, setPerformanceTrendTimeRange] = useState<
    "7d" | "30d" | "90d"
  >("30d");
  const [sessionActivityTimeRange, setSessionActivityTimeRange] = useState<
    "1h" | "12h" | "24h"
  >("24h");
  const [personalityTimeRange, setPersonalityTimeRange] = useState<
    "12h" | "1d" | "1w"
  >("1d");

  // Auto-scroll carousels
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 5000); // Change slide every 5 seconds

      return () => clearInterval(interval);
    }
    return () => {}; // Return empty cleanup function when hovered
  }, [isHovered, totalSlides]);

  // Header carousel auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderCarouselIndex((prev) => (prev + 1) % 8); // 8 total header metrics
    }, 3000); // Change header every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Side carousel auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setSideCarouselIndex((prev) => (prev + 1) % totalSideSlides);
    }, 4000); // Change side every 4 seconds

    return () => clearInterval(interval);
  }, [totalSideSlides]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Fetch data for radar and radial charts
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate metrics for struggling TAs
  const strugglingTAs = useMemo(() => {
    if (!profiles || !attempts || !chats || !grades) return 0;

    const tas = profiles.filter((profile) => profile.role === "ta");
    const taPerformance = tas.map((ta) => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId)
      );

      const avgScore =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length
            )
          : 0;

      return { avgScore };
    });

    return taPerformance.filter((ta) => ta.avgScore < 70).length;
  }, [profiles, attempts, chats, grades]);

  // Calculate average training time
  const avgTrainingTime = useMemo(() => {
    if (!grades) return 0;
    return grades.length > 0
      ? Math.round(
          grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
        )
      : 45;
  }, [grades]);

  // Calculate total TAs
  const totalTAs = useMemo(() => {
    if (!profiles) return 0;
    return profiles.filter((profile) => profile.role === "ta").length;
  }, [profiles]);

  // Generate detailed metric data for dialogs
  const getMetricDetails = (metricType: string) => {
    if (!profiles || !grades || !chats || !attempts) return null;

    switch (metricType) {
      case "averageScore":
        const scoreDistribution = [
          {
            range: "90-100%",
            count: grades.filter((g) => g.score >= 90).length,
            fill: COLORS.success,
          },
          {
            range: "80-89%",
            count: grades.filter((g) => g.score >= 80 && g.score < 90).length,
            fill: COLORS.primary,
          },
          {
            range: "70-79%",
            count: grades.filter((g) => g.score >= 70 && g.score < 80).length,
            fill: COLORS.warning,
          },
          {
            range: "60-69%",
            count: grades.filter((g) => g.score >= 60 && g.score < 70).length,
            fill: COLORS.orange,
          },
          {
            range: "<60%",
            count: grades.filter((g) => g.score < 60).length,
            fill: COLORS.danger,
          },
        ].filter((item) => item.count > 0);

        return { type: "score-distribution", data: scoreDistribution };

      case "completionRate":
        const completionTrend = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, "yyyy-MM-dd");

          const dayChats = chats.filter((chat) => {
            const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
            return chatDate === dateStr;
          });

          const completionRate =
            dayChats.length > 0
              ? Math.round(
                  (dayChats.filter((chat) => chat.completed).length /
                    dayChats.length) *
                    100
                )
              : 0;

          return {
            date: format(date, "MM/dd"),
            rate: completionRate,
            total: dayChats.length,
          };
        });

        return { type: "completion-trend", data: completionTrend };

      case "passRate":
        const passFailTrend = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, "yyyy-MM-dd");

          const dayGrades = grades.filter((grade) => {
            const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
            return gradeDate === dateStr;
          });

          const passRate =
            dayGrades.length > 0
              ? Math.round(
                  (dayGrades.filter((g) => g.passed).length /
                    dayGrades.length) *
                    100
                )
              : 0;

          return {
            date: format(date, "MM/dd"),
            passRate,
            passed: dayGrades.filter((g) => g.passed).length,
            failed: dayGrades.filter((g) => !g.passed).length,
          };
        });

        return { type: "pass-trend", data: passFailTrend };

      case "totalSessions":
        const sessionTrend = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const dateStr = format(date, "yyyy-MM-dd");

          const dayChats = chats.filter((chat) => {
            const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
            return chatDate === dateStr;
          });

          return {
            date: format(date, "MM/dd"),
            sessions: dayChats.length,
            completed: dayChats.filter((chat) => chat.completed).length,
          };
        });

        return { type: "session-trend", data: sessionTrend };

      case "trainingHours":
        const timeDistribution = [
          {
            range: "<15 min",
            count: grades.filter((g) => g.timeTaken < 900).length,
            fill: COLORS.success,
          },
          {
            range: "15-30 min",
            count: grades.filter(
              (g) => g.timeTaken >= 900 && g.timeTaken < 1800
            ).length,
            fill: COLORS.primary,
          },
          {
            range: "30-45 min",
            count: grades.filter(
              (g) => g.timeTaken >= 1800 && g.timeTaken < 2700
            ).length,
            fill: COLORS.warning,
          },
          {
            range: "45+ min",
            count: grades.filter((g) => g.timeTaken >= 2700).length,
            fill: COLORS.danger,
          },
        ].filter((item) => item.count > 0);

        return { type: "time-distribution", data: timeDistribution };

      default:
        return null;
    }
  };

  // Render chart component based on metric type
  const renderMetricChart = (metricType: string) => {
    const metricDetails = getMetricDetails(metricType);
    if (!metricDetails) return null;

    switch (metricDetails.type) {
      case "score-distribution":
        return (
          <PieChart>
            <Pie
              data={metricDetails.data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ range, percent }) =>
                `${range}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {(metricDetails.data as ChartDataEntry[])?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, "Sessions"]} />
          </PieChart>
        );

      case "completion-trend":
        return (
          <LineChart data={metricDetails.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Completion Rate"]}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke={COLORS.success}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        );

      case "pass-trend":
        return (
          <BarChart data={metricDetails.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar
              dataKey="passed"
              fill={COLORS.success}
              name="Passed"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="failed"
              fill={COLORS.danger}
              name="Failed"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case "session-trend":
        return (
          <AreaChart data={metricDetails.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke={COLORS.primary}
              fill={COLORS.primary}
              fillOpacity={0.6}
              name="Total Sessions"
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke={COLORS.success}
              fill={COLORS.success}
              fillOpacity={0.6}
              name="Completed"
            />
          </AreaChart>
        );

      case "time-distribution":
        return (
          <PieChart>
            <Pie
              data={metricDetails.data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ range, percent }) =>
                `${range}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {(metricDetails.data as ChartDataEntry[])?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, "Sessions"]} />
          </PieChart>
        );

      default:
        return null;
    }
  };

  // Header metric components array
  const headerMetrics = [
    {
      component: (
        <ActiveTAs
          totalTAs={totalTAs}
          onClick={() => setSelectedMetric("activeTAs")}
        />
      ),
      key: "activeTAs",
    },
    {
      component: (
        <TrainingSessions
          onClick={() => setSelectedMetric("trainingSessions")}
        />
      ),
      key: "trainingSessions",
    },
    {
      component: (
        <TrainingHours
          avgTrainingTime={avgTrainingTime}
          onClick={() => setSelectedMetric("trainingHours")}
        />
      ),
      key: "trainingHours",
    },
    {
      component: (
        <NeedSupport
          strugglingTAs={strugglingTAs}
          onClick={() => setSelectedMetric("needSupport")}
        />
      ),
      key: "needSupport",
    },
    {
      component: (
        <AverageScore onClick={() => setSelectedMetric("averageScore")} />
      ),
      key: "averageScore",
    },
    {
      component: (
        <CompletionRate onClick={() => setSelectedMetric("completionRate")} />
      ),
      key: "completionRate",
    },
    {
      component: <PassRate onClick={() => setSelectedMetric("passRate")} />,
      key: "passRate",
    },
    {
      component: (
        <TotalSessions onClick={() => setSelectedMetric("totalSessions")} />
      ),
      key: "totalSessions",
    },
    {
      component: <TotalTAs onClick={() => setSelectedMetric("totalTAs")} />,
      key: "totalTAs",
    },
  ];

  // Carousel slides data
  const slides = [
    {
      id: "personality",
      title: "Performance by Student Personality",
      description: "How TAs handle different student types during training",
      timeRange: personalityTimeRange,
      setTimeRange: (range: "12h" | "1d" | "1w") =>
        setPersonalityTimeRange(range),
      timeOptions: ["12h", "1d", "1w"] as const,
      timeLabels: { "12h": "12 hours", "1d": "1 day", "1w": "1 week" },
    },
    {
      id: "trends",
      title: "Performance Trends",
      description: "Training scores and session completion over time",
      timeRange: performanceTrendTimeRange,
      setTimeRange: (range: "7d" | "30d" | "90d") =>
        setPerformanceTrendTimeRange(range),
      timeOptions: ["7d", "30d", "90d"] as const,
      timeLabels: { "7d": "7 days", "30d": "30 days", "90d": "90 days" },
    },
    {
      id: "activity",
      title: "Session Activity",
      description: "Training session volume and completion rates",
      timeRange: sessionActivityTimeRange,
      setTimeRange: (range: "1h" | "12h" | "24h") =>
        setSessionActivityTimeRange(range),
      timeOptions: ["1h", "12h", "24h"] as const,
      timeLabels: { "1h": "1 hour", "12h": "12 hours", "24h": "24 hours" },
    },
  ];

  // Loading state
  if (
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rotating Header Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => {
          const metricIndex = (headerCarouselIndex + i) % headerMetrics.length;
          const metric = headerMetrics[metricIndex];
          if (!metric) return null;
          return (
            <div
              key={`${metric.key}-${headerCarouselIndex}-${i}`}
              className="transition-all duration-500 ease-in-out"
            >
              {metric.component}
            </div>
          );
        })}
      </div>

      {/* Carousel Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            className="relative overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentSlide === 0 && <Users className="h-5 w-5" />}
                    {currentSlide === 1 && <TrendingUp className="h-5 w-5" />}
                    {currentSlide === 2 && <Calendar className="h-5 w-5" />}
                    {slides[currentSlide]?.title}
                  </CardTitle>
                  <CardDescription>
                    {slides[currentSlide]?.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {slides[currentSlide]?.timeOptions.map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          switch (currentSlide) {
                            case 0:
                              if (
                                range === "12h" ||
                                range === "1d" ||
                                range === "1w"
                              ) {
                                setPersonalityTimeRange(range);
                              }
                              break;
                            case 1:
                              if (
                                range === "7d" ||
                                range === "30d" ||
                                range === "90d"
                              ) {
                                setPerformanceTrendTimeRange(range);
                              }
                              break;
                            case 2:
                              if (
                                range === "1h" ||
                                range === "12h" ||
                                range === "24h"
                              ) {
                                setSessionActivityTimeRange(range);
                              }
                              break;
                          }
                        }}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          slides[currentSlide]?.timeRange === range
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {slides[currentSlide]?.timeLabels[range]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={prevSlide}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] relative">
                {/* Performance by Student Personality */}
                {currentSlide === 0 && (
                  <PerformanceByPersonality timeRange={personalityTimeRange} />
                )}

                {/* Performance Trends */}
                {currentSlide === 1 && (
                  <PerformanceTrends timeRange={performanceTrendTimeRange} />
                )}

                {/* Session Activity */}
                {currentSlide === 2 && (
                  <SessionActivity timeRange={sessionActivityTimeRange} />
                )}
              </div>
              {/* Carousel indicators - moved to bottom center */}
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Components Carousel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {sideCarouselIndex === 0 && (
                      <GraduationCap className="h-5 w-5" />
                    )}
                    {sideCarouselIndex === 1 && <Target className="h-5 w-5" />}
                    {sideCarouselIndex === 0
                      ? "Skill Breakdown"
                      : "Training Insights"}
                  </CardTitle>
                  <CardDescription>
                    {sideCarouselIndex === 0
                      ? "Top performing competencies"
                      : "AI-powered recommendations"}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setSideCarouselIndex(
                        (prev) => (prev - 1 + totalSideSlides) % totalSideSlides
                      )
                    }
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setSideCarouselIndex(
                        (prev) => (prev + 1) % totalSideSlides
                      )
                    }
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[305px]">
                {sideCarouselIndex === 0 && <SkillBreakdown />}
                {sideCarouselIndex === 1 && <TrainingInsights />}
              </div>
              {/* Side carousel indicators - moved to bottom center */}
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: totalSideSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSideCarouselIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === sideCarouselIndex ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Radar and Radial Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Skill Radar Chart */}
        <SkillGrowth />

        {/* Cohort Radial Chart */}
        <CohortCompletion />
      </div>

      {/* Metric Detail Dialogs */}
      <Dialog
        open={!!selectedMetric}
        onOpenChange={(open) => !open && setSelectedMetric(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMetric === "averageScore"
                ? "Score Distribution"
                : selectedMetric === "completionRate"
                  ? "Completion Rate Trend"
                  : selectedMetric === "passRate"
                    ? "Pass/Fail Trend"
                    : selectedMetric === "totalSessions"
                      ? "Session Activity"
                      : selectedMetric === "trainingHours"
                        ? "Training Time Distribution"
                        : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="h-64">
            {selectedMetric && renderMetricChart(selectedMetric) && (
              <ResponsiveContainer width="100%" height="100%">
                {renderMetricChart(selectedMetric)!}
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
