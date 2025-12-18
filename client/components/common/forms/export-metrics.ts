/**
 * Export metric definitions
 * Extracted from ExportPicker for reuse
 */

import type React from "react";
import {
  AlertCircle,
  Award,
  BarChart,
  CheckCircle,
  Clock,
  MessageCircle,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

export type MetricOption = {
  value: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const EXPORT_METRICS: MetricOption[] = [
  {
    value: "highestScore",
    label: "Highest Score",
    description: "The highest score achieved across all attempts",
    icon: Target,
  },
  {
    value: "averageScore",
    label: "Average Score",
    description: "The mean score across all attempts",
    icon: BarChart,
  },
  {
    value: "completionPercentage",
    label: "Completion Percentage",
    description: "Percentage of simulations completed",
    icon: CheckCircle,
  },
  {
    value: "firstAttemptPassRate",
    label: "First Attempt Pass Rate",
    description: "Percentage of simulations passed on the first attempt",
    icon: Award,
  },
  {
    value: "messagesPerSession",
    label: "Messages Per Session",
    description: "Average number of messages exchanged per session",
    icon: MessageCircle,
  },
  {
    value: "personaResponseTimes",
    label: "Persona Response Times",
    description: "Average time for persona to respond",
    icon: Clock,
  },
  {
    value: "sessionEfficiency",
    label: "Session Efficiency",
    description: "Combined metric of score and time efficiency",
    icon: TrendingUp,
  },
  {
    value: "stagnationRate",
    label: "Stagnation Rate",
    description: "Percentage of sessions with no progress",
    icon: AlertCircle,
  },
  {
    value: "timeSpent",
    label: "Time Spent",
    description: "Average time spent per session",
    icon: Timer,
  },
  {
    value: "totalAttempts",
    label: "Total Attempts",
    description: "Total number of simulation attempts",
    icon: Target,
  },
];
