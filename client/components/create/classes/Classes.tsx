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
import { logError } from "@/utils/logger";
import { deleteClass } from "@/utils/mutations/classes/delete-class";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClassesGeneralPage() {
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const router = useRouter();

  // Fetch all data for aggregated view
  const {
    data: classes,
    isLoading: isLoadingClasses,
    isError, // It's good practice to handle errors too
  } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

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
    router.push(`/create/classes/c/${classId}`);
  };

  // Helper functions
  const handleDeleteClass = (classId: string) => {
    setClassToDelete(classId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteClass = () => {
    if (classToDelete) {
      deleteClassMutation.mutate(classToDelete);
    }
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

    // 4. Success State: Show the actual class cards
    return classes
      ?.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((cls) => (
        <Card
          key={cls.id}
          aria-label={cls.name}
          data-testid={`card-${cls.id}`}
          className="relative"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{cls.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{cls.classCode}</Badge>
                  <Badge variant="secondary">
                    {formatClassTerm(cls.term)} {cls.year}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                data-testid={`edit-${cls.id}`}
                onClick={() => handleEditClass(cls.id)}
                aria-label={`Edit ${cls.name}`}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-testid={`delete-${cls.id}`}
                onClick={() => handleDeleteClass(cls.id)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                aria-label={`Delete ${cls.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {cls.description}
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Created {format(new Date(cls.createdAt), "MMM dd, yyyy")}
            </div>
          </CardContent>
        </Card>
      ));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {renderContent()}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this class? This action cannot be
              undone and will remove all associated data including simulations,
              attempts, and grades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClass}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteClassMutation.isPending}
            >
              {deleteClassMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
