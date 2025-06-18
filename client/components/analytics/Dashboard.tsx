/**
 * Dashboard.tsx (renamed from Overview.tsx)
 * Used to display the main dashboard for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import CohortCompletion from "@/components/common/analytics/footer/CohortCompletion";
import SkillGrowth from "@/components/common/analytics/footer/SkillGrowth";
import ActiveTAs from "@/components/common/analytics/header/ActiveTAs";
import NeedSupport from "@/components/common/analytics/header/NeedSupport";
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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function Dashboard() {
  // Carousel state for main charts
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const totalSlides = 3; // Changed to 3 slides

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

  // Auto-scroll carousel
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 5000); // Change slide every 5 seconds

      return () => clearInterval(interval);
    }
    return () => {}; // Return empty cleanup function when hovered
  }, [isHovered, totalSlides]);

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

  const { data: cohorts, isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
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

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
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
    isLoadingCohorts ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics
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
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActiveTAs totalTAs={totalTAs} />
        <TrainingSessions />
        <TrainingHours avgTrainingTime={avgTrainingTime} />
        <NeedSupport strugglingTAs={strugglingTAs} />
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
              {/* Carousel indicators */}
              <div className="flex gap-2 mt-2">
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
            </CardContent>
          </Card>
        </div>

        {/* Side Components */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skill Breakdown</CardTitle>
              <CardDescription>Top performing competencies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[120px]">
                <SkillBreakdown />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Training Insights</CardTitle>
              <CardDescription>AI-powered recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[120px]">
                <TrainingInsights />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Radar and Radial Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Skill Radar Chart */}
        {grades &&
          feedbacks &&
          standards &&
          standardGroups &&
          chats &&
          rubrics && (
            <SkillGrowth
              grades={grades}
              feedbacks={feedbacks}
              standards={standards}
              standardGroups={standardGroups}
              chats={chats}
              rubrics={rubrics}
            />
          )}

        {/* Cohort Radial Chart */}
        {cohorts && profiles && attempts && chats && (
          <CohortCompletion
            cohorts={cohorts}
            profiles={profiles}
            attempts={attempts}
            chats={chats}
          />
        )}
      </div>
    </div>
  );
}
