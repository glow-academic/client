/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * All data is fetched server-side and passed as props.
 * All actions use server actions - no client-side data fetching.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import StaffBulkEditModal from "@/components/common/staff/StaffBulkEditModal";
import { StaffDataTable } from "@/components/common/staff/StaffDataTable";
import StaffEditModal from "@/components/common/staff/StaffEditModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import ActiveUsersKPI from "./kpis/ActiveUsersKPI";
import AdminUsersKPI from "./kpis/AdminUsersKPI";
import InstructionalUsersKPI from "./kpis/InstructionalUsersKPI";
import TAUsersKPI from "./kpis/TAUsersKPI";
import TotalRequestsKPI from "./kpis/TotalRequestsKPI";

// Import types from page (all types are already exported from the page)
import type {
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  BulkDeleteStaffIn,
  BulkDeleteStaffOut,
  BulkUpdateStaffIn,
  BulkUpdateStaffOut,
  CreateStaffDataOut,
  DeleteStaffIn,
  DeleteStaffOut,
  ProcessCSVIn,
  ProcessCSVOut,
  ProfileListItem,
  SearchStaffIn,
  SearchStaffOut,
  StaffListOut,
  UpdateStaffIn,
  UpdateStaffOut,
} from "@/app/(main)/system/staff/page";

// Explicitly define server action types (matching the page exports)
export type DeleteStaffAction = (
  input: DeleteStaffIn
) => Promise<DeleteStaffOut>;
export type BulkDeleteStaffAction = (
  input: BulkDeleteStaffIn
) => Promise<BulkDeleteStaffOut>;
export type UpdateStaffAction = (
  input: UpdateStaffIn
) => Promise<UpdateStaffOut>;
export type BulkUpdateStaffAction = (
  input: BulkUpdateStaffIn
) => Promise<BulkUpdateStaffOut>;
export type SearchStaffAction = (
  input: SearchStaffIn
) => Promise<SearchStaffOut>;
export type ProcessCSVAction = (input: ProcessCSVIn) => Promise<ProcessCSVOut>;
export type BulkCreateOrUpdateStaffAction = (
  input: BulkCreateOrUpdateStaffIn
) => Promise<BulkCreateOrUpdateStaffOut>;

export interface StaffProps {
  // Server-provided data (fetched server-side, no client fetching)
  listData: StaffListOut;
  initialSearchData?: SearchStaffOut;
  initialCreateStaffData?: CreateStaffDataOut;
  // Server actions (pure server actions, no client-side mutations)
  deleteStaffAction?: DeleteStaffAction;
  bulkDeleteStaffAction?: BulkDeleteStaffAction;
  updateStaffAction?: UpdateStaffAction;
  bulkUpdateStaffAction?: BulkUpdateStaffAction;
  searchStaffAction?: SearchStaffAction;
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
}

