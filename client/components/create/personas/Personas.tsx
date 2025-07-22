/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { Brain, Copy, Edit, Thermometer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deletePersona } from "@/utils/mutations/personas/delete-persona";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";

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
import { useProfile } from "@/contexts/profile-context";
import { Persona } from "@/types";
import { createPersona } from "@/utils/mutations/personas/create-persona";

export default function Personas() {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const { effectiveProfile } = useProfile();

  // Fetch personas data
  const { data: personas = [], refetch: refetchPersonas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  // Fetch scenarios data to check for dependencies
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Check if a persona is being used by any scenarios
  const isPersonaInUse = (personaId: string) => {
    return scenarios.some((scenario) => scenario.personaId === personaId);
  };

  // Check if user can edit (admin/superadmin or persona not in use)
  const canEditPersona = (personaId: string) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    return isAdmin || !isPersonaInUse(personaId);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deletePersona(deleteItem.id);
      logInfo("Persona deleted successfully:", {
        id: deleteItem.id,
        name: deleteItem.name,
      });
      toast.success("Persona deleted successfully");
      refetchPersonas();
    } catch (error) {
      logError("Error deleting persona:", error);
      toast.error("Failed to delete persona");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setDeleteItem(null);
    }
  };

  const handleDuplicate = async (persona: Persona) => {
    setIsDuplicating(persona.id);
    try {
      await createPersona({
        ...persona,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        defaultPersona: false,
        name: `${persona.name} Copy`,
      });
      logInfo("Persona duplicated successfully:", {
        originalId: persona.id,
        originalName: persona.name,
      });
      toast.success(`Persona "${persona.name}" duplicated successfully`);
      refetchPersonas();
    } catch (error) {
      logError("Error duplicating persona:", error);
      toast.error("Failed to duplicate persona");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteItem({ id, name });
    setShowDeleteDialog(true);
  };

  const handleEdit = (id: string) => {
    router.push(`/create/personas/p/${id}`);
  };

  const formatTemperature = (temp: number) => {
    return (temp / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderPersonaCard = (persona: Persona) => (
    <Card key={persona.id} className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {persona.name || "Unnamed Persona"}
              </CardTitle>
              <div className="flex gap-1">
                {persona.reasoning && (
                  <Badge variant="outline" className="text-xs">
                    <Brain className="h-3 w-3 mr-1" />
                    {persona.reasoning}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {formatTemperature(persona.temperature)}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {persona.description || "No description available"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {persona.defaultPersona && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(persona)}
                disabled={isDuplicating === persona.id}
              >
                <Copy className="h-4 w-4" />
                {isDuplicating === persona.id ? "..." : ""}
              </Button>
            )}
            {canEditPersona(persona.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(persona.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {!isPersonaInUse(persona.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDeleteClick(
                    persona.id,
                    persona.name || "Unnamed Persona"
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium ml-2">
            {formatDate(persona.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="grid gap-4">
          {personas
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map(renderPersonaCard)}
          {personas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No personas found. Create your first persona to get started.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Persona</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                Are you sure you want to delete the persona "{deleteItem?.name}
                "? This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
