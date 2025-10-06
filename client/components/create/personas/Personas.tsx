/**
 * Personas.tsx
 * Used to display the personas page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { log } from "@/utils/logger";
import { Brain, Copy, Edit, Eye, Thermometer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { usePersonaColumns } from "@/hooks/use-persona-columns";
import { getPersonaIconComponent } from "@/utils/persona-icons";

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
import {
  useCreatePersona,
  useDeletePersona,
  usePersonasByDepartmentId,
} from "@/lib/api/hooks/personas";
import { useScenariosByDepartmentId } from "@/lib/api/hooks/scenarios";
import { Persona } from "@/types";
import { PersonasDataTable } from "./PersonasDataTable";

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

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

  // Mutation hooks
  const createPersonaMutation = useCreatePersona();
  const deletePersonaMutation = useDeletePersona();

  const { data: personas = [] } = usePersonasByDepartmentId(
    effectiveProfile?.departmentId || ""
  );
  const { data: scenarios = [] } = useScenariosByDepartmentId(
    effectiveProfile?.departmentId || ""
  );

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

  // Only superadmins can edit default personas; admins/superadmins can edit non-default; others can edit non-default only if not in use
  const canEditPersona = (persona: Persona) => {
    const isAdmin =
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin";
    if (persona.defaultPersona) {
      return effectiveProfile?.role === "superadmin";
    }
    return isAdmin || !isPersonaInUse(persona.id);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      await deletePersonaMutation.mutateAsync(deleteItem.id);
      await log.info("persona.delete.success", {
        message: "Persona deleted successfully",
        subject: { entityType: "persona", entityId: deleteItem.id },
        context: {
          component: "Personas",
          function: "handleDelete",
          name: deleteItem.name,
        },
      });
      toast.success("Persona deleted successfully");
    } catch (error) {
      await log.error("persona.delete.failed", {
        message: "Error deleting persona",
        subject: { entityType: "persona", entityId: deleteItem?.id },
        context: { component: "Personas", function: "handleDelete" },
        error,
      });
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
      await createPersonaMutation.mutateAsync({
        ...persona,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        active: false,
        defaultPersona: false,
        name: `${persona.name} Copy`,
      });
      await log.info("persona.duplicate.success", {
        message: "Persona duplicated successfully",
        subject: { entityType: "persona", entityId: persona.id },
        context: {
          component: "Personas",
          function: "handleDuplicate",
          originalName: persona.name,
        },
      });
      toast.success(`Persona "${persona.name}" duplicated successfully`);
    } catch (error) {
      await log.error("persona.duplicate.failed", {
        message: "Error duplicating persona",
        subject: { entityType: "persona", entityId: persona.id },
        context: {
          component: "Personas",
          function: "handleDuplicate",
          originalName: persona.name,
        },
        error,
      });
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
    return temp.toFixed(2);
  };

  // no-op

  const renderPersonaCard = (persona: Persona) => {
    // Get the icon component from the persona's stored icon name
    const IconComponent = getPersonaIconComponent(persona.icon) || Brain;

    // Use the hex color directly with CSS custom properties
    const hexColor = persona.color || "#64748b"; // Default to slate if no color

    // Generate gradient from hex color
    const gradientStyle = generateGradientFromHex(hexColor);

    // Always use white icon for consistency with gradient backgrounds
    const iconColor = "#ffffff";

    return (
      <Card key={persona.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="p-2 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{
                    background: gradientStyle,
                  }}
                >
                  <IconComponent
                    className="h-4 w-4"
                    style={{ color: iconColor }}
                  />
                </div>
                <CardTitle className="text-lg">
                  {persona.name || "Unnamed Persona"}
                </CardTitle>
              </div>
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  {persona.reasoning && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-xs cursor-help"
                        >
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
                {!persona.active && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Inactive</Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {canEditPersona(persona) ? (
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
                disabled={
                  isDuplicating === persona.id ||
                  createPersonaMutation.isPending
                }
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
        <CardContent className="pt-0 flex-grow flex flex-col">
          <p className="text-sm text-muted-foreground line-clamp-2 flex-grow">
            {persona.description || "No description available"}
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {scenarios.filter((s) => s.personaId === persona.id).length}{" "}
            scenarios
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
                Are you sure you want to delete the persona "{deleteItem?.name}
                "? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={isDeleting || deletePersonaMutation.isPending}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting || deletePersonaMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting || deletePersonaMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
