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

import { usePersonaColumns } from "@/hooks/use-persona-columns";
import { deletePersona } from "@/utils/mutations/personas/delete-persona";
import { getPersonaConfig } from "@/utils/personas";
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

  const renderPersonaCard = (persona: Persona) => {
    const personaConfig = getPersonaConfig(persona.name);
    const IconComponent = personaConfig.icon;

    // Extract color from the iconColor class and create explicit color classes
    const colorMatch = personaConfig.colors.iconColor.match(/text-(\w+)-500/);
    const colorName = colorMatch?.[1] || "slate";

    // Explicit color mapping to ensure Tailwind recognizes the classes
    const getColorClasses = (color: string) => {
      switch (color) {
        case "blue":
          return { bg: "bg-blue-500", text: "text-blue-500" };
        case "green":
          return { bg: "bg-green-500", text: "text-green-500" };
        case "red":
          return { bg: "bg-red-500", text: "text-red-500" };
        case "yellow":
          return { bg: "bg-yellow-500", text: "text-yellow-500" };
        case "purple":
          return { bg: "bg-purple-500", text: "text-purple-500" };
        case "pink":
          return { bg: "bg-pink-500", text: "text-pink-500" };
        case "indigo":
          return { bg: "bg-indigo-500", text: "text-indigo-500" };
        case "orange":
          return { bg: "bg-orange-500", text: "text-orange-500" };
        case "emerald":
          return { bg: "bg-emerald-500", text: "text-emerald-500" };
        case "amber":
          return { bg: "bg-amber-500", text: "text-amber-500" };
        default:
          return { bg: "bg-slate-500", text: "text-slate-500" };
      }
    };

    const colors = getColorClasses(colorName);

    return (
      <Card key={persona.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${colors.bg} bg-opacity-10`}>
                  <IconComponent className={`h-4 w-4 ${colors.text}`} />
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
