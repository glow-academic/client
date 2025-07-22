/**
 * ContextLocations.tsx
 * Context locations component with CRUD operations
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, MapPin, Plus, Save, Trash2, X } from "lucide-react";
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

import { ScenarioLocation } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createScenarioLocations } from "@/utils/mutations/scenario_locations/create-scenario-locations";
import { deleteScenarioLocation } from "@/utils/mutations/scenario_locations/delete-scenario-location";
import { updateScenarioLocation } from "@/utils/mutations/scenario_locations/update-scenario-location";
import { getAllScenarioLocations } from "@/utils/queries/scenario_locations/get-all-scenario-locations";

interface EditableScenarioLocation
  extends Omit<ScenarioLocation, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export default function ContextLocations() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State management
  const [locations, setLocations] = useState<EditableScenarioLocation[]>([]);
  const [originalLocations, setOriginalLocations] = useState<
    EditableScenarioLocation[]
  >([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newLocation, setNewLocation] = useState<EditableScenarioLocation>({
    name: "",
    description: "",
    isNew: true,
  });

  // Fetch data
  const { data: fetchedLocations = [], isLoading } = useQuery({
    queryKey: ["scenario-locations"],
    queryFn: () => getAllScenarioLocations(),
  });

  // Initialize data when fetched
  useState(() => {
    if (fetchedLocations.length > 0 && locations.length === 0) {
      const editableData = fetchedLocations.map((item) => ({
        ...item,
        isEditing: false,
      }));
      setLocations(editableData);
      setOriginalLocations(editableData);
      setHasChanges(false);
    }
  });

  const handleAddNew = () => {
    if (newLocation.name.trim()) {
      const newItem: EditableScenarioLocation = {
        ...newLocation,
        id: `temp-${Date.now()}`,
        isNew: true,
        isEditing: false,
      };
      setLocations([...locations, newItem]);
      setHasChanges(true);
      setNewLocation({
        name: "",
        description: "",
        isNew: true,
      });
      setShowAddDialog(false);
      toast.success("Location added. Remember to save changes.");
    }
  };

  const handleEdit = (id: string) => {
    setLocations(
      locations.map((item) =>
        item.id === id
          ? { ...item, isEditing: true }
          : { ...item, isEditing: false }
      )
    );
  };

  const handleSaveEdit = (
    id: string,
    updatedData: Partial<EditableScenarioLocation>
  ) => {
    setLocations(
      locations.map((item) =>
        item.id === id ? { ...item, ...updatedData, isEditing: false } : item
      )
    );
    setHasChanges(true);
  };

  const handleCancelEdit = (id: string) => {
    const original = originalLocations.find((item) => item.id === id);
    if (original) {
      setLocations(
        locations.map((item) =>
          item.id === id ? { ...original, isEditing: false } : item
        )
      );
    } else {
      setLocations(
        locations.map((item) =>
          item.id === id ? { ...item, isEditing: false } : item
        )
      );
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!deleteItem) return;

    setLocations(locations.filter((item) => item.id !== deleteItem.id));
    setHasChanges(true);
    setShowDeleteDialog(false);
    setDeleteItem(null);
    toast.success("Location removed. Remember to save changes.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Separate new items from existing items
      const newItems = locations.filter(
        (item) => item.isNew && item.id?.startsWith("temp-")
      );
      const existingItems = locations.filter((item) => !item.isNew);
      const originalIds = originalLocations.map((item) => item.id);
      const currentIds = existingItems.map((item) => item.id);
      const deletedIds = originalIds.filter((id) => !currentIds.includes(id));

      // Create new items
      if (newItems.length > 0) {
        const newItemsData = newItems.map(
          ({ id: _id, isNew: _isNew, isEditing: _isEditing, ...item }) => item
        );
        await createScenarioLocations(newItemsData);
        logInfo("Created new scenario locations:", { count: newItems.length });
      }

      // Update existing items
      for (const item of existingItems) {
        const original = originalLocations.find((orig) => orig.id === item.id);
        if (
          original &&
          (original.name !== item.name ||
            original.description !== item.description)
        ) {
          const {
            id,
            isNew: _isNew,
            isEditing: _isEditing,
            ...updateData
          } = item;
          await updateScenarioLocation(id!, updateData);
          logInfo("Updated scenario location:", { id, name: item.name });
        }
      }

      // Delete removed items
      for (const id of deletedIds) {
        if (id) {
          await deleteScenarioLocation(id);
          logInfo("Deleted scenario location:", { id });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["scenario-locations"] });
      toast.success("Changes saved successfully");
      setHasChanges(false);
    } catch (error) {
      logError("Error saving scenario locations:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLocations([...originalLocations]);
    setHasChanges(false);
    toast.info("Changes cancelled");
  };

  const renderLocationCard = (locationItem: EditableScenarioLocation) => {
    const isEditing = locationItem.isEditing;

    return (
      <Card key={locationItem.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <EditForm
                  locationItem={locationItem}
                  onSave={(data) => handleSaveEdit(locationItem.id!, data)}
                  onCancel={() => handleCancelEdit(locationItem.id!)}
                />
              ) : (
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {locationItem.name}
                </CardTitle>
              )}
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(locationItem.id!)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    handleDeleteClick(locationItem.id!, locationItem.name)
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
              {locationItem.description || "No description"}
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
          <h1 className="text-2xl font-bold">Scenario Locations</h1>
          <p className="text-muted-foreground">
            Manage locations for scenario contexts
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
            Add Location
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
        {locations.map(renderLocationCard)}
        {locations.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No locations yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first scenario location to get started
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Location
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
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                value={newLocation.name}
                onChange={(e) =>
                  setNewLocation({ ...newLocation, name: e.target.value })
                }
                placeholder="e.g., Library, Classroom 101"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newLocation.description}
                onChange={(e) =>
                  setNewLocation({
                    ...newLocation,
                    description: e.target.value,
                  })
                }
                placeholder="Description of the location..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={!newLocation.name.trim()}
              >
                Add Location
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"? This action
              cannot be undone.
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
  locationItem: EditableScenarioLocation;
  onSave: (data: Partial<EditableScenarioLocation>) => void;
  onCancel: () => void;
}

function EditForm({ locationItem, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(locationItem.name);
  const [description, setDescription] = useState(locationItem.description);

  const handleSave = () => {
    if (name.trim()) {
      onSave({ name, description });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Location name"
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
        <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}