export default function Staff({
  listData: serverListData,
  initialSearchData,
  initialCreateStaffData,
  deleteStaffAction,
  bulkDeleteStaffAction,
  updateStaffAction,
  bulkUpdateStaffAction,
  searchStaffAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
}: StaffProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const { effectiveProfile } = useProfile(); // Still needed for child components

  // Use server-provided data directly
  const staffData = serverListData;

  // Selection state
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);

  // Edit modal - use list data directly
  const [editProfileId, setEditProfileId] = React.useState<string | null>(null);

  // Bulk edit modal
  const [showBulkEditModal, setShowBulkEditModal] = React.useState(false);

  // Bulk delete dialog
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = React.useState(false);

  // Single delete dialog
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] =
    React.useState(false);
  const [deleteStaffMember, setDeleteStaffMember] =
    React.useState<ProfileListItem | null>(null);

  // Extract data from server-provided data (already filtered server-side)
  const staff = React.useMemo(() => staffData?.staff || [], [staffData?.staff]);
  const cohortMapping = React.useMemo(
    () => staffData?.cohort_mapping || {},
    [staffData?.cohort_mapping]
  );
  const departmentMapping = React.useMemo(
    () => staffData?.department_mapping || {},
    [staffData?.department_mapping]
  );
  const validDepartmentIds = React.useMemo(
    () => staffData?.valid_department_ids || [],
    [staffData?.valid_department_ids]
  );
  const trendData = React.useMemo(
    () =>
      staffData?.trend_data || {
        active: [],
        admin: [],
        instructional: [],
        ta: [],
        total_requests: [],
      },
    [staffData?.trend_data]
  );

  // Calculate counts for KPI cards
  const counts = React.useMemo(() => {
    const activeStaff = staff.filter((s) => s.active);
    const inactiveStaff = staff.filter((s) => !s.active);

    return {
      total: staff.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      instructional: staff.filter((s) => s.role === "instructional").length,
      ta: staff.filter((s) => s.role === "ta").length,
      admin: staff.filter((s) => s.role === "admin").length,
      superadmin: staff.filter((s) => s.role === "superadmin").length,
      guest: staff.filter((s) => s.role === "guest").length,
      totalRequests: staff.reduce((sum, s) => sum + (s.total_requests || 0), 0),
    };
  }, [staff]);

  // Refresh data by revalidating server-side data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh(); // Triggers server-side revalidation
      toast.success("Staff data refreshed");
    } catch {
      toast.error("Failed to refresh staff data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Use server-provided filter options directly (no client-side computation)
  const roleOptions = React.useMemo(
    () =>
      (staffData?.role_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [staffData?.role_options]
  );

  const cohortOptions = React.useMemo(
    () =>
      (staffData?.cohort_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [staffData?.cohort_options]
  );

  const lastActiveOptions = React.useMemo(
    () =>
      (staffData?.last_active_options || [])
        .map((opt) => ({
          value: opt["value"] as string,
          label: opt["label"] as string,
        }))
        .filter((opt) => opt.value && opt.label),
    [staffData?.last_active_options]
  );

  return (
    <div className="space-y-6" data-page="staff-index">
      {/* Header with summary stats - 5 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ActiveUsersKPI
          currentValue={counts.active}
          trendData={trendData["active"] || []}
        />
        <AdminUsersKPI
          currentValue={
            effectiveProfile?.role === "superadmin"
              ? (counts.superadmin || 0) + (counts.admin || 0)
              : counts.admin
          }
          trendData={trendData["admin"] || []}
        />
        <InstructionalUsersKPI
          currentValue={counts.instructional}
          trendData={trendData["instructional"] || []}
        />
        <TAUsersKPI
          currentValue={counts.ta}
          trendData={trendData["ta"] || []}
        />
        <TotalRequestsKPI
          currentValue={counts.totalRequests}
          trendData={trendData["total_requests"] || []}
        />
      </div>

      {/* Staff Data Table */}
      <StaffDataTable
        data={staff}
        cohortMapping={cohortMapping}
        departmentMapping={departmentMapping}
        roleOptions={roleOptions}
        cohortOptions={cohortOptions}
        lastActiveOptions={lastActiveOptions}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        selectedStaffIds={selectedStaffIds}
        onStaffSelect={React.useCallback((id: string, checked: boolean) => {
          setSelectedStaffIds((prev) =>
            checked ? [...prev, id] : prev.filter((x) => x !== id)
          );
        }, [])}
        onSelectAll={React.useCallback(
          (checked: boolean, visibleRowIds?: string[]) => {
            if (checked && visibleRowIds) {
              // Select all visible rows
              setSelectedStaffIds((prev) => {
                const newSelection = [...prev];
                visibleRowIds.forEach((id) => {
                  if (!newSelection.includes(id)) {
                    newSelection.push(id);
                  }
                });
                return newSelection;
              });
            } else {
              // Deselect all visible rows
              setSelectedStaffIds((prev) =>
                prev.filter((id) => !visibleRowIds?.includes(id))
              );
            }
          },
          []
        )}
        onCreate={React.useCallback(async () => {
          // Refresh after create
          router.refresh();
        }, [router])}
        onPreview={React.useCallback((staffMember: ProfileListItem) => {
          window.open(
            `/analytics/reports/p/${staffMember.profile_id}`,
            "_blank",
            "noopener,noreferrer"
          );
        }, [])}
        onEdit={React.useCallback((staffMember: ProfileListItem) => {
          setEditProfileId(staffMember.profile_id);
        }, [])}
        onDelete={React.useCallback((staffMember: ProfileListItem) => {
          setDeleteStaffMember(staffMember);
          setShowSingleDeleteDialog(true);
        }, [])}
        onBulkEdit={React.useCallback(() => {
          if (selectedStaffIds.length === 0) return;
          setShowBulkEditModal(true);
        }, [selectedStaffIds])}
        onBulkDelete={React.useCallback(() => {
          setShowBulkDeleteDialog(true);
        }, [])}
        canDelete={React.useCallback(
          (profileId: string) => {
            const row = staff.find((s) => s.profile_id === profileId);
            return row?.can_delete ?? false;
          },
          [staff]
        )}
        deletableCount={React.useMemo(() => {
          return selectedStaffIds.filter((id) => {
            const row = staff.find((s) => s.profile_id === id);
            return row?.can_delete ?? false;
          }).length;
        }, [selectedStaffIds, staff])}
        editableCount={React.useMemo(() => {
          return selectedStaffIds.filter((id) => {
            const row = staff.find((s) => s.profile_id === id);
            return row?.can_edit ?? false;
          }).length;
        }, [selectedStaffIds, staff])}
        canEdit={React.useCallback(
          (profileId: string) => {
            const row = staff.find((s) => s.profile_id === profileId);
            return row?.can_edit ?? false;
          },
          [staff]
        )}
        {...(searchStaffAction && { searchStaffAction })}
        {...(processCSVAction && { processCSVAction })}
        {...(bulkCreateOrUpdateStaffAction && {
          bulkCreateOrUpdateStaffAction,
        })}
        {...(initialSearchData && { initialSearchData })}
        {...(initialCreateStaffData && { initialCreateStaffData })}
      />

      {/* Edit Staff Modal */}
      {updateStaffAction && (
        <StaffEditModal
          profileId={editProfileId}
          open={!!editProfileId}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setEditProfileId(null);
            }
          }}
          onDone={() => {
            setEditProfileId(null);
            router.refresh();
          }}
          updateStaffAction={updateStaffAction}
          staffItem={staff.find((s) => s.profile_id === editProfileId) || null}
          validDepartmentIds={validDepartmentIds}
          departmentMapping={departmentMapping}
        />
      )}

      {/* Bulk Edit Modal */}
      {bulkUpdateStaffAction && (
        <StaffBulkEditModal
          profileIds={selectedStaffIds}
          open={showBulkEditModal}
          onOpenChange={(open: boolean) => {
            setShowBulkEditModal(open);
          }}
          onDone={() => {
            setSelectedStaffIds([]);
            router.refresh();
          }}
          bulkUpdateStaffAction={bulkUpdateStaffAction}
          selectedStaffItems={staff.filter((s) =>
            selectedStaffIds.includes(s.profile_id)
          )}
          validDepartmentIds={validDepartmentIds}
          departmentMapping={departmentMapping}
        />
      )}

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <AlertDialogContent data-testid="dialog-bulk-delete-staff">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedStaffIds.length} staff member
              {selectedStaffIds.length !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected accounts. Default
              profiles and your own account will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const selected = staff.filter((s) =>
              selectedStaffIds.includes(s.profile_id)
            );
            const nonDeletable = selected.filter((s) => !s.can_delete);
            const deletable = selected.filter((s) => s.can_delete);
            const impactedCohorts = deletable.map((s) => ({
              staff: s,
              cohortCount: s.cohort_ids.length,
            }));
            return (
              <div className="space-y-3">
                {deletable.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      The following accounts and their cohort memberships will
                      be removed:
                    </p>
                    <div className="mt-1 ml-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-2">
                        {impactedCohorts.map(({ staff, cohortCount }) => (
                          <li
                            key={staff.profile_id}
                            className="text-red-600 dark:text-red-300"
                          >
                            • {staff.first_name} {staff.last_name} (
                            {staff.email}){" "}
                            {cohortCount > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                – affects {cohortCount} cohort
                                {cohortCount > 1 ? "s" : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                – no cohort memberships
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {nonDeletable.length > 0 && (
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      The following accounts cannot be deleted and will be
                      skipped:
                    </p>
                    <div className="mt-1 ml-4 max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-1">
                        {nonDeletable.map((s) => (
                          <li
                            key={s.profile_id}
                            className="text-yellow-700 dark:text-yellow-300"
                          >
                            • {s.first_name} {s.last_name} ({s.email})
                            {s.profile_id === effectiveProfile?.id
                              ? " – your account"
                              : s.default_profile
                                ? " – default profile"
                                : " – cannot delete"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
              onClick={async () => {
                try {
                  const deletableIds = staff
                    .filter(
                      (s) =>
                        selectedStaffIds.includes(s.profile_id) && s.can_delete
                    )
                    .map((s) => s.profile_id);
                  if (deletableIds.length === 0) {
                    setShowBulkDeleteDialog(false);
                    return;
                  }
                  if (!bulkDeleteStaffAction) return;
                  await bulkDeleteStaffAction({
                    body: { profileIds: deletableIds },
                  });
                  router.refresh();
                  toast.success("Selected staff deleted");
                  setSelectedStaffIds([]);
                  setShowBulkDeleteDialog(false);
                } catch {
                  toast.error("Failed to delete selected staff");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation */}
      <AlertDialog
        open={showSingleDeleteDialog}
        onOpenChange={setShowSingleDeleteDialog}
      >
        <AlertDialogContent data-testid="dialog-delete-staff">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteStaffMember?.first_name}{" "}
              {deleteStaffMember?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account. Default profiles and
              your own account cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStaffMember &&
            (() => {
              const staffMember = deleteStaffMember;
              const canDelete = staffMember.can_delete;
              const cohortCount = staffMember.cohort_ids.length;

              if (!canDelete) {
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">
                        This account cannot be deleted:
                      </p>
                      <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          • {staffMember.first_name} {staffMember.last_name} (
                          {staffMember.email})
                          {staffMember.profile_id === effectiveProfile?.id
                            ? " – your account"
                            : staffMember.default_profile
                              ? " – default profile"
                              : " – cannot delete"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      The following account and its cohort memberships will be
                      removed:
                    </p>
                    <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-2">
                        <li className="text-red-600 dark:text-red-300">
                          • {staffMember.first_name} {staffMember.last_name} (
                          {staffMember.email}){" "}
                          {cohortCount > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              – affects {cohortCount} cohort
                              {cohortCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              – no cohort memberships
                            </span>
                          )}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-confirm-delete"
              onClick={async () => {
                if (!deleteStaffMember) return;

                if (!deleteStaffMember.can_delete) {
                  toast.error("This user cannot be deleted");
                  setShowSingleDeleteDialog(false);
                  setDeleteStaffMember(null);
                  return;
                }

                try {
                  if (!deleteStaffAction) return;
                  await deleteStaffAction({
                    body: { profileId: deleteStaffMember.profile_id },
                  });
                  router.refresh();
                  toast.success("User deleted successfully");
                  setShowSingleDeleteDialog(false);
                  setDeleteStaffMember(null);
                } catch {
                  toast.error("Failed to delete user");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
