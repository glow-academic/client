"use client";

import type { OutputOf } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AverageScore from "./header/AverageScore";
import CompletionPercentage from "./header/CompletionPercentage";
import FirstAttemptPassRate from "./header/FirstAttemptPassRate";
import HighestScore from "./header/HighestScore";
import MessagesPerSession from "./header/MessagesPerSession";
import PersonaResponseTimes from "./header/PersonaResponseTimes";
import SessionEfficiency from "./header/SessionEfficiency";
import StagnationRate from "./header/StagnationRate";
import TimeSpent from "./header/TimeSpent";
import TotalAttempts from "./header/TotalAttempts";

export type HeaderOut = OutputOf<"/api/v4/artifacts/dashboard/get", "post">;

function validateStatus(
  status: string | null | undefined,
  defaultValue: "neutral" | "success" | "warning" | "danger" = "neutral"
): "neutral" | "success" | "warning" | "danger" {
  if (!status) return defaultValue;
  if (status === "neutral" || status === "success" || status === "warning" || status === "danger") {
    return status;
  }
  return defaultValue;
}

interface DashboardHeaderProps {
  data: HeaderOut;
}

export default function DashboardHeader({ data }: DashboardHeaderProps) {
  const [headerCarouselIndex, setHeaderCarouselIndex] = useState(0);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);

  const trendAnalysis = useMemo(() => {
    if (!data?.header_metrics) {
      return {
        averageScore: null as string | null,
        completion: null as string | null,
        passRate: null as string | null,
        highestScore: null as string | null,
        messages: null as string | null,
        responseTime: null as string | null,
        sessionEfficiency: null as string | null,
        stagnationRate: null as string | null,
        timeSpent: null as string | null,
        totalAttempts: null as string | null,
      };
    }

    return {
      averageScore: data.header_metrics.average_score?.trend_analysis ?? null,
      completion: data.header_metrics.completion_percentage?.trend_analysis ?? null,
      passRate: data.header_metrics.first_attempt_pass_rate?.trend_analysis ?? null,
      highestScore: data.header_metrics.highest_score?.trend_analysis ?? null,
      messages: data.header_metrics.messages_per_session?.trend_analysis ?? null,
      responseTime: data.header_metrics.persona_response_times?.trend_analysis ?? null,
      sessionEfficiency: data.header_metrics.session_efficiency?.trend_analysis ?? null,
      stagnationRate: data.header_metrics.stagnation_rate?.trend_analysis ?? null,
      timeSpent: data.header_metrics.time_spent?.trend_analysis ?? null,
      totalAttempts: data.header_metrics.total_attempts?.trend_analysis ?? null,
    };
  }, [data]);

  const headerComponents = useMemo(() => {
    if (!data?.header_metrics) return [];

    return [
      <AverageScore
        key="average-score"
        colorIndex={0}
        averageScore={data.header_metrics.average_score?.current_value ?? 0}
        scoreTrend={(data.header_metrics.average_score?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.average_score?.has_data ?? false}
        trendAnalysis={trendAnalysis.averageScore}
        status={validateStatus(data.header_metrics.average_score?.status)}
      />,
      <CompletionPercentage
        key="completion-percentage"
        colorIndex={1}
        completionPercentage={data.header_metrics.completion_percentage?.current_value ?? 0}
        completionTrend={(data.header_metrics.completion_percentage?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.completion_percentage?.has_data ?? false}
        trendAnalysis={trendAnalysis.completion}
        status={(data.header_metrics.completion_percentage?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <FirstAttemptPassRate
        key="first-attempt-pass-rate"
        colorIndex={2}
        firstAttemptPassRate={data.header_metrics.first_attempt_pass_rate?.current_value ?? 0}
        passRateTrend={(data.header_metrics.first_attempt_pass_rate?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.first_attempt_pass_rate?.has_data ?? false}
        trendAnalysis={trendAnalysis.passRate}
        status={(data.header_metrics.first_attempt_pass_rate?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <HighestScore
        key="highest-score"
        colorIndex={3}
        highestScore={data.header_metrics.highest_score?.current_value ?? 0}
        scoreTrend={(data.header_metrics.highest_score?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.highest_score?.has_data ?? false}
        trendAnalysis={trendAnalysis.highestScore}
        status={(data.header_metrics.highest_score?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <MessagesPerSession
        key="messages-per-session"
        colorIndex={4}
        averageMessagesPerSession={data.header_metrics.messages_per_session?.current_value ?? 0}
        messagesTrend={(data.header_metrics.messages_per_session?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.messages_per_session?.has_data ?? false}
        trendAnalysis={trendAnalysis.messages}
        status={(data.header_metrics.messages_per_session?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <PersonaResponseTimes
        key="persona-response-times"
        colorIndex={5}
        averageResponseTime={data.header_metrics.persona_response_times?.current_value ?? 0}
        responseTimeTrend={(data.header_metrics.persona_response_times?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.persona_response_times?.has_data ?? false}
        trendAnalysis={trendAnalysis.responseTime}
        status={(data.header_metrics.persona_response_times?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <SessionEfficiency
        key="session-efficiency"
        colorIndex={6}
        sessionEfficiency={data.header_metrics.session_efficiency?.current_value ?? 0}
        efficiencyTrend={(data.header_metrics.session_efficiency?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.session_efficiency?.has_data ?? false}
        trendAnalysis={trendAnalysis.sessionEfficiency}
        status={(data.header_metrics.session_efficiency?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <StagnationRate
        key="stagnation-rate"
        colorIndex={7}
        stagnationRate={data.header_metrics.stagnation_rate?.current_value ?? 0}
        stagnationTrend={(data.header_metrics.stagnation_rate?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.stagnation_rate?.has_data ?? false}
        trendAnalysis={trendAnalysis.stagnationRate}
        status={(data.header_metrics.stagnation_rate?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <TimeSpent
        key="time-spent"
        colorIndex={8}
        totalTimeSpent={(data.header_metrics.time_spent?.current_value ?? 0) * 60}
        timeSpentTrend={(data.header_metrics.time_spent?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: Math.round(t.value! * 60), count: t.count! }))}
        hasDataAvailable={data.header_metrics.time_spent?.has_data ?? false}
        trendAnalysis={trendAnalysis.timeSpent}
        status={(data.header_metrics.time_spent?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
      <TotalAttempts
        key="total-attempts"
        colorIndex={9}
        totalAttempts={data.header_metrics.total_attempts?.current_value ?? 0}
        attemptsTrend={(data.header_metrics.total_attempts?.trend_data || []).filter((t): t is { date: string; value: number; count: number } => t.date !== null && t.value !== null && t.count !== null).map(t => ({ date: t.date!, value: t.value!, count: t.count! }))}
        hasDataAvailable={data.header_metrics.total_attempts?.has_data ?? false}
        trendAnalysis={trendAnalysis.totalAttempts}
        status={(data.header_metrics.total_attempts?.status ?? "neutral") as "neutral" | "success" | "warning" | "danger"}
      />,
    ];
  }, [data, trendAnalysis]);

  // Responsive header cards per page
  const HEADER_CARDS_PER_PAGE_MOBILE = 2;
  const HEADER_CARDS_PER_PAGE_DESKTOP = 5;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const headerCardsPerPage = isMobile
    ? HEADER_CARDS_PER_PAGE_MOBILE
    : HEADER_CARDS_PER_PAGE_DESKTOP;

  useEffect(() => {
    const maxPages = Math.ceil(headerComponents.length / headerCardsPerPage);
    if (headerCarouselIndex >= maxPages) {
      setHeaderCarouselIndex(0);
    }
  }, [isMobile, headerComponents.length, headerCardsPerPage, headerCarouselIndex]);

  const totalHeaderPages = Math.ceil(headerComponents.length / headerCardsPerPage);

  const getVisibleHeaderComponents = () => {
    const startIndex = headerCarouselIndex * headerCardsPerPage;
    return headerComponents.slice(startIndex, startIndex + headerCardsPerPage);
  };

  const navigateHeader = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setHeaderCarouselIndex(
        (prev: number) => (prev - 1 + totalHeaderPages) % totalHeaderPages
      );
    } else {
      setHeaderCarouselIndex((prev: number) => (prev + 1) % totalHeaderPages);
    }
  };

  if (headerComponents.length === 0) return null;

  return (
    <div className="space-y-4">
      <div
        className="relative group"
        onMouseEnter={() => setIsHeaderHovered(true)}
        onMouseLeave={() => setIsHeaderHovered(false)}
      >
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${Math.min(headerCardsPerPage, headerComponents.length)}, 1fr)`,
            gridAutoRows: "1fr",
          }}
        >
          {getVisibleHeaderComponents().map((component, index) => (
            <div
              key={`header-${headerCarouselIndex}-${index}`}
              className="transition-all duration-500 ease-in-out"
            >
              {component}
            </div>
          ))}
        </div>

        {totalHeaderPages > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isHeaderHovered ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => navigateHeader("prev")}
              data-testid="dashboard-header-carousel-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200 ${
                isHeaderHovered ? "opacity-100" : "opacity-0"
              } hover:opacity-100`}
              onClick={() => navigateHeader("next")}
              data-testid="dashboard-header-carousel-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {totalHeaderPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalHeaderPages }, (_, index) => (
            <button
              key={index}
              onClick={() => setHeaderCarouselIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === headerCarouselIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
