/**
 * AnalyticsFilters.tsx
 * Combined date picker and cohort picker for analytics pages
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

"use client";

import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import {
  type SimulationFilter,
  useAnalyticsParams,
} from "@/hooks/use-analytics-params";
import { useIsMobile } from "@/hooks/use-mobile";
import { Download, Loader2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import AttemptSelector from "./analytics/AttemptSelector";
import {
  CohortSelector,
  Cohort as CohortSelectorCohort,
} from "./analytics/CohortSelector";
import { DepartmentSelector } from "./analytics/DepartmentSelector";
import { RoleSelector } from "./analytics/RoleSelector";
import { RefreshButton } from "./RefreshButton";

/** Inline analytics facets from the artifact endpoint response */
export interface AnalyticsFacetsData {
  fields?: {
    date_range?: { visible?: boolean } | null;
    departments?: { visible?: boolean } | null;
    cohorts?: { visible?: boolean } | null;
    roles?: { visible?: boolean } | null;
    attempts?: { visible?: boolean } | null;
  } | null;
  department_options?: Array<{ value: string; label?: string | null }>;
  cohort_options?: Array<{ value: string; label?: string | null }>;
  role_options?: Array<{
    value: string;
    label?: string | null;
    id?: string;
    name?: string;
    description?: string | null;
    icon_id?: string | null;
    color_id?: string | null;
    level?: number;
  }>;
  attempt_options?: string[];
  date_range_earliest?: string | null;
  date_range_latest?: string | null;
}

export interface AnalyticsFiltersProps {
  refreshAction: () => Promise<void>;
  /** Inline facets from the page's artifact endpoint */
  analyticsFilters: AnalyticsFacetsData | null | undefined;
  /** Optional server action that posts to the artifact-level
   *  ``/{artifact}/export`` and returns ``{file_id, file_name?}``.
   *  When provided alongside ``bffDownloadPrefix``, the toolbar renders
   *  a Download button that triggers a browser download via the BFF. */
  exportAction?: () => Promise<{ file_id: string; file_name?: string }>;
  /** BFF download path prefix — e.g. ``/api/attempt/download``. */
  bffDownloadPrefix?: string;
}

