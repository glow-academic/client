"use client";

import { Plus, Upload, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/contexts/profile-context";
import { useCreateStaffData } from "@/lib/api/v2/hooks/profile";
import CSVImportStaffModal from "./CSVImportStaffModal";
import ManualAddStaffModal from "./ManualAddStaffModal";

export interface CreateStaffButtonProps {
  departmentIds?: string[];
  cohortIds?: string[];
  onDone?: () => void;
}

export default function CreateStaffButton({
  departmentIds: scopedDepartmentIds,
  cohortIds: scopedCohortIds,
  onDone,
}: CreateStaffButtonProps) {
  const { effectiveProfile, departmentIds } = useProfile();
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  // Fetch create staff data
  const { data: createStaffData, isLoading } = useCreateStaffData(
    {
      departmentIds: departmentIds,
      profileId: effectiveProfile?.id || "",
    },
    !!effectiveProfile?.id
  );

  // Transform mappings for pickers
  const departmentMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    if (createStaffData?.department_mapping) {
      Object.entries(createStaffData.department_mapping).forEach(
        ([id, dept]) => {
          mapping[id] = {
            name: dept.name,
            description: dept.description || "",
          };
        }
      );
    }
    return mapping;
  }, [createStaffData?.department_mapping]);

  const cohortMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    if (createStaffData?.cohort_mapping) {
      Object.entries(createStaffData.cohort_mapping).forEach(([id, cohort]) => {
        mapping[id] = {
          name: cohort.name,
          description: cohort.description || "",
        };
      });
    }
    return mapping;
  }, [createStaffData?.cohort_mapping]);

  const validDepartmentIds = useMemo(() => {
    return Object.keys(departmentMapping);
  }, [departmentMapping]);

  const validCohortIds = useMemo(() => {
    return Object.keys(cohortMapping);
  }, [cohortMapping]);

  const roleOptions = createStaffData?.role_options || [];

  const handleManualAdd = () => {
    setShowManualModal(true);
  };

  const handleCSVImport = () => {
    setShowCSVModal(true);
  };

  const handleModalDone = () => {
    setShowManualModal(false);
    setShowCSVModal(false);
    if (onDone) {
      onDone();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Create Staff
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleManualAdd}>
            <UserPlus className="h-4 w-4 mr-2" />
            Manual Add
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCSVImport}>
            <Upload className="h-4 w-4 mr-2" />
            CSV Import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showManualModal && (
        <ManualAddStaffModal
          open={showManualModal}
          onOpenChange={setShowManualModal}
          {...(scopedDepartmentIds && scopedDepartmentIds.length > 0 && { departmentIds: scopedDepartmentIds })}
          {...(scopedCohortIds && scopedCohortIds.length > 0 && { cohortIds: scopedCohortIds })}
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
          cohortMapping={cohortMapping}
          validCohortIds={validCohortIds}
          roleOptions={roleOptions}
          onDone={handleModalDone}
        />
      )}

      {showCSVModal && (
        <CSVImportStaffModal
          open={showCSVModal}
          onOpenChange={setShowCSVModal}
          {...(scopedDepartmentIds && scopedDepartmentIds.length > 0 && { departmentIds: scopedDepartmentIds })}
          {...(scopedCohortIds && scopedCohortIds.length > 0 && { cohortIds: scopedCohortIds })}
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
          cohortMapping={cohortMapping}
          validCohortIds={validCohortIds}
          roleOptions={roleOptions}
          onDone={handleModalDone}
        />
      )}
    </>
  );
}
