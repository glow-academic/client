/**
 * change-calculator.ts
 * Utility functions for calculating percentage changes in analytics data
 * @AshokSaravanan222
 * 01/07/2025
 */

import { subDays, subMonths, subWeeks } from "date-fns";

export interface ChangeData {
  percentage: number;
  interval: string;
  isPositive: boolean;
  currentValue: number;
  previousValue: number;
}

export function calculateChange(
  currentData: number,
  historicalData: number,
  interval: string
): ChangeData {
  if (historicalData === 0) {
    return {
      percentage: 0,
      interval,
      isPositive: currentData > 0,
      currentValue: currentData,
      previousValue: historicalData,
    };
  }

  const percentage = ((currentData - historicalData) / historicalData) * 100;

  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    interval,
    isPositive: percentage >= 0,
    currentValue: currentData,
    previousValue: historicalData,
  };
}

export function getTimeIntervals(dateEnd: Date) {
  return {
    threeDays: {
      start: subDays(dateEnd, 3),
      end: dateEnd,
      label: "3 days",
    },
    oneWeek: {
      start: subWeeks(dateEnd, 1),
      end: dateEnd,
      label: "1 week",
    },
    twoWeeks: {
      start: subWeeks(dateEnd, 2),
      end: dateEnd,
      label: "2 weeks",
    },
    oneMonth: {
      start: subMonths(dateEnd, 1),
      end: dateEnd,
      label: "1 month",
    },
  };
}

export function formatChangeText(change: ChangeData): string {
  if (change.percentage === 0) return "No change";

  const direction = change.isPositive ? "increased" : "decreased";
  const absPercentage = Math.abs(change.percentage);

  return `${direction} ${absPercentage}% over the past ${change.interval}`;
}

export function getSignificantChange(
  currentValue: number,
  historicalValues: { value: number; interval: string }[]
): ChangeData | null {
  // Find the most significant positive change (at least 5%)
  const significantChanges = historicalValues
    .map(({ value, interval }) =>
      calculateChange(currentValue, value, interval)
    )
    .filter((change) => change.percentage >= 5) // Only positive changes of 5% or more
    .sort((a, b) => b.percentage - a.percentage); // Sort by highest percentage first

  return significantChanges.length > 0 ? significantChanges[0] || null : null;
}
