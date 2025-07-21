/**
 * Departments.tsx
 * Departments page for the management section.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Department } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createDepartment } from "@/utils/mutations/departments/create-department";
import { deleteDepartment } from "@/utils/mutations/departments/delete-department";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDepartments } from "@/utils/queries/departments/get-all-departments";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Copy, Edit, MapPin, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DepartmentsDataTable } from "./DepartmentsDataTable";

export default function DepartmentsGeneralPage() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<string | null>(
    null
  );
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [affectedClasses, setAffectedClasses] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [affectedLocations, setAffectedLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const router = useRouter();

  // Fetch all required data
  const {
    data: departments,
    isLoading: isLoadingDepartments,
    isError,
  } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartments(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  // Create filter options
  const departmentCodeOptions = Array.from(
    new Set(departments?.map((dept) => dept.departmentCode) || [])
  )
    .sort()
    .map((code) => ({ value: code, label: code }));

  const profileOptions = profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.firstName} ${profile.lastName}`,
  }));

  const classCountOptions = [
    { value: "0", label: "No Classes" },
    { value: "1-5", label: "1-5 Classes" },
    { value: "6-10", label: "6-10 Classes" },
    { value: "11-20", label: "11-20 Classes" },
    { value: "21+", label: "21+ Classes" },
  ];

  const locationCountOptions = [
    { value: "0", label: "No Locations" },
    { value: "1-3", label: "1-3 Locations" },
    { value: "4-6", label: "4-6 Locations" },
    { value: "7-10", label: "7-10 Locations" },
    { value: "11+", label: "11+ Locations" },
  ];

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDialogOpen(false);
      setDepartmentToDelete(null);
    },
    onError: (error) => {
      logError("Failed to delete department:", error);
    },
  });

  const handleEditDepartment = (departmentId: string) => {
    router.push(`/management/departments/d/${departmentId}`);
  };

  // Helper functions
  const handleDeleteDepartment = async (departmentId: string) => {
    setDepartmentToDelete(departmentId);
    setIsLoadingImpact(true);

    try {
      // Get affected classes and locations for this department
      const deptClasses = classes.filter(
        (cls: { departmentId: string }) => cls.departmentId === departmentId
      );
      const deptLocations: Array<{ id: string; name: string }> = []; // No locations data, so empty array

      setAffectedClasses(deptClasses);
      setAffectedLocations(deptLocations);
    } catch (error) {
      logError("Error fetching impact data:", error);
      setAffectedClasses([]);
      setAffectedLocations([]);
    } finally {
      setIsLoadingImpact(false);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteDepartment = () => {
    if (departmentToDelete) {
      deleteDepartmentMutation.mutate(departmentToDelete);
    }
  };

  const handleDuplicate = async (department: Department) => {
    setIsDuplicating(department.id);
    try {
      logInfo("Duplicating department:", {
        departmentId: department.id,
        name: department.name,
      });

      const duplicatedDepartment = {
        name: `${department.name} Copy`,
        departmentCode: `${department.departmentCode}-COPY`,
        description: department.description,
        profileIds: department.profileIds,
      };

      await createDepartment(duplicatedDepartment);

      toast.success("Department duplicated successfully");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      logInfo("Department duplicated successfully:", {
        originalId: department.id,
        name: duplicatedDepartment.name,
      });
    } catch (error) {
      logError("Error duplicating department:", error);
      toast.error("Failed to duplicate department");
    } finally {
      setIsDuplicating(null);
    }
  };

  const canDuplicate = (_department: Department) => {
    // Can duplicate any department
    return true;
  };

  const getClassCount = (departmentId: string) => {
    return classes.filter(
      (cls: { departmentId: string }) => cls.departmentId === departmentId
    ).length;
  };

  const getLocationCount = (_departmentId: string) => {
    return 0; // No locations data, so always 0
  };

  const getProfileCount = (department: Department) => {
    return department.profileIds?.length || 0;
  };

  const renderDepartmentCard = (dept: Department) => (
    <Card
      key={dept.id}
      aria-label={dept.name}
      data-testid={`card-${dept.id}`}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{dept.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{dept.departmentCode}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canDuplicate(dept) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(dept)}
                disabled={isDuplicating === dept.id}
                aria-label={`Duplicate ${dept.name}`}
              >
                {isDuplicating === dept.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid={`edit-${dept.id}`}
              onClick={() => handleEditDepartment(dept.id)}
              aria-label={`Edit ${dept.name}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid={`delete-${dept.id}`}
              onClick={() => handleDeleteDepartment(dept.id)}
              aria-label={`Delete ${dept.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
          {dept.description}
        </p>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {getClassCount(dept.id)} classes
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {getLocationCount(dept.id)} locations
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {getProfileCount(dept)} profiles
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          Created {format(new Date(dept.createdAt), "MMM dd, yyyy")}
        </div>
      </CardContent>
    </Card>
  );

  // Helper function to render the main content
  const renderContent = () => {
    // 1. Loading State: Show skeleton cards
    if (isLoadingDepartments) {
      return (
        <div data-testid="departments-loading" className="contents">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} role="complementary">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-5/6 mt-1" />
                <Skeleton className="h-4 w-1/2 mt-3" />
                <span className="sr-only">loading</span>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // 2. Error State
    if (isError) {
      return (
        <div className="col-span-full flex items-center justify-center h-48">
          <p className="text-destructive">Failed to load departments.</p>
        </div>
      );
    }

    // 3. Empty State: Show 'No departments found' message
    if (departments && departments.length === 0) {
      return (
        <div className="col-span-full flex items-center justify-center h-48">
          <p className="text-muted-foreground">No departments found</p>
        </div>
      );
    }

    // 4. Success State: Show the table with filtering
    return (
      <DepartmentsDataTable
        data={departments || []}
        departmentCodeOptions={departmentCodeOptions}
        profileOptions={profileOptions}
        classCountOptions={classCountOptions}
        locationCountOptions={locationCountOptions}
        renderDepartmentCard={renderDepartmentCard}
      />
    );
  };

  return (
    <div className="space-y-6">
      {renderContent()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingImpact ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading impact analysis...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to delete this department? This action
                    cannot be undone.
                  </p>

                  {(affectedClasses.length > 0 ||
                    affectedLocations.length > 0) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-red-800 mb-2">
                        ⚠️ This will affect the following:
                      </div>

                      {affectedClasses.length > 0 && (
                        <div className="mb-2">
                          <span className="font-medium text-red-700">
                            {affectedClasses.length} class
                            {affectedClasses.length !== 1 ? "es" : ""}:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedClasses
                              .slice(0, 3)
                              .map((cls: { id: string; name: string }) => (
                                <li key={cls.id}>{cls.name}</li>
                              ))}
                            {affectedClasses.length > 3 && (
                              <li>...and {affectedClasses.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                      )}

                      {affectedLocations.length > 0 && (
                        <div>
                          <span className="font-medium text-red-700">
                            {affectedLocations.length} location
                            {affectedLocations.length !== 1 ? "s" : ""}:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedLocations
                              .slice(0, 3)
                              .map((loc: { id: string; name: string }) => (
                                <li key={loc.id}>{loc.name}</li>
                              ))}
                            {affectedLocations.length > 3 && (
                              <li>
                                ...and {affectedLocations.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-sm font-medium text-red-700">
                    This action will permanently remove the department.
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDepartmentMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteDepartment}
              disabled={deleteDepartmentMutation.isPending || isLoadingImpact}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteDepartmentMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