export function AnalyticsFilters({
  refreshAction,
  analyticsFilters,
  exportAction,
  bffDownloadPrefix,
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
  } = useAnalyticsParams({
    ...(analyticsFilters?.date_range_earliest !== undefined && {
      dateRangeEarliest: analyticsFilters.date_range_earliest,
    }),
  });

  // Server-driven field visibility
  const filterFields = analyticsFilters?.fields;
  const showAttempts = filterFields?.attempts?.visible ?? false;
  const showRoles = filterFields?.roles?.visible ?? false;
  const showCohorts = filterFields?.cohorts?.visible ?? false;
  const showDepartments = filterFields?.departments?.visible ?? false;

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!exportAction || !bffDownloadPrefix) return;
    setIsExporting(true);
    try {
      const result = await exportAction();
      if (!result.file_id) {
        toast.error("Export returned no file_id");
        return;
      }
      window.location.href = `${bffDownloadPrefix}/${result.file_id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshAction();
    } catch {
      toast.error("Failed to refresh analytics data");
    }
  };

  // Local UI state to distinguish between "empty (all)" and "specific selections"
  const [attemptSelected, setAttemptSelected] = useState<SimulationFilter[]>(
    () => {
      const vals: SimulationFilter[] = [];
      if (simulationFilters.includes("general")) vals.push("general");
      if (simulationFilters.includes("practice")) vals.push("practice");
      if (simulationFilters.includes("archived")) vals.push("archived");
      // When all three are enabled functionally, start with empty to indicate "All attempts"
      return vals.length === 3 ? [] : vals;
    }
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

  // Use analytics filters for cohort options (MV-backed)
  const cohortOptions = (analyticsFilters?.cohort_options ?? []).map((o) => ({
    id: o.value,
    title: o.label || o.value,
    description: "",
    memberCount: 0,
  }));

  // Get selected cohorts for the picker
  const selectedCohorts = cohortOptions.filter((cohort) =>
    selectedCohortIds.includes(cohort.id)
  );

  const handleCohortSelect = (cohorts: CohortSelectorCohort[]) => {
    setSelectedCohortIds(cohorts.map((c) => c.id));
  };

  // Use analytics filters for department options (MV-backed)
  const departmentOptions = (analyticsFilters?.department_options ?? []).map(
    (o) => ({
      id: o.value,
      title: o.label || o.value,
    })
  );

  // Get selected departments for the picker
  const selectedDepartments = departmentOptions.filter((department) =>
    selectedDepartmentIds.includes(department.id)
  );

  const handleDepartmentSelect = (selectedDepts: typeof departmentOptions) => {
    setSelectedDepartmentIds(selectedDepts.map((d) => d.id));
  };

  const roleOptions = (analyticsFilters?.role_options ?? []).map((o) => ({
    id: o.id || o.value,
    label: o.name || o.label || o.value,
    ...(o.description !== undefined && { description: o.description }),
    ...(o.icon_id !== undefined && { iconId: o.icon_id }),
    ...(o.color_id !== undefined && { colorId: o.color_id }),
    ...(o.level !== undefined && { level: o.level }),
  }));

  const handleRoleSelect = (roles: string[]) => {
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
    <div className="pr-0">
      <div className="flex items-center gap-2">
        {/* On mobile, only show refresh button and date picker */}
        {isMobile ? (
          <>
            {/* Reset Button - only show when search params exist */}
            {hasNonDefaultFilters && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-8 px-2 lg:px-3 hidden md:flex"
                title="Reset filters to defaults"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* Date Range Picker */}
            <DatePickerWithRange
              dateRange={dateRange}
              setDateRange={handleDateRangeChange}
              className="w-auto"
            />

            {/* Download (artifact-level export) */}
            {exportAction && bffDownloadPrefix && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleExport}
                disabled={isExporting}
                title="Download CSV"
                aria-label="Download CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Refresh Button */}
            <RefreshButton onClick={handleRefresh} />
          </>
        ) : (
          <>
            {/* Reset Button - only show when search params exist */}
            {hasNonDefaultFilters && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-8 px-2 lg:px-3 hidden md:flex"
                title="Reset filters to defaults"
              >
                Reset
                <X className="ml-2 h-4 w-4" />
              </Button>
            )}

            {/* General/Practice/Archived Selector - server-driven visibility */}
            {showAttempts && (
              <AttemptSelector
                options={
                  (analyticsFilters?.attempt_options as SimulationFilter[]) ?? [
                    "general",
                    "practice",
                    "archived",
                  ]
                }
                selected={attemptSelected}
                onChange={(vals) => {
                  // Update UI state first
                  setAttemptSelected(vals);
                  // Empty selection means all attempts (all available modes on)
                  if (vals.length === 0) {
                    setSimulationFilters(
                      (analyticsFilters?.attempt_options as SimulationFilter[]) ?? [
                        "general",
                        "practice",
                        "archived",
                      ]
                    );
                    return;
                  }
                  setSimulationFilters(vals);
                }}
                placeholder="Attempts"
              />
            )}

            {/* Role Picker - server-driven visibility */}
            {showRoles && roleOptions.length > 0 && (
              <RoleSelector
                roles={roleOptions}
                selectedRoles={selectedRoles}
                onSelect={handleRoleSelect}
                placeholder="Roles"
                hideSelectedChips={true}
              />
            )}

            {/* Cohort Picker - server-driven visibility */}
            {showCohorts && cohortOptions.length > 0 && (
              <CohortSelector
                cohorts={cohortOptions}
                selectedCohorts={selectedCohorts}
                onSelect={handleCohortSelect}
                placeholder="Cohorts"
                hideSelectedChips={true}
              />
            )}

            {/* Department Picker - server-driven visibility */}
            {showDepartments && departmentOptions.length > 0 && (
              <DepartmentSelector
                departments={departmentOptions}
                selectedDepartments={selectedDepartments}
                onSelect={handleDepartmentSelect}
                placeholder="Departments"
                hideSelectedChips={true}
              />
            )}

            {/* Date Range Picker */}
            <DatePickerWithRange
              dateRange={dateRange}
              setDateRange={handleDateRangeChange}
              className="w-auto"
            />

            {/* Download (artifact-level export) */}
            {exportAction && bffDownloadPrefix && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleExport}
                disabled={isExporting}
                title="Download CSV"
                aria-label="Download CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Refresh Button */}
            <RefreshButton onClick={handleRefresh} />
          </>
        )}
      </div>
    </div>
  );
}
