/**
 * Rubrics.tsx
 * Used to display the rubrics page with all created rubrics and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Edit,
  Trash2,
  FileCheck,
  Star,
  Plus,
  BookOpen,
} from "lucide-react";

import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { deleteRubric } from "@/utils/mutations/rubrics/delete-rubric";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import { Rubric } from "@/types";

export default function Rubrics() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch rubrics data
  const { data: rubrics = [], refetch: refetchRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteRubric(deleteItem.id);

      toast.success("Rubric deleted successfully");
      refetchRubrics();
    } catch (error) {
      console.error("Error deleting rubric:", error);
      toast.error("Failed to delete rubric");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/rubrics/r/${id}`);
  };

  const handleCreateNew = () => {
    router.push("/create/rubrics/new");
  };

  const getPassPercentage = (rubric: Rubric) => {
    if (!rubric.points || rubric.points === 0) return 0;
    return Math.round((rubric.passPoints / rubric.points) * 100);
  };

  const getStatusBadge = (rubric: Rubric) => {
    const passPercentage = getPassPercentage(rubric);
    if (passPercentage >= 80)
      return { variant: "default" as const, text: "High Standard" };
    if (passPercentage >= 60)
      return { variant: "secondary" as const, text: "Standard" };
    return { variant: "outline" as const, text: "Flexible" };
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rubrics.map((rubric: Rubric) => {
          const statusBadge = getStatusBadge(rubric);
          const passPercentage = getPassPercentage(rubric);

          return (
            <Card key={rubric.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{rubric.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Star className="h-3 w-3" />
                      {rubric.points} total points
                    </CardDescription>
                  </div>
                  <Badge variant={statusBadge.variant}>
                    {statusBadge.text}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 flex flex-col justify-between">
                  {rubric.description && (
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {rubric.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileCheck className="h-3 w-3" />
                      Pass: {rubric.passPoints} pts ({passPercentage}%)
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(rubric.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(rubric.id, rubric.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {rubrics.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No rubrics yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first evaluation rubric to define assessment
                  criteria
                </p>
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Rubric
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the rubric "{deleteItem?.name}". This
              action cannot be undone and will affect any evaluations using this
              rubric.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
