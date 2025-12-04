"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Upload, UserPlus } from "lucide-react";
import React from "react";

import type {
  CreateStaffDataOut,
  SearchStaffOut,
} from "@/app/(main)/management/staff/page";
import type {
  BulkCreateOrUpdateStaffAction,
  ProcessCSVAction,
  SearchStaffAction,
} from "@/components/staff/Staff";
import CSVImportStaffModal from "./CSVImportStaffModal";
import ManualAddStaffModal from "./ManualAddStaffModal";
import SearchExistingStaffModal from "./SearchExistingStaffModal";

export interface CreateStaffButtonProps {
  onCreate: (
    stagedProfiles?: Array<{
      profileId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
    }>
  ) => void;
  searchStaffAction?: SearchStaffAction;
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
  initialCreateStaffData?: CreateStaffDataOut;
  initialSearchData?: SearchStaffOut;
  cohortIds?: string[];
  departmentIds?: string[];
  validDepartmentIds: string[];
  validCohortIds: string[];
  isScoped?: boolean;
  // Control which buttons to show
  showCSVImport?: boolean;
  showSearchExisting?: boolean;
  showManualAdd?: boolean;
}

export function CreateStaffButton({
  onCreate,
  searchStaffAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  initialCreateStaffData,
  initialSearchData,
  cohortIds,
  departmentIds,
  validDepartmentIds,
  validCohortIds,
  isScoped = false,
  showCSVImport = true,
  showSearchExisting = true,
  showManualAdd = true,
}: CreateStaffButtonProps) {
  const [showManualModal, setShowManualModal] = React.useState(false);
  const [showCSVModal, setShowCSVModal] = React.useState(false);
  const [showSearchModal, setShowSearchModal] = React.useState(false);

  // Transform mappings for modals - simplified, computed directly
  const createStaffData = initialCreateStaffData;
  const departmentMappingForModals: Record<
    string,
    { name: string; description: string }
  > = {};
  if (createStaffData?.department_mapping) {
    Object.entries(createStaffData.department_mapping).forEach(([id, dept]) => {
      if (dept && typeof dept === "object" && "name" in dept) {
        departmentMappingForModals[id] = {
          name: String(dept.name),
          description: String(dept.description || ""),
        };
      }
    });
  }

  const cohortMappingForModals: Record<
    string,
    { name: string; description: string }
  > = {};
  if (createStaffData?.cohort_mapping) {
    Object.entries(createStaffData.cohort_mapping).forEach(([id, cohort]) => {
      if (cohort && typeof cohort === "object" && "name" in cohort) {
        cohortMappingForModals[id] = {
          name: String(cohort.name),
          description: String(cohort.description || ""),
        };
      }
    });
  }

  const roleOptionsForModals = createStaffData?.role_options || [];
  const isLoading = !createStaffData;

  const handleModalDone = () => {
    setShowManualModal(false);
    setShowCSVModal(false);
    setShowSearchModal(false);
    onCreate();
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
          {showManualAdd && (
            <DropdownMenuItem onClick={() => setShowManualModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Manual Add
            </DropdownMenuItem>
          )}
          {showSearchExisting && searchStaffAction && (
            <DropdownMenuItem onClick={() => setShowSearchModal(true)}>
              <Search className="h-4 w-4 mr-2" />
              Search Existing
            </DropdownMenuItem>
          )}
          {showCSVImport && (
            <DropdownMenuItem onClick={() => setShowCSVModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              CSV Import
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showManualModal && (
        <ManualAddStaffModal
          open={showManualModal}
          onOpenChange={setShowManualModal}
          {...(departmentIds &&
            departmentIds.length > 0 && {
              departmentIds: departmentIds,
            })}
          {...(cohortIds && cohortIds.length > 0 && { cohortIds: cohortIds })}
          departmentMapping={departmentMappingForModals}
          validDepartmentIds={validDepartmentIds}
          cohortMapping={cohortMappingForModals}
          validCohortIds={validCohortIds}
          roleOptions={roleOptionsForModals}
          onDone={handleModalDone}
          {...(bulkCreateOrUpdateStaffAction && {
            bulkCreateOrUpdateStaffAction,
          })}
          {...(isScoped ? { onStagedProfiles: onCreate } : {})}
        />
      )}

      {showSearchModal && searchStaffAction && (
        <SearchExistingStaffModal
          open={showSearchModal}
          onOpenChange={setShowSearchModal}
          {...(departmentIds &&
            departmentIds.length > 0 && {
              departmentIds: departmentIds,
            })}
          {...(cohortIds && cohortIds.length > 0 && { cohortIds: cohortIds })}
          departmentMapping={departmentMappingForModals}
          validDepartmentIds={validDepartmentIds}
          cohortMapping={cohortMappingForModals}
          validCohortIds={validCohortIds}
          onDone={handleModalDone}
          {...(initialSearchData && { initialSearchData })}
          searchStaffAction={searchStaffAction}
          {...(isScoped ? { onStagedProfiles: onCreate } : {})}
        />
      )}

      {showCSVModal && (
        <CSVImportStaffModal
          open={showCSVModal}
          onOpenChange={setShowCSVModal}
          {...(departmentIds &&
            departmentIds.length > 0 && {
              departmentIds: departmentIds,
            })}
          {...(cohortIds && cohortIds.length > 0 && { cohortIds: cohortIds })}
          departmentMapping={departmentMappingForModals}
          validDepartmentIds={validDepartmentIds}
          cohortMapping={cohortMappingForModals}
          validCohortIds={validCohortIds}
          roleOptions={roleOptionsForModals}
          onDone={handleModalDone}
          {...(processCSVAction && { processCSVAction })}
          {...(bulkCreateOrUpdateStaffAction && {
            bulkCreateOrUpdateStaffAction,
          })}
          {...(isScoped ? { onStagedProfiles: onCreate } : {})}
        />
      )}
    </>
  );
}
