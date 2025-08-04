/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { Brain, Copy, Edit, Eye, Thermometer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { usePersonaColumns } from "@/hooks/use-persona-columns";
import { deletePersona } from "@/utils/mutations/personas/delete-persona";
import { getPersonaIconComponent } from "@/utils/persona-icons";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { Persona } from "@/types";
import { createPersona } from "@/utils/mutations/personas/create-persona";
import { PersonasDataTable } from "./PersonasDataTable";

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

  // Get table columns and filter options
  const {
    columns,
    scenarioOptions,
    reasoningOptions,
    modelOptions,
    temperatureOptions,
  } = usePersonaColumns();

  // Check if a persona is being used by any scenarios
  const isPersonaInUse = (personaId: string) => {
    return scenarios.some((scenario) => scenario.personaId === personaId);
  };

  // Check if user can edit (superadmin can edit all, others can only edit non-default personas not in use)
  const canEditPersona = (personaId: string) => {
    const isSuperAdmin = effectiveProfile?.role === "superadmin";
    const persona = personas.find((p) => p.id === personaId);

    // Superadmin can edit all personas
    if (isSuperAdmin) {
      return true;
    }

    // Non-superadmin users can only edit non-default personas that are not in use
    return persona && !persona.defaultPersona && !isPersonaInUse(personaId);
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
        active: false,
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

  const handleView = (id: string) => {
    router.push(`/create/personas/p/${id}`);
  };

  const formatTemperature = (temp: number) => {
    return (temp / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderPersonaCard = (persona: Persona) => {
    // Get the icon component from the persona's stored icon name
    const IconComponent = getPersonaIconComponent(persona.icon) || Brain;

    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color

    // Function to determine if a color is light or dark
    const isLightColor = (hex: string) => {
      // Remove # if present
      const cleanHex = hex.replace("#", "");

      // Convert to RGB
      const r = parseInt(cleanHex.substr(0, 2), 16);
      const g = parseInt(cleanHex.substr(2, 2), 16);
      const b = parseInt(cleanHex.substr(4, 2), 16);

      // Calculate luminance (perceived brightness)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Return true if light (luminance > 0.5), false if dark
      return luminance > 0.5;
    };

    // Choose icon color based on background brightness
    const iconColor = isLightColor(hexColor) ? "#000000" : "#ffffff";

    return (
      <Card key={persona.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: hexColor,
                  }}
                >
                  <IconComponent
                    className="h-4 w-4"
                    style={{ color: iconColor }}
                  />
                </div>
                <CardTitle className="text-base">
                  {persona.name || "Unnamed Persona"}
                </CardTitle>
              </div>
              <div className="flex gap-1">
                {persona.reasoning && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help">
                        <Brain className="h-3 w-3 mr-1" />
                        {persona.reasoning}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reasoning Level</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-help">
                      <Thermometer className="h-3 w-3 mr-1" />
                      {formatTemperature(persona.temperature)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Randomness Level</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-sm text-muted-foreground">
                {persona.description || "No description available"}
              </p>
            </div>
            <div className="flex gap-2 items-center">
              {canEditPersona(persona.id) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(persona.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(persona.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Persona Details</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDuplicate(persona)}
                disabled={isDuplicating === persona.id}
              >
                <Copy className="h-4 w-4" />
                {isDuplicating === persona.id ? "..." : ""}
              </Button>
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
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PersonasDataTable
          columns={columns}
          data={personas}
          scenarios={scenarios}
          scenarioOptions={scenarioOptions}
          reasoningOptions={reasoningOptions}
          modelOptions={modelOptions}
          temperatureOptions={temperatureOptions}
          renderPersonaCard={renderPersonaCard}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Persona</AlertDialogTitle>
              <AlertDialogDescription>
                <p>
                  Are you sure you want to delete the persona "
                  {deleteItem?.name}
                  "? This action cannot be undone.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
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
    </TooltipProvider>
  );
}
