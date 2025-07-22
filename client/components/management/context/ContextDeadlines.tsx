/**
 * ContextDeadlines.tsx
 * Context deadlines component with CRUD operations
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Edit, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import { ScenarioDeadline } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createScenarioDeadlines } from "@/utils/mutations/scenario_deadlines/create-scenario-deadlines";
import { deleteScenarioDeadline } from "@/utils/mutations/scenario_deadlines/delete-scenario-deadline";
import { updateScenarioDeadline } from "@/utils/mutations/scenario_deadlines/update-scenario-deadline";
import { getAllScenarioDeadlines } from "@/utils/queries/scenario_deadlines/get-all-scenario-deadlines";

interface EditableScenarioDeadline
  extends Omit<ScenarioDeadline, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export default function ContextDeadlines() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State management
  const [deadlines, setDeadlines] = useState<EditableScenarioDeadline[]>([]);
  const [originalDeadlines, setOriginalDeadlines] = useState<
    EditableScenarioDeadline[]
  >([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    deadline: string;
  } | null>(null);
  const [newDeadline, setNewDeadline] = useState<EditableScenarioDeadline>({
    deadline: "",
    description: "",
    isNew: true,
  });

  // Fetch data
  const { data: fetchedDeadlines = [], isLoading } = useQuery({
    queryKey: ["scenario-deadlines"],
    queryFn: () => getAllScenarioDeadlines(),
  });

  // Initialize data when fetched
  useState(() => {
    if (fetchedDeadlines.length > 0 && deadlines.length === 0) {
      const editableData = fetchedDeadlines.map((item) => ({
        ...item,
        isEditing: false,
      }));
      setDeadlines(editableData);
      setOriginalDeadlines(editableData);
      setHasChanges(false);
    }
  });

  const handleAddNew = () => {
    if (newDeadline.deadline.trim()) {
      const newItem: EditableScenarioDeadline = {
        ...newDeadline,
        id: `temp-${Date.now()}`,
        isNew: true,
        isEditing: false,
      };
      setDeadlines([...deadlines, newItem]);
      setHasChanges(true);
      setNewDeadline({
        deadline: "",
        description: "",
        isNew: true,
      });
      setShowAddDialog(false);
      toast.success("Deadline added. Remember to save changes.");
    }
  };

  const handleEdit = (id: string) => {
    setDeadlines(
      deadlines.map((item) =>
        item.id === id
          ? { ...item, isEditing: true }
          : { ...item, isEditing: false }
      )
    );
  };

  const handleSaveEdit = (
    id: string,
    updatedData: Partial<EditableScenarioDeadline>
  ) => {
    setDeadlines(
      deadlines.map((item) =>
        item.id === id ? { ...item, ...updatedData, isEditing: false } : item
      )
    );
    setHasChanges(true);
  };

  const handleCancelEdit = (id: string) => {
    const original = originalDeadlines.find((item) => item.id === id);
    if (original) {
      setDeadlines(
        deadlines.map((item) =>
          item.id === id ? { ...original, isEditing: false } : item
        )
      );
    } else {
      setDeadlines(
        deadlines.map((item) =>
          item.id === id ? { ...item, isEditing: false } : item
        )
      );
    }
  };

  const handleDeleteClick = (id: string, deadline: string) => {
    setDeleteItem({ id, deadline });
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!deleteItem) return;

    setDeadlines(deadlines.filter((item) => item.id !== deleteItem.id));
    setHasChanges(true);
    setShowDeleteDialog(false);
    setDeleteItem(null);
    toast.success("Deadline removed. Remember to save changes.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Separate new items from existing items
      const newItems = deadlines.filter(
        (item) => item.isNew && item.id?.startsWith("temp-")
      );
      const existingItems = deadlines.filter((item) => !item.isNew);
      const originalIds = originalDeadlines.map((item) => item.id);
      const currentIds = existingItems.map((item) => item.id);
      const deletedIds = originalIds.filter((id) => !currentIds.includes(id));

      // Create new items
      if (newItems.length > 0) {
        const newItemsData = newItems.map(
          ({ id: _id, isNew: _isNew, isEditing: _isEditing, ...item }) => item
        );
        await createScenarioDeadlines(newItemsData);
        logInfo("Created new scenario deadlines:", { count: newItems.length });
      }

      // Update existing items
      for (const item of existingItems) {
        const original = originalDeadlines.find((orig) => orig.id === item.id);
        if (
          original &&
          (original.deadline !== item.deadline ||
            original.description !== item.description)
        ) {
          const {
            id,
            isNew: _isNew,
            isEditing: _isEditing,
            ...updateData
          } = item;
          await updateScenarioDeadline(id!, updateData);
          logInfo("Updated scenario deadline:", {
            id,
            deadline: item.deadline,
          });
        }
      }

      // Delete removed items
      for (const id of deletedIds) {
        if (id) {
          await deleteScenarioDeadline(id);
          logInfo("Deleted scenario deadline:", { id });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["scenario-deadlines"] });
      toast.success("Changes saved successfully");
      setHasChanges(false);
    } catch (error) {
      logError("Error saving scenario deadlines:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDeadlines([...originalDeadlines]);
    setHasChanges(false);
    toast.info("Changes cancelled");
  };

  const renderDeadlineCard = (deadlineItem: EditableScenarioDeadline) => {
    const isEditing = deadlineItem.isEditing;

    return (
      <Card key={deadlineItem.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <EditForm
                  deadlineItem={deadlineItem}
                  onSave={(data) => handleSaveEdit(deadlineItem.id!, data)}
                  onCancel={() => handleCancelEdit(deadlineItem.id!)}
                />
              ) : (
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {deadlineItem.deadline}
                </CardTitle>
              )}
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(deadlineItem.id!)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    handleDeleteClick(deadlineItem.id!, deadlineItem.deadline)
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {!isEditing && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              {deadlineItem.description || "No description"}
            </p>
          </CardContent>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scenario Deadlines</h1>
          <p className="text-muted-foreground">
            Manage deadlines for scenario contexts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/management/context")}
          >
            <X className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddDialog(true)}
            disabled={isSaving}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Deadline
          </Button>
          {hasChanges && (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deadlines.map(renderDeadlineCard)}
        {deadlines.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No deadlines yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first scenario deadline to get started
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Deadline
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Deadline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                value={newDeadline.deadline}
                onChange={(e) =>
                  setNewDeadline({ ...newDeadline, deadline: e.target.value })
                }
                placeholder="e.g., End of Semester, December 31st, Final Exam Week"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDeadline.description}
                onChange={(e) =>
                  setNewDeadline({
                    ...newDeadline,
                    description: e.target.value,
                  })
                }
                placeholder="Description of the deadline..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={!newDeadline.deadline.trim()}
              >
                Add Deadline
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deadline</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.deadline}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface EditFormProps {
  deadlineItem: EditableScenarioDeadline;
  onSave: (data: Partial<EditableScenarioDeadline>) => void;
  onCancel: () => void;
}

function EditForm({ deadlineItem, onSave, onCancel }: EditFormProps) {
  const [deadline, setDeadline] = useState(deadlineItem.deadline);
  const [description, setDescription] = useState(deadlineItem.description);

  const handleSave = () => {
    if (deadline.trim()) {
      onSave({ deadline, description });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Input
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          placeholder="Deadline"
          className="font-medium"
        />
      </div>
      <div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!deadline.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
