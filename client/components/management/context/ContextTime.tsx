/**
 * ContextTime.tsx
 * Context time component with CRUD operations
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Edit, Plus, Save, Trash2, X } from "lucide-react";
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

import { ScenarioTime } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createScenarioTimes } from "@/utils/mutations/scenario_times/create-scenario-times";
import { deleteScenarioTime } from "@/utils/mutations/scenario_times/delete-scenario-time";
import { updateScenarioTime } from "@/utils/mutations/scenario_times/update-scenario-time";
import { getAllScenarioTimes } from "@/utils/queries/scenario_times/get-all-scenario-times";

interface EditableScenarioTime
  extends Omit<ScenarioTime, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export default function ContextTime() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State management
  const [times, setTimes] = useState<EditableScenarioTime[]>([]);
  const [originalTimes, setOriginalTimes] = useState<EditableScenarioTime[]>(
    []
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    timeOfDay: string;
  } | null>(null);
  const [newTime, setNewTime] = useState<EditableScenarioTime>({
    timeOfDay: "",
    description: "",
    isNew: true,
  });

  // Fetch data
  const { data: fetchedTimes = [], isLoading } = useQuery({
    queryKey: ["scenario-times"],
    queryFn: () => getAllScenarioTimes(),
  });

  // Initialize data when fetched
  useState(() => {
    if (fetchedTimes.length > 0 && times.length === 0) {
      const editableData = fetchedTimes.map((item) => ({
        ...item,
        isEditing: false,
      }));
      setTimes(editableData);
      setOriginalTimes(editableData);
      setHasChanges(false);
    }
  });

  const formatTime = (timeString: string) => {
    try {
      const time = new Date(`1970-01-01T${timeString}`);
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  const handleAddNew = () => {
    if (newTime.timeOfDay.trim()) {
      const newItem: EditableScenarioTime = {
        ...newTime,
        id: `temp-${Date.now()}`,
        isNew: true,
        isEditing: false,
      };
      setTimes([...times, newItem]);
      setHasChanges(true);
      setNewTime({
        timeOfDay: "",
        description: "",
        isNew: true,
      });
      setShowAddDialog(false);
      toast.success("Time added. Remember to save changes.");
    }
  };

  const handleEdit = (id: string) => {
    setTimes(
      times.map((item) =>
        item.id === id
          ? { ...item, isEditing: true }
          : { ...item, isEditing: false }
      )
    );
  };

  const handleSaveEdit = (
    id: string,
    updatedData: Partial<EditableScenarioTime>
  ) => {
    setTimes(
      times.map((item) =>
        item.id === id ? { ...item, ...updatedData, isEditing: false } : item
      )
    );
    setHasChanges(true);
  };

  const handleCancelEdit = (id: string) => {
    const original = originalTimes.find((item) => item.id === id);
    if (original) {
      setTimes(
        times.map((item) =>
          item.id === id ? { ...original, isEditing: false } : item
        )
      );
    } else {
      setTimes(
        times.map((item) =>
          item.id === id ? { ...item, isEditing: false } : item
        )
      );
    }
  };

  const handleDeleteClick = (id: string, timeOfDay: string) => {
    setDeleteItem({ id, timeOfDay });
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!deleteItem) return;

    setTimes(times.filter((item) => item.id !== deleteItem.id));
    setHasChanges(true);
    setShowDeleteDialog(false);
    setDeleteItem(null);
    toast.success("Time removed. Remember to save changes.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Separate new items from existing items
      const newItems = times.filter(
        (item) => item.isNew && item.id?.startsWith("temp-")
      );
      const existingItems = times.filter((item) => !item.isNew);
      const originalIds = originalTimes.map((item) => item.id);
      const currentIds = existingItems.map((item) => item.id);
      const deletedIds = originalIds.filter((id) => !currentIds.includes(id));

      // Create new items
      if (newItems.length > 0) {
        const newItemsData = newItems.map(
          ({ id: _id, isNew: _isNew, isEditing: _isEditing, ...item }) => item
        );
        await createScenarioTimes(newItemsData);
        logInfo("Created new scenario times:", { count: newItems.length });
      }

      // Update existing items
      for (const item of existingItems) {
        const original = originalTimes.find((orig) => orig.id === item.id);
        if (
          original &&
          (original.timeOfDay !== item.timeOfDay ||
            original.description !== item.description)
        ) {
          const {
            id,
            isNew: _isNew,
            isEditing: _isEditing,
            ...updateData
          } = item;
          await updateScenarioTime(id!, updateData);
          logInfo("Updated scenario time:", { id, timeOfDay: item.timeOfDay });
        }
      }

      // Delete removed items
      for (const id of deletedIds) {
        if (id) {
          await deleteScenarioTime(id);
          logInfo("Deleted scenario time:", { id });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["scenario-times"] });
      toast.success("Changes saved successfully");
      setHasChanges(false);
    } catch (error) {
      logError("Error saving scenario times:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTimes([...originalTimes]);
    setHasChanges(false);
    toast.info("Changes cancelled");
  };

  const renderTimeCard = (timeItem: EditableScenarioTime) => {
    const isEditing = timeItem.isEditing;

    return (
      <Card key={timeItem.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <EditForm
                  timeItem={timeItem}
                  onSave={(data) => handleSaveEdit(timeItem.id!, data)}
                  onCancel={() => handleCancelEdit(timeItem.id!)}
                />
              ) : (
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {formatTime(timeItem.timeOfDay)}
                </CardTitle>
              )}
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(timeItem.id!)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    handleDeleteClick(timeItem.id!, timeItem.timeOfDay)
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
              {timeItem.description || "No description"}
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
          <h1 className="text-2xl font-bold">Scenario Times</h1>
          <p className="text-muted-foreground">
            Manage times for scenario contexts
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
            Add Time
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
        {times.map(renderTimeCard)}
        {times.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No times yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first scenario time to get started
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Time
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
            <DialogTitle>Add New Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="timeOfDay">Time of Day</Label>
              <Input
                id="timeOfDay"
                type="time"
                value={newTime.timeOfDay}
                onChange={(e) =>
                  setNewTime({ ...newTime, timeOfDay: e.target.value })
                }
                placeholder="HH:MM"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use 24-hour format (e.g., 14:30 for 2:30 PM)
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTime.description}
                onChange={(e) =>
                  setNewTime({ ...newTime, description: e.target.value })
                }
                placeholder="Description of the time period..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={!newTime.timeOfDay.trim()}
              >
                Add Time
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "
              {deleteItem?.timeOfDay && formatTime(deleteItem.timeOfDay)}"? This
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
  timeItem: EditableScenarioTime;
  onSave: (data: Partial<EditableScenarioTime>) => void;
  onCancel: () => void;
}

function EditForm({ timeItem, onSave, onCancel }: EditFormProps) {
  const [timeOfDay, setTimeOfDay] = useState(timeItem.timeOfDay);
  const [description, setDescription] = useState(timeItem.description);

  const handleSave = () => {
    if (timeOfDay.trim()) {
      onSave({ timeOfDay, description });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Input
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          placeholder="Time"
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
        <Button size="sm" onClick={handleSave} disabled={!timeOfDay.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
