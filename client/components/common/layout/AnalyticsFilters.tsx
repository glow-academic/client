/**
 * AnalyticsFilters.tsx
 * Combined date picker and cohort picker for analytics pages
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import type {
  RefreshAnalyticsIn,
  RefreshAnalyticsOut,
} from "@/app/(main)/layout-server";
import {
  PROFILE_ROLES,
  type ProfileRole,
} from "@/components/common/forms/profile-roles";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import { SimulationFilter, useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefreshCw, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import AttemptSelector from "./analytics/AttemptSelector";
import {
  CohortSelector,
  Cohort as CohortSelectorCohort,
} from "./analytics/CohortSelector";
import { DepartmentSelector } from "./analytics/DepartmentSelector";
import { RoleSelector } from "./analytics/RoleSelector";

export interface AnalyticsFiltersProps {
  homePage?: boolean;
  reportPage?: boolean;
  practicePage?: boolean;
  refreshAnalytics: (input: RefreshAnalyticsIn) => Promise<RefreshAnalyticsOut>;
}

export function AnalyticsFilters({
  homePage = false,
  reportPage = false,
  practicePage = false,
  refreshAnalytics,
}: AnalyticsFiltersProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    startDate,
    endDate,
    setDateRange,
    selectedCohortIds,
    setSelectedCohortIds,
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    selectedRoles,
    setSelectedRoles,
    simulationFilters,
    setSimulationFilters,
  } = useAnalytics();

  const { cohorts, cohortMemberCounts, departments, scopedRoles } =
    useProfile();
  const getCohortMemberCount = (cohortId: string) =>
    cohortMemberCounts[cohortId] ?? 0;

  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const handleRefresh = async () => {
    if (!spinning) {
      setSpinning(true);
      spinStartRef.current = performance.now();
    }

    setIsRefreshing(true);
    try {
      await refreshAnalytics({ body: {} });
      // Note: Analytics pages using server actions will revalidate automatically
      // via Next.js cache revalidation, so no manual query invalidation needed
    } catch {
      toast.error("Failed to refresh analytics data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Keep spinning while refreshing, then ensure minimum spin duration
  useEffect(() => {
    if (isRefreshing) {
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
  }, [isRefreshing, spinning]);

  // Local UI state to distinguish between "empty (all)" and "specific selections"
  const [attemptSelected, setAttemptSelected] = useState<SimulationFilter[]>(
    () => {
      const vals: SimulationFilter[] = [];
      if (simulationFilters.includes("general")) vals.push("general");
      if (simulationFilters.includes("practice")) vals.push("practice");
      if (simulationFilters.includes("archived")) vals.push("archived");
      // When all three are enabled functionally, start with empty to indicate "All attempts"
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
      currentFilters.length !== attemptSelected.length ||
      !currentFilters.every((filter) => attemptSelected.includes(filter))
    ) {
      setAttemptSelected(currentFilters);
    }
  }, [simulationFilters, attemptSelected]);

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
      `Cohort with ${getCohortMemberCount(cohort.id)} members`,
    memberCount: getCohortMemberCount(cohort.id),
  }));

  // Get selected cohorts for the picker
  const selectedCohorts = cohortOptions.filter((cohort) =>
    selectedCohortIds.includes(cohort.id),
  );

  // Automatically filter available roles and remove invalid selections when cohorts are selected
  useEffect(() => {
    if (selectedCohortIds.length > 0) {
      // When cohorts are selected, only allow "member" and "instructional" roles
      // Remove any existing selections that aren't "member" or "instructional"
      const validRoles = selectedRoles.filter(
        (role) => role === "member" || role === "instructional",
      );
      if (validRoles.length !== selectedRoles.length) {
        setSelectedRoles(validRoles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCohortIds, selectedRoles]);

  const handleCohortSelect = (cohorts: CohortSelectorCohort[]) => {
    setSelectedCohortIds(cohorts.map((c) => c.id));
  };

  // Convert departments to the format expected by DepartmentSelector
  const departmentOptions = departments.map((department) => ({
    id: department.id,
    title: department.title,
    ...(department.description && { description: department.description }),
  }));

  // Get selected departments for the picker
  const selectedDepartments = departmentOptions.filter((department) =>
    selectedDepartmentIds.includes(department.id),
  );

  const handleDepartmentSelect = (departments: typeof departmentOptions) => {
    setSelectedDepartmentIds(departments.map((d) => d.id));
  };

  const handleRoleSelect = (roles: ProfileRole[]) => {
    setSelectedRoles(roles);
  };

  // Check if search params exist (non-empty means non-default filters)
  const hasNonDefaultFilters = searchParams.toString().length > 0;

  // Handle reset button click - navigate to page without search params
  const handleReset = () => {
    router.replace(pathname, { scroll: false });
    // router.refresh() is not needed - router.replace already causes server component to re-render
  };

  return (
    <div className={practicePage ? "" : "pr-4"}>
      <div className="flex items-center gap-2">
        {/* On mobile, only show refresh button and date picker */}
        {isMobile ? (
          <>
            {/* Reset Button - only show when search params exist */}
            {hasNonDefaultFilters && (
              <Button
                variant="ghost"
                onClick={handleReset}
                className="h-8 px-2 lg:px-3 hidden md:flex"
                title="Reset filters to defaults"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* Date Range Picker - hide on practice page */}
            {!practicePage && (
              <DatePickerWithRange
                dateRange={dateRange}
                setDateRange={handleDateRangeChange}
                className="w-auto"
              />
            )}

            {/* Refresh Button - hide on practice page */}
            {!practicePage && (
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
            )}
          </>
        ) : (
          <>
            {/* Reset Button - only show when search params exist */}
            {hasNonDefaultFilters && (
              <Button
                variant="ghost"
                onClick={handleReset}
                className="h-8 px-2 lg:px-3 hidden md:flex"
                title="Reset filters to defaults"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* General/Practice/Archived Selector - hide on home and practice pages */}
            {!homePage && !practicePage && (
              <AttemptSelector
                selected={attemptSelected}
                onChange={(vals) => {
                  // Update UI state first
                  setAttemptSelected(vals);
                  // Empty selection means all attempts (all three modes on)
                  if (vals.length === 0) {
                    setSimulationFilters(["general", "practice", "archived"]);
                    return;
                  }
                  setSimulationFilters(vals);
                }}
                placeholder="Attempts"
              />
            )}

            {/* Role Picker - hide on home, report, and practice pages */}
            {!homePage && !reportPage && !practicePage && (
              <RoleSelector
                roles={
                  selectedCohortIds.length > 0
                    ? PROFILE_ROLES.filter(
                        (role) => role === "instructional" || role === "member",
                      )
                    : PROFILE_ROLES.filter((role) => scopedRoles.includes(role))
                }
                selectedRoles={selectedRoles}
                onSelect={handleRoleSelect}
                placeholder="Roles"
                hideSelectedChips={true}
              />
            )}

            {/* Cohort Picker - hide on practice page */}
            {!practicePage && activeCohorts.length > 1 && (
              <CohortSelector
                cohorts={cohortOptions}
                selectedCohorts={selectedCohorts}
                onSelect={handleCohortSelect}
                placeholder="Cohorts"
                hideSelectedChips={true}
              />
            )}

            {/* Department Picker - only show if more than 1 department */}
            {departments.length > 1 && (
              <DepartmentSelector
                departments={departmentOptions}
                selectedDepartments={selectedDepartments}
                onSelect={handleDepartmentSelect}
                placeholder="Departments"
                hideSelectedChips={true}
              />
            )}

            {/* Date Range Picker - hide on practice page */}
            {!practicePage && (
              <DatePickerWithRange
                dateRange={dateRange}
                setDateRange={handleDateRangeChange}
                className="w-auto"
              />
            )}

            {/* Refresh Button - hide on practice page */}
            {!practicePage && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
