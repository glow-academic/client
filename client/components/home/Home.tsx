/**
 * Home.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { useProfile } from "@/contexts/profile-context";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import CohortDashboard from "../common/cohort/CohortDashboard";
import { Cohort, CohortPicker } from "../common/cohort/CohortPicker";

export default function Home() {
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
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  useEffect(() => {
    if (shouldShowAll && cohortsForPicker.length > 0) {
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

  // Show error if no cohorts are available
  if (!allCohorts || allCohorts.length === 0) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Cohorts Available</h1>
          <p className="text-gray-600">
            There are no cohorts configured in the system. Please contact an
            administrator to create cohorts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cohort Filter */}
      <div className="w-full">
        <CohortPicker
          cohorts={cohortsForPicker}
          selectedCohorts={selectedCohorts}
          onSelect={setSelectedCohorts}
          placeholder="Select cohorts to view..."
          description="Choose one or more cohorts to filter the progress view. Leave empty to view all cohorts."
        />
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
