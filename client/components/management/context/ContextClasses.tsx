/**
 * ContextClasses.tsx
 * Context classes component with CRUD operations
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Book, Edit, Plus, Save, Trash2, X } from "lucide-react";
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

import { ScenarioClasse } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { createScenarioClasses } from "@/utils/mutations/scenario_classes/create-scenario-classes";
import { deleteScenarioClass } from "@/utils/mutations/scenario_classes/delete-scenario-class";
import { updateScenarioClass } from "@/utils/mutations/scenario_classes/update-scenario-class";
import { getAllScenarioClasses } from "@/utils/queries/scenario_classes/get-all-scenario-classes";

interface EditableScenarioClass
  extends Omit<ScenarioClasse, "id" | "createdAt" | "updatedAt"> {
  id?: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export default function ContextClasses() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // State management
  const [classes, setClasses] = useState<EditableScenarioClass[]>([]);
  const [originalClasses, setOriginalClasses] = useState<
    EditableScenarioClass[]
  >([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newClass, setNewClass] = useState<EditableScenarioClass>({
    name: "",
    classCode: "",
    description: "",
    isNew: true,
  });

  // Fetch data
  const { data: fetchedClasses = [], isLoading } = useQuery({
    queryKey: ["scenario-classes"],
    queryFn: () => getAllScenarioClasses(),
  });

  // Initialize data when fetched
  useState(() => {
    if (fetchedClasses.length > 0 && classes.length === 0) {
      const editableData = fetchedClasses.map((item) => ({
        ...item,
        isEditing: false,
      }));
      setClasses(editableData);
      setOriginalClasses(editableData);
      setHasChanges(false);
    }
  });

  const handleAddNew = () => {
    if (newClass.name.trim() && newClass.classCode.trim()) {
      const newItem: EditableScenarioClass = {
        ...newClass,
        id: `temp-${Date.now()}`,
        isNew: true,
        isEditing: false,
      };
      setClasses([...classes, newItem]);
      setHasChanges(true);
      setNewClass({
        name: "",
        classCode: "",
        description: "",
        isNew: true,
      });
      setShowAddDialog(false);
      toast.success("Class added. Remember to save changes.");
    }
  };

  const handleEdit = (id: string) => {
    setClasses(
      classes.map((item) =>
        item.id === id
          ? { ...item, isEditing: true }
          : { ...item, isEditing: false }
      )
    );
  };

  const handleSaveEdit = (
    id: string,
    updatedData: Partial<EditableScenarioClass>
  ) => {
    setClasses(
      classes.map((item) =>
        item.id === id ? { ...item, ...updatedData, isEditing: false } : item
      )
    );
    setHasChanges(true);
  };

  const handleCancelEdit = (id: string) => {
    const original = originalClasses.find((item) => item.id === id);
    if (original) {
      setClasses(
        classes.map((item) =>
          item.id === id ? { ...original, isEditing: false } : item
        )
      );
    } else {
      setClasses(
        classes.map((item) =>
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

    setClasses(classes.filter((item) => item.id !== deleteItem.id));
    setHasChanges(true);
    setShowDeleteDialog(false);
    setDeleteItem(null);
    toast.success("Class removed. Remember to save changes.");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Separate new items from existing items
      const newItems = classes.filter(
        (item) => item.isNew && item.id?.startsWith("temp-")
      );
      const existingItems = classes.filter((item) => !item.isNew);
      const originalIds = originalClasses.map((item) => item.id);
      const currentIds = existingItems.map((item) => item.id);
      const deletedIds = originalIds.filter((id) => !currentIds.includes(id));

      // Create new items
      if (newItems.length > 0) {
        const newItemsData = newItems.map(
          ({ id: _id, isNew: _isNew, isEditing: _isEditing, ...item }) => item
        );
        await createScenarioClasses(newItemsData);
        logInfo("Created new scenario classes:", { count: newItems.length });
      }

      // Update existing items
      for (const item of existingItems) {
        const original = originalClasses.find((orig) => orig.id === item.id);
        if (
          original &&
          (original.name !== item.name ||
            original.classCode !== item.classCode ||
            original.description !== item.description)
        ) {
          const {
            id,
            isNew: _isNew,
            isEditing: _isEditing,
            ...updateData
          } = item;
          await updateScenarioClass(id!, updateData);
          logInfo("Updated scenario class:", { id, name: item.name });
        }
      }

      // Delete removed items
      for (const id of deletedIds) {
        if (id) {
          await deleteScenarioClass(id);
          logInfo("Deleted scenario class:", { id });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["scenario-classes"] });
      toast.success("Changes saved successfully");
      setHasChanges(false);
    } catch (error) {
      logError("Error saving scenario classes:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setClasses([...originalClasses]);
    setHasChanges(false);
    toast.info("Changes cancelled");
  };

  const renderClassCard = (classItem: EditableScenarioClass) => {
    const isEditing = classItem.isEditing;

    return (
      <Card key={classItem.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <EditForm
                  classItem={classItem}
                  onSave={(data) => handleSaveEdit(classItem.id!, data)}
                  onCancel={() => handleCancelEdit(classItem.id!)}
                />
              ) : (
                <>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Book className="h-5 w-5" />
                    {classItem.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {classItem.classCode}
                  </p>
                </>
              )}
            </div>
            {!isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(classItem.id!)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    handleDeleteClick(classItem.id!, classItem.name)
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
              {classItem.description || "No description"}
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
          <h1 className="text-2xl font-bold">Scenario Classes</h1>
          <p className="text-muted-foreground">
            Manage classes for scenario contexts
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
            Add Class
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
        {classes.map(renderClassCard)}
        {classes.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Book className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No classes yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first scenario class to get started
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Class
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
            <DialogTitle>Add New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Class Name</Label>
              <Input
                id="name"
                value={newClass.name}
                onChange={(e) =>
                  setNewClass({ ...newClass, name: e.target.value })
                }
                placeholder="e.g., Computer Science 101"
              />
            </div>
            <div>
              <Label htmlFor="classCode">Class Code</Label>
              <Input
                id="classCode"
                value={newClass.classCode}
                onChange={(e) =>
                  setNewClass({ ...newClass, classCode: e.target.value })
                }
                placeholder="e.g., CS101"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newClass.description}
                onChange={(e) =>
                  setNewClass({ ...newClass, description: e.target.value })
                }
                placeholder="Description of the class..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNew}
                disabled={!newClass.name.trim() || !newClass.classCode.trim()}
              >
                Add Class
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
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
  classItem: EditableScenarioClass;
  onSave: (data: Partial<EditableScenarioClass>) => void;
  onCancel: () => void;
}

function EditForm({ classItem, onSave, onCancel }: EditFormProps) {
  const [name, setName] = useState(classItem.name);
  const [classCode, setClassCode] = useState(classItem.classCode);
  const [description, setDescription] = useState(classItem.description);

  const handleSave = () => {
    if (name.trim() && classCode.trim()) {
      onSave({ name, classCode, description });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Class name"
          className="font-medium"
        />
      </div>
      <div>
        <Input
          value={classCode}
          onChange={(e) => setClassCode(e.target.value)}
          placeholder="Class code"
          className="text-sm"
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
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!name.trim() || !classCode.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
