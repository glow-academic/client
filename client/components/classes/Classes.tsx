/**
 * Classes.tsx
 * Classes page for the management section.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
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
import { useClassColumns } from "@/hooks/use-class-columns";
import { Class, Document, Scenario } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createClass } from "@/utils/mutations/classes/create-class";
import { deleteClass } from "@/utils/mutations/classes/delete-class";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getDocumentsByClass } from "@/utils/queries/documents/get-documents-by-class";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getScenariosByClass } from "@/utils/queries/scenarios/get-scenarios-by-class";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Copy, Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ClassesDataTable } from "./ClassesDataTable";
import { getAllDepartments } from "@/utils/queries/departments/get-all-departments";

export default function ClassesGeneralPage() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [affectedScenarios, setAffectedScenarios] = useState<Scenario[]>([]);
  const [affectedDocuments, setAffectedDocuments] = useState<Document[]>([]);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const router = useRouter();

  // Fetch all required data
  const {
    data: classes,
    isLoading: isLoadingClasses,
    isError, // It's good practice to handle errors too
  } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartments(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  // Create table columns
  const { columns } = useClassColumns({
    documents,
  });

  // Create filter options
  const yearOptions = Array.from(
    new Set(classes?.map((cls) => cls.year.toString()) || [])
  )
    .sort()
    .map((year) => ({ value: year, label: year }));

  const termOptions = [
    { value: "fall", label: "Fall" },
    { value: "spring", label: "Spring" },
    { value: "summer", label: "Summer" },
  ];

  const profileOptions = profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.firstName} ${profile.lastName}`,
  }));

  const documentCountOptions = [
    { value: "0", label: "No Documents" },
    { value: "1-5", label: "1-5 Documents" },
    { value: "6-10", label: "6-10 Documents" },
    { value: "11-20", label: "11-20 Documents" },
    { value: "21+", label: "21+ Documents" },
  ];

  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      setDeleteDialogOpen(false);
      setClassToDelete(null);
    },
    onError: (error) => {
      logError("Failed to delete class:", error);
    },
  });

  const handleEditClass = (classId: string) => {
    router.push(`/classes/c/${classId}`);
  };

  // Helper functions
  const handleDeleteClass = async (classId: string) => {
    setClassToDelete(classId);
    setIsLoadingImpact(true);

    try {
      // Fetch affected scenarios and documents
      const [scenarios, docs] = await Promise.all([
        getScenariosByClass([classId]),
        getDocumentsByClass([classId]),
      ]);

      setAffectedScenarios(scenarios);
      setAffectedDocuments(docs);
    } catch (error) {
      logError("Error fetching impact data:", error);
      setAffectedScenarios([]);
      setAffectedDocuments([]);
    } finally {
      setIsLoadingImpact(false);
      setDeleteDialogOpen(true);
    }
  };

  const confirmDeleteClass = () => {
    if (classToDelete) {
      deleteClassMutation.mutate(classToDelete);
    }
  };

  const handleDuplicate = async (classItem: Class) => {
    // Only allow duplicating default classes (reverse logic from cohorts)
    if (!classItem.defaultClass) {
      toast.error("This class cannot be duplicated");
      return;
    }

    setIsDuplicating(classItem.id);
    try {
      logInfo("Duplicating class:", {
        classId: classItem.id,
        name: classItem.name,
      });

      const duplicatedClass = {
        name: `${classItem.name} Copy`,
        classCode: `${classItem.classCode}-COPY`,
        year: classItem.year,
        term: classItem.term,
        description: classItem.description,
        defaultClass: false, // Duplicated classes are not default
        departmentId: classItem.departmentId,
        profileIds: classItem.profileIds,
      };

      await createClass(duplicatedClass);

      toast.success("Class duplicated successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      logInfo("Class duplicated successfully:", {
        originalId: classItem.id,
        name: duplicatedClass.name,
      });
    } catch (error) {
      logError("Error duplicating class:", error);
      toast.error("Failed to duplicate class");
    } finally {
      setIsDuplicating(null);
    }
  };

  const canDuplicate = (classItem: Class) => {
    // Can only duplicate default classes
    return classItem.defaultClass;
  };

  const formatClassTerm = (term: string) => {
    switch (term) {
      case "fall":
        return "Fall";
      case "spring":
        return "Spring";
      case "summer":
        return "Summer";
      default:
        return term;
    }
  };

  const renderClassCard = (cls: Class) => (
    <Card
      key={cls.id}
      aria-label={cls.name}
      data-testid={`card-${cls.id}`}
      className="relative flex flex-col h-full"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{cls.name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{departments?.find((department) => department.id === cls.departmentId)?.departmentCode + " " + cls.classCode}</Badge>
              <Badge variant="secondary">
                {formatClassTerm(cls.term)} {cls.year}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canDuplicate(cls) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(cls)}
                disabled={isDuplicating === cls.id}
                aria-label={`Duplicate ${cls.name}`}
              >
                {isDuplicating === cls.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              data-testid={`edit-${cls.id}`}
              onClick={() => handleEditClass(cls.id)}
              aria-label={`Edit ${cls.name}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid={`delete-${cls.id}`}
              onClick={() => handleDeleteClass(cls.id)}
              aria-label={`Delete ${cls.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
          {cls.description}
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Created {format(new Date(cls.createdAt), "MMM dd, yyyy")}
        </div>
      </CardContent>
    </Card>
  );

  // Helper function to render the main content
  const renderContent = () => {
    // 1. Loading State: Show skeleton cards
    if (isLoadingClasses) {
      /*  data-testid makes it trivially wait-able from Cypress  */
      return (
        <div data-testid="classes-loading" className="contents">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} role="complementary">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <div className="flex gap-2 mt-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-5/6 mt-1" />
                <Skeleton className="h-4 w-1/2 mt-3" />
                <span className="sr-only">loading</span>{" "}
                {/* This is for the test */}
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
          <p className="text-destructive">Failed to load classes.</p>
        </div>
      );
    }

    // 3. Empty State: Show 'No classes found' message
    if (classes && classes.length === 0) {
      return (
        <div className="col-span-full flex items-center justify-center h-48">
          <p className="text-muted-foreground">No classes found</p>
        </div>
      );
    }

    // 4. Success State: Show the table with filtering
    return (
      <ClassesDataTable
        columns={columns}
        data={classes || []}
        yearOptions={yearOptions}
        termOptions={termOptions}
        profileOptions={profileOptions}
        documentCountOptions={documentCountOptions}
        renderClassCard={renderClassCard}
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
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingImpact ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Loading impact analysis...
                </div>
              ) : (
                <div className="space-y-3">
                  <p>
                    Are you sure you want to delete this class? This action
                    cannot be undone.
                  </p>

                  {(affectedScenarios.length > 0 ||
                    affectedDocuments.length > 0) && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-medium text-red-800 mb-2">
                        ⚠️ This will affect the following:
                      </div>

                      {affectedScenarios.length > 0 && (
                        <div className="mb-2">
                          <span className="font-medium text-red-700">
                            {affectedScenarios.length} scenario
                            {affectedScenarios.length !== 1 ? "s" : ""}:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedScenarios.slice(0, 3).map((scenario) => (
                              <li key={scenario.id}>{scenario.name}</li>
                            ))}
                            {affectedScenarios.length > 3 && (
                              <li>
                                ...and {affectedScenarios.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {affectedDocuments.length > 0 && (
                        <div>
                          <span className="font-medium text-red-700">
                            {affectedDocuments.length} document
                            {affectedDocuments.length !== 1 ? "s" : ""}:
                          </span>
                          <ul className="mt-1 list-disc list-inside text-sm text-red-600">
                            {affectedDocuments.slice(0, 3).map((doc) => (
                              <li key={doc.id}>{doc.name}</li>
                            ))}
                            {affectedDocuments.length > 3 && (
                              <li>
                                ...and {affectedDocuments.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 text-sm font-medium text-red-700">
                    This action will permanently remove the class.
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClassMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClass}
              disabled={deleteClassMutation.isPending || isLoadingImpact}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteClassMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
