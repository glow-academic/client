/**
 * Providers.tsx
 * Used to display the models page with all created models and management functionality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { logError } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Edit, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteModel } from "@/utils/mutations/models/delete-model";
import { getAllModels } from "@/utils/queries/models/get-all-models";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useProviderColumns } from "@/hooks/use-provider-columns";
import { Model } from "@/types";
import { ProvidersDataTable } from "./ProvidersDataTable";

export default function Providers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch models data
  const { data: models = [], refetch: refetchModels } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels(),
  });

  // Get table columns and filter options
  const { columns, providerOptions, customModelOptions, statusOptions } =
    useProviderColumns();

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deleteModel(deleteItem.id);

      toast.success("Model deleted successfully");
      // Invalidate queries to ensure all components refresh
      queryClient.invalidateQueries({ queryKey: ["models"] });
      refetchModels();
    } catch (error) {
      logError("Error deleting model:", error);
      toast.error("Failed to delete model");
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
    router.push(`/system/providers/p/${id}/m/${id}`);
  };

  const renderModelCard = (model: Model) => {
    return (
      <Card key={model.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                {model.name}
              </CardTitle>
              <CardDescription className="text-xs line-clamp-2">
                {model.description}
              </CardDescription>
            </div>
            <Badge variant={model.active ? "default" : "secondary"}>
              {model.active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(model.id)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteClick(model.id, model.name)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <div className="col-span-full">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No models yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first model to get started
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {models.length === 0 ? (
        renderEmptyState()
      ) : (
        <ProvidersDataTable
          columns={columns}
          data={models}
          providerOptions={providerOptions}
          customModelOptions={customModelOptions}
          statusOptions={statusOptions}
          renderModelCard={renderModelCard}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the model "{deleteItem?.name}". This
              action cannot be undone.
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
