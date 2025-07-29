/**
 * use-analytics-change.ts
 * Custom hook for calculating percentage changes in analytics data
 * @AshokSaravanan222
 * 01/07/2025
 */

import {
  formatChangeText,
  getSignificantChange,
} from "@/utils/analytics/change-calculator";
import { subDays, subMonths, subWeeks } from "date-fns";
import { useMemo } from "react";

export interface UseAnalyticsChangeProps {
  currentValue: number;
  dateEnd: Date;
  profileId?: string;
  dataFilter: (startDate: Date, endDate: Date, profileId?: string) => number;
}

export function useAnalyticsChange({
  currentValue,
  dateEnd,
  profileId,
  dataFilter,
}: UseAnalyticsChangeProps) {
  const historicalData = useMemo(() => {
    const intervals = [
      { start: subDays(dateEnd, 3), end: dateEnd, label: "3 days" },
      { start: subWeeks(dateEnd, 1), end: dateEnd, label: "1 week" },
      { start: subWeeks(dateEnd, 2), end: dateEnd, label: "2 weeks" },
      { start: subMonths(dateEnd, 1), end: dateEnd, label: "1 month" },
    ];

    return intervals
      .map(({ start, end, label }) => {
        const value = dataFilter(start, end, profileId);
        return value > 0 ? { value, interval: label } : null;
      })
      .filter(Boolean) as { value: number; interval: string }[];
  }, [dateEnd, profileId, dataFilter]);

  const significantChange = useMemo(() => {
    return getSignificantChange(currentValue, historicalData);
  }, [currentValue, historicalData]);

  const changeText = useMemo(() => {
    return significantChange ? formatChangeText(significantChange) : null;
  }, [significantChange]);

  return {
    significantChange,
    changeText,
    historicalData,
  };
}
