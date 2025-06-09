/**
 * components/admin/scenarios-content.tsx
 * Scenarios management component
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2 } from "lucide-react";

import { getScenarios } from "@/utils/queries/get-scenarios";
import { deleteScenario } from "@/utils/mutations/delete-scenario";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

export function ScenariosContent() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch scenarios data
  const { data: scenarios = [], refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getScenarios(),
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      const result = await deleteScenario(deleteItem.id);

      if (result.success) {
        toast.success("Scenario deleted successfully");
        refetchScenarios();
      } else {
        toast.error(result.error || "Failed to delete scenario");
      }
    } catch (error) {
      console.error("Error deleting scenario:", error);
      toast.error("Failed to delete scenario");
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
    router.push(`/chat/scenarios/s/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {scenarios.map((scenario: typeof Scenarios.$inferSelect) => (
          <Card key={scenario.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(scenario.id)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteClick(scenario.id, scenario.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
        
        {scenarios.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No scenarios found. Create your first scenario to get started.
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scenario "{deleteItem?.name}". 
              This action cannot be undone.
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