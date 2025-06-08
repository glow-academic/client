/**
 * components/admin/simulations-content.tsx
 * Simulations management component
 */
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit, Trash2, Timer, Users, FileText } from "lucide-react";

import { getSimulations } from "@/utils/queries/get-simulations";
import { deleteSimulation } from "@/utils/mutations/delete-simulation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
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
import { simulations as Simulations } from "@/drizzle/schema";

export function SimulationsContent() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch simulations data
  const { data: simulations = [], refetch: refetchSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getSimulations(),
  });

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      const result = await deleteSimulation(deleteItem.id);

      if (result.success) {
        toast.success("Simulation deleted successfully");
        refetchSimulations();
      } else {
        toast.error(result.error || "Failed to delete simulation");
      }
    } catch (error) {
      console.error("Error deleting simulation:", error);
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
    router.push(`/simulations/s/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {simulations.map((simulation: typeof Simulations.$inferSelect) => (
          <Card key={simulation.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{simulation.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Timer className="h-3 w-3" />
                    {simulation.timeLimit} minutes
                  </CardDescription>
                </div>
                <Badge variant={simulation.active ? "default" : "secondary"}>
                  {simulation.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {simulation.interactionIds?.length || 0} interactions
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {simulation.documents?.length || 0} documents
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEdit(simulation.id)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleDeleteClick(simulation.id, simulation.title)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
        
        {simulations.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No simulations found. Create your first simulation to get started.
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the simulation "{deleteItem?.name}". 
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