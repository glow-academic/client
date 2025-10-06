/**
 * AnalyticsFilters.tsx
 * Combined date picker and cohort picker for analytics pages
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { PracticePicker } from "@/components/common/analytics/PracticePicker";
import {
  CohortPicker,
  Cohort as CohortPickerCohort,
} from "@/components/common/cohort/CohortPicker";
import { RolePicker } from "@/components/common/profile/RolePicker";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { SimulationFilter, useAnalytics } from "@/contexts/analytics-context";
import { useRefreshAnalytics } from "@/lib/api/hooks/analytics";
import { useCohorts } from "@/lib/api/hooks/cohorts";
import type { ProfileRole } from "@/types";
import { log } from "@/utils/logger";
import { useIsFetching } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";

export interface AnalyticsFiltersProps {
  homePage?: boolean;
  reportPage?: boolean;
}

export function AnalyticsFilters({
  homePage = false,
  reportPage = false,
}: AnalyticsFiltersProps) {
  const {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    selectedRoles,
    setSelectedRoles,
    simulationFilters,
    setSimulationFilters,
  } = useAnalytics();

  const { data: cohorts = [] } = useCohorts();
  const { mutate: refreshAnalytics, isPending: isRefreshing } =
    useRefreshAnalytics();

  // Count all in-flight analytics queries (after invalidation)
  const isFetchingAnalytics = useIsFetching({
    predicate: (q) => {
      const k = q.queryKey?.[0];
      return typeof k === "string" && k.startsWith("analytics:");
    },
  });

  // Stable spinner that respects pending mutation, in-flight queries, and a min duration
  const [spinning, setSpinning] = useState(false);
  const [requestStop, setRequestStop] = useState(false);
  const spinStartRef = useRef<number | null>(null);
  const iconRef = useRef<
    (SVGSVGElement & { __fallbackStop?: NodeJS.Timeout | undefined }) | null
  >(null);
  const MIN_SPIN_MS = 600; // prevent flicker (tweak to taste)
  const SETTLE_DELAY_MS = 150; // brief cushion after last fetch

  // Start immediately on click to avoid a 1-frame delay
  const handleRefresh = () => {
    if (!spinning) {
      setSpinning(true);
      spinStartRef.current = performance.now();
    }

    refreshAnalytics(undefined, {
      onError: (error) => {
        log.error("analytics.refresh.component.failed", {
          message: "Failed to refresh analytics data",
          error,
          context: { component: "AnalyticsFilters", function: "handleRefresh" },
        });
        toast.error("Failed to refresh analytics data");
      },
    });
  };

  // Keep spinning while either the mutation is pending OR analytics queries are fetching.
  // When both are done, ensure we've spun for at least MIN_SPIN_MS, then stop with a small settle delay.
  useEffect(() => {
    const active = isRefreshing || isFetchingAnalytics > 0;

    if (active) {
      if (!spinning) {
        setSpinning(true);
        spinStartRef.current = performance.now();
      }
      return; // keep spinning
    }

    // we're "idle" now; enforce minimum spin duration + small settle delay
    if (spinning) {
      const startedAt = spinStartRef.current ?? performance.now();
      const elapsed = performance.now() - startedAt;
      const waitMs = Math.max(0, MIN_SPIN_MS - elapsed) + SETTLE_DELAY_MS;

      const t = setTimeout(() => {
        // DEFER stopping to the next animationiteration
        setRequestStop(true);

        // safety fallback: if no iteration fires (tab hidden, etc.), stop anyway
        const fallback = setTimeout(() => {
          setSpinning(false);
          setRequestStop(false);
          spinStartRef.current = null;
        }, 1200); // a bit > one spin period

        // store fallback timer id on the ref so we can clear it when iteration happens
        if (iconRef.current?.__fallbackStop) {
          clearTimeout(iconRef.current.__fallbackStop);
        }
        if (iconRef.current) {
          iconRef.current.__fallbackStop = fallback;
        }
      }, waitMs);

      return () => clearTimeout(t);
    }

    return undefined;
  }, [isRefreshing, isFetchingAnalytics, spinning]);

  // Local UI state to distinguish between "empty (all)" and "specific selections"
  const [practiceSelected, setPracticeSelected] = useState<SimulationFilter[]>(
    () => {
      const vals: SimulationFilter[] = [];
      if (simulationFilters.includes("general")) vals.push("general");
      if (simulationFilters.includes("practice")) vals.push("practice");
      if (simulationFilters.includes("archived")) vals.push("archived");
      // When all three are enabled functionally, start with empty to indicate "All simulations"
      return vals.length === 3 ? [] : vals;
    },
  );

  // Keep local selection in sync when context flags change externally
  useEffect(() => {
    const currentFilters: SimulationFilter[] = [];
    if (simulationFilters.includes("general")) currentFilters.push("general");
    if (simulationFilters.includes("practice")) currentFilters.push("practice");
    if (simulationFilters.includes("archived")) currentFilters.push("archived");

    // Update local state if it doesn't match the context
    if (
      currentFilters.length !== practiceSelected.length ||
      !currentFilters.every((filter) => practiceSelected.includes(filter))
    ) {
      setPracticeSelected(currentFilters);
    }
  }, [simulationFilters, practiceSelected]);

  // Convert to DateRange for the date picker component
  const dateRange: DateRange = {
    from: startDate,
    to: endDate,
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range.from, range.to);
    }
  };

  // Filter to only active cohorts and convert to the format expected by CohortPicker
  const activeCohorts = cohorts.filter((cohort) => cohort.active);

  const cohortOptions = activeCohorts.map((cohort) => ({
    id: cohort.id,
    title: cohort.title,
    description:
      cohort.description ||
      `Cohort with ${cohort.profileIds?.length || 0} members`,
    memberCount: cohort.profileIds?.length || 0,
  }));

  // Get selected cohorts for the picker
  const selectedCohorts = cohortOptions.filter((cohort) =>
    selectedCohortIds.includes(cohort.id),
  );

  // Automatically filter available roles and remove invalid selections when cohorts are selected
  useEffect(() => {
    if (selectedCohortIds.length > 0) {
      // When cohorts are selected, only allow "ta" and "instructional" roles
      // Remove any existing selections that aren't "ta" or "instructional"
      const validRoles = selectedRoles.filter(
        (role) => role === "ta" || role === "instructional",
      );
      if (validRoles.length !== selectedRoles.length) {
        setSelectedRoles(validRoles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCohortIds, selectedRoles]);

  const handleCohortSelect = (cohorts: CohortPickerCohort[]) => {
    setSelectedCohortIds(cohorts.map((c) => c.id));
  };

  const handleRoleSelect = (roles: ProfileRole[]) => {
    setSelectedRoles(roles);
  };

  return (
    <div className="px-4">
      <div className="flex items-center gap-2">
        {/* General/Practice/Archived Selector (multi-select, matches RolePicker) */}
        {!homePage && (
          <PracticePicker
            selected={practiceSelected}
            onChange={(vals) => {
              // Update UI state first
              setPracticeSelected(vals);
              // Empty selection means all simulations (all three modes on)
              if (vals.length === 0) {
                setSimulationFilters(["general", "practice", "archived"]);
                return;
              }
              setSimulationFilters(vals);
            }}
            placeholder="All simulations"
          />
        )}

        {/* Role Picker */}
        {!homePage && !reportPage && (
          <RolePicker
            roles={
              selectedCohortIds.length > 0
                ? ["instructional", "ta"] // Only show ta and instructional when cohorts are selected
                : ["superadmin", "admin", "instructional", "ta", "guest"] // Show all roles when no cohorts selected
            }
            selectedRoles={selectedRoles}
            onChange={handleRoleSelect}
            placeholder="All roles"
          />
        )}

        {/* Cohort Picker */}
        <CohortPicker
          cohorts={cohortOptions}
          selectedCohorts={selectedCohorts}
          onSelect={handleCohortSelect}
          placeholder="Cohorts"
          hideSelectedChips={true}
        />

        {/* Date Range Picker */}
        <DatePickerWithRange
          dateRange={dateRange}
          setDateRange={handleDateRangeChange}
          className="w-auto"
        />

        {/* Refresh Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh analytics data"
        >
          <RefreshCw
            ref={iconRef}
            aria-hidden
            onAnimationIteration={() => {
              if (requestStop) {
                // clear fallback
                if (iconRef.current?.__fallbackStop) {
                  clearTimeout(iconRef.current.__fallbackStop);
                  iconRef.current.__fallbackStop = undefined;
                }
                setSpinning(false); // remove animate-spin at a lap boundary
                setRequestStop(false);
                spinStartRef.current = null;
              }
            }}
            className={`h-4 w-4 will-change-transform ${
              spinning ? "animate-spin" : ""
            }`}
          />
        </Button>
      </div>
    </div>
  );
}
