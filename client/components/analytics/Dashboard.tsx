/**
 * Dashboard.tsx
 * Used to display the main dashboard for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import CohortCompletion from "@/components/common/analytics/footer/CohortCompletion";
import ScenarioData from "@/components/common/analytics/footer/ScenarioData";
import SimulationPerformance from "@/components/common/analytics/footer/SimulationPerformance";
import SkillGrowth from "@/components/common/analytics/footer/SkillGrowth";
import ActiveCohorts from "@/components/common/analytics/header/ActiveCohorts";
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
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function Dashboard() {
  // Carousel states
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [sideCarouselIndex, setSideCarouselIndex] = useState(0);
  const [leftFooterCarouselIndex, setLeftFooterCarouselIndex] = useState(0);
  const [rightFooterCarouselIndex, setRightFooterCarouselIndex] = useState(0);

  const totalSlides = 3; // Main carousel slides
  const totalSideSlides = 2; // Side carousel slides
  const totalFooterSlides = 2; // Footer carousel slides

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

  const { isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { isLoading: isLoadingChats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  const { isLoading: isLoadingGrades } = useQuery({
    queryKey: ["grades"],
    queryFn: () => getAllSimulationChatGrades(),
  });

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

  // Footer carousels auto-scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setLeftFooterCarouselIndex((prev) => (prev + 1) % totalFooterSlides);
    }, 6000); // Change left footer every 6 seconds

    return () => clearInterval(interval);
  }, [totalFooterSlides]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRightFooterCarouselIndex((prev) => (prev + 1) % totalFooterSlides);
    }, 7000); // Change right footer every 7 seconds

    return () => clearInterval(interval);
  }, [totalFooterSlides]);

  // Header metric components array
  const headerMetrics = [
    {
      component: <ActiveCohorts />,
      key: "activeCohorts",
    },
    {
      component: <TrainingSessions />,
      key: "trainingSessions",
    },
    {
      component: <TrainingHours />,
      key: "trainingHours",
    },
    {
      component: <NeedSupport />,
      key: "needSupport",
    },
    {
      component: <AverageScore />,
      key: "averageScore",
    },
    {
      component: <CompletionRate />,
      key: "completionRate",
    },
    {
      component: <PassRate />,
      key: "passRate",
    },
    {
      component: <TotalSessions />,
      key: "totalSessions",
    },
    {
      component: <TotalTAs />,
      key: "totalTAs",
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
          <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Performance by Student Personality */}
            {currentSlide === 0 && (
              <PerformanceByPersonality
                timeRange={personalityTimeRange}
                onTimeRangeChange={setPersonalityTimeRange}
              />
            )}

            {/* Performance Trends */}
            {currentSlide === 1 && (
              <PerformanceTrends
                timeRange={performanceTrendTimeRange}
                onTimeRangeChange={setPerformanceTrendTimeRange}
              />
            )}

            {/* Session Activity */}
            {currentSlide === 2 && (
              <SessionActivity
                timeRange={sessionActivityTimeRange}
                onTimeRangeChange={setSessionActivityTimeRange}
              />
            )}
          </div>
          {/* Carousel indicators - moved outside the cards */}
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
        </div>

        {/* Side Components Carousel */}
        <div className="space-y-6">
          <div>
            {sideCarouselIndex === 0 && <SkillBreakdown />}
            {sideCarouselIndex === 1 && <TrainingInsights />}
          </div>
          {/* Side carousel indicators - moved outside the cards */}
          <div className="flex justify-center gap-2">
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
        </div>
      </div>

      {/* Footer Carousel Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Footer Carousel */}
        <div className="space-y-4">
          {leftFooterCarouselIndex === 0 && <SkillGrowth />}
          {leftFooterCarouselIndex === 1 && <ScenarioData />}
          {/* Left Footer Carousel Indicators */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalFooterSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setLeftFooterCarouselIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === leftFooterCarouselIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Right Footer Carousel */}
        <div className="space-y-4">
          {rightFooterCarouselIndex === 0 && <CohortCompletion />}
          {rightFooterCarouselIndex === 1 && <SimulationPerformance />}
          {/* Right Footer Carousel Indicators */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: totalFooterSlides }).map((_, index) => (
              <button
                key={index}
                onClick={() => setRightFooterCarouselIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === rightFooterCarouselIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
