/**
 * Progress.tsx
 * Used to display the progress for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { useProfile } from "@/contexts/profile-context";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import CohortDashboard from "../common/cohort/CohortDashboard";
import { Cohort, CohortPicker } from "../common/cohort/CohortPicker";

export default function Progress() {
  const { effectiveProfile } = useProfile();
  const [selectedCohorts, setSelectedCohorts] = useState<Cohort[]>([]);

  // Fetch all cohorts
  const { data: allCohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: getAllCohorts,
  });

  // Transform cohorts for the picker
  const cohortsForPicker = useMemo(() => {
    if (!allCohorts) return [];

    return allCohorts.map((cohort) => ({
      id: cohort.id,
      title: cohort.title,
      description: `Cohort with ${cohort.profileIds?.length || 0} members`,
      memberCount: cohort.profileIds?.length || 0,
    }));
  }, [allCohorts]);

  // Get selected cohort IDs
  const selectedCohortIds = useMemo(() => {
    return selectedCohorts.map((cohort) => cohort.id);
  }, [selectedCohorts]);

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructor" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  useEffect(() => {
    if (shouldShowAll) {
      setSelectedCohorts(cohortsForPicker);
    }
  }, [shouldShowAll, cohortsForPicker]);

  if (loadingCohorts) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cohorts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cohort Filter */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Progress Analytics</h1>
          <p className="text-muted-foreground mt-2">
            View progress across selected cohorts
          </p>
        </div>
        <div className="w-80">
          <CohortPicker
            cohorts={cohortsForPicker}
            selectedCohorts={selectedCohorts}
            onSelect={setSelectedCohorts}
            placeholder="Select cohorts to view..."
            description="Choose one or more cohorts to filter the progress view. Leave empty to view all cohorts."
          />
        </div>
      </div>

      {/* Dashboard Content */}
      {selectedCohortIds.length > 0 ? (
        <CohortDashboard cohortIds={selectedCohortIds} />
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Select Cohorts</h2>
          <p className="text-muted-foreground">
            Use the filter above to select cohorts and view their progress
          </p>
        </div>
      )}
    </div>
  );
}
