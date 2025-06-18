/**
 * TrainingInsights.tsx
 * This is used to show the insights of the training, powered by AI.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function TrainingInsights() {
  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const totalSlides = 3;

  // Auto-scroll carousel
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 4000); // Change slide every 4 seconds

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

  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate insights
  const insights = useMemo(() => {
    if (!grades || !profiles || !chats) return null;

    const tas = profiles.filter((profile) => profile.role === "ta");

    // Calculate dynamic metrics for training insights
    const currentWeekGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= weekAgo;
    });

    const lastWeekGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const twoWeeksAgo = subDays(new Date(), 14);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= twoWeeksAgo && gradeDate < weekAgo;
    });

    const currentWeekAvg =
      currentWeekGrades.length > 0
        ? Math.round(
            currentWeekGrades.reduce((sum, g) => sum + g.score, 0) /
              currentWeekGrades.length
          )
        : 0;

    const lastWeekAvg =
      lastWeekGrades.length > 0
        ? Math.round(
            lastWeekGrades.reduce((sum, g) => sum + g.score, 0) /
              lastWeekGrades.length
          )
        : 0;

    const weeklyTrend = currentWeekAvg - lastWeekAvg;
    const passRate =
      grades.length > 0
        ? Math.round(
            (grades.filter((g) => g.passed).length / grades.length) * 100
          )
        : 0;

    const activeTAs = tas.filter((ta) => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId)
      );
      return taGrades.length > 0;
    }).length;

    // Calculate average training time from grades (convert seconds to minutes)
    const avgTrainingTime =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
          )
        : 45;

    // Calculate overall average score from grades
    const avgOverallScore =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          )
        : 0;

    return {
      weeklyTrend,
      activeTAs,
      avgTrainingTime,
      passRate,
      avgOverallScore,
    };
  }, [grades, profiles, chats, attempts]);

  if (!insights) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">Loading training insights...</p>
      </div>
    );
  }

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Carousel controls */}
      <div className="absolute top-0 right-0 flex gap-1 z-10">
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

      {/* Carousel indicators */}
      <div className="absolute top-8 right-0 flex gap-2">
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

      <div className="h-full overflow-y-auto pt-12">
        {/* Weekly Trend & Active TAs */}
        {currentSlide === 0 && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Weekly Trend
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {insights.weeklyTrend > 0
                      ? `Scores improved by ${insights.weeklyTrend}% this week`
                      : insights.weeklyTrend < 0
                        ? `Scores decreased by ${Math.abs(insights.weeklyTrend)}% this week`
                        : "Scores remained stable this week"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950 dark:border-green-800">
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">
                    Active TAs
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {insights.activeTAs} TAs have completed training sessions
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Session Efficiency & Success Rate */}
        {currentSlide === 1 && (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Session Efficiency
                  </div>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Average session time: {insights.avgTrainingTime} minutes
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg dark:bg-purple-950 dark:border-purple-800">
              <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-purple-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                    Success Rate
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                    {insights.passRate}% of sessions meet passing criteria
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overall Performance */}
        {currentSlide === 2 && (
          <div className="space-y-3">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950 dark:border-orange-800">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-orange-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    Overall Performance
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Average score across all sessions:{" "}
                    {insights.avgOverallScore}%
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg dark:bg-teal-950 dark:border-teal-800">
              <div className="flex items-start gap-2">
                <Award className="h-4 w-4 text-teal-600 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-teal-800 dark:text-teal-200">
                    Quality Insights
                  </div>
                  <div className="text-xs text-teal-700 dark:text-teal-300 mt-1">
                    {insights.avgOverallScore >= 80
                      ? "Excellent training performance overall"
                      : insights.avgOverallScore >= 70
                        ? "Good training outcomes with room for growth"
                        : "Focus needed on improving training effectiveness"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
