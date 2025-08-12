/**
 * SimulationHistory.tsx
 * Used to display the simulation history page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

import { useProfile } from "@/contexts/profile-context";
import { useHistoryColumns } from "@/hooks/use-history-columns";
import type { ProfileRole } from "@/types";
import { DataTable } from "./DataTable";

export interface SimulationHistoryProps {
  profileId?: string | null;
  cohortIds?: string[];
  showExport?: boolean;
  showPractice?: boolean;
  showNormal?: boolean;
  startDate?: Date;
  endDate?: Date;
  allowedRoles?: ProfileRole[];
}

export default function SimulationHistory({
  profileId,
  showExport = true,
  cohortIds = undefined,
  showPractice = false,
  showNormal = true,
  startDate,
  endDate,
  allowedRoles,
}: SimulationHistoryProps) {
  const { effectiveProfile } = useProfile();

  // Default allowed roles: on home/practice (when viewing a specific profile),
  // if not provided, default to the effectiveProfile's role
  const effectiveAllowedRoles: ProfileRole[] | undefined =
    allowedRoles !== undefined
      ? allowedRoles
      : profileId
        ? effectiveProfile
          ? [effectiveProfile.role]
          : undefined
        : undefined;
  const { columns, data, profileOptions, simulationOptions, scenarioOptions } =
    useHistoryColumns({
      profileId: profileId || null,
      showExport,
      cohortIds,
      showPractice,
      showNormal,
      allowedRoles: effectiveAllowedRoles,
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    });

  return (
    <DataTable
      data={data || []}
      columns={columns as never}
      profileOptions={profileOptions}
      simulationOptions={simulationOptions}
      scenarioOptions={scenarioOptions}
      showExport={showExport}
      showAll={!profileId} // showAll is true when profileId is null/undefined
      startDate={startDate}
      endDate={endDate}
    />
  );
}
