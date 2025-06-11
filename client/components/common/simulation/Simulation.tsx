/**
 * Simulation.tsx
 * Used to create and manage simulations for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Trash2,
  Edit,
  FileText,
  Clock,
  Shuffle,
  GripVertical,
  MessageSquare,
} from "lucide-react";
import { Document, Scenario } from "@/types";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { createSimulation } from "@/utils/mutations/simulations/create-simulation";
import { updateSimulation } from "@/utils/mutations/simulations/update-simulation";
import { deleteSimulation } from "@/utils/mutations/simulations/delete-simulation";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";

interface SimulationProps {
  mode?: "list" | "create";
  simulationId?: string;
}

interface SimulationFormData {
  title: string;
  timeLimit: number | null;
  scenarioIds: string[];
  active: boolean;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  scenarios?: string;
}

export default function Simulation({
  mode = "create",
  simulationId,
}: SimulationProps) {
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [simulationToDelete, setSimulationToDelete] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(
    null,
  );
  const [draggedScenario, setDraggedScenario] = useState<string | null>(null);

  const initialFormData: SimulationFormData = {
    title: "",
    timeLimit: 15,
    scenarioIds: [],
    active: true,
  };

  const [formData, setFormData] = useState<SimulationFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => getAllDocuments(),
  });

  // Fetch simulations for the list mode
  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Load simulation data if editing
  useEffect(() => {
    const targetSimulationId = simulationId || editingSimulationId;
    if (targetSimulationId) {
      const simulationToEdit = simulations.find(
        (s: any) => s.id === targetSimulationId,
      );
      if (simulationToEdit) {
        setFormData({
          title: simulationToEdit.title || "",
          timeLimit: simulationToEdit.timeLimit || 15,
          scenarioIds: simulationToEdit.scenarioIds || [],
          active: simulationToEdit.active ?? true,
        });
      }
    }
  }, [simulationId, editingSimulationId, simulations]);

  const handleInputChange = (
    field: keyof SimulationFormData,
    value: string | number | boolean | string[] | null,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addScenario = (scenarioId: string) => {
    if (!formData.scenarioIds.includes(scenarioId)) {
      setFormData((prev) => ({
        ...prev,
        scenarioIds: [...prev.scenarioIds, scenarioId],
      }));
    }
  };

  const removeScenario = (scenarioId: string) => {
    setFormData((prev) => ({
      ...prev,
      scenarioIds: prev.scenarioIds.filter((id) => id !== scenarioId),
    }));
  };

  const randomizeScenarios = () => {
    const shuffled = [...formData.scenarioIds].sort(() => Math.random() - 0.5);
    setFormData((prev) => ({ ...prev, scenarioIds: shuffled }));
    toast.success("Scenarios randomized!");
  };

  const handleDragStart = (e: React.DragEvent, scenarioId: string) => {
    setDraggedScenario(scenarioId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetScenarioId: string) => {
    e.preventDefault();

    if (!draggedScenario) return;

    const newOrder = [...formData.scenarioIds];
    const draggedIndex = newOrder.findIndex((id) => id === draggedScenario);
    const targetIndex = newOrder.findIndex((id) => id === targetScenarioId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      setFormData((prev) => ({ ...prev, scenarioIds: newOrder }));
    }

    setDraggedScenario(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (
      formData.timeLimit &&
      (formData.timeLimit < 1 || formData.timeLimit > 120)
    ) {
      newErrors.timeLimit = "Time limit must be between 1 and 120 minutes";
    }

    if (formData.scenarioIds.length === 0) {
      newErrors.scenarios = "At least one scenario must be selected";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setEditingSimulationId(null);
    setErrors({});
  };

  const handleEditSimulationClick = (simulationId: string) => {
    setEditingSimulationId(simulationId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      if (errors.scenarios) {
        toast.error(errors.scenarios);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        timeLimit: formData.timeLimit,
        scenarioIds: formData.scenarioIds,
        active: formData.active,
        rubricId: rubrics[0].id, // TODO: change to having a rubric selection
      };

      let result;
      const targetSimulationId = simulationId || editingSimulationId;
      if (targetSimulationId) {
        result = await updateSimulation(targetSimulationId, payload);
      } else {
        result = await createSimulation(payload);
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
      toast.success(
        targetSimulationId
          ? "Simulation updated successfully!"
          : "Simulation created successfully!",
      );
    } catch (error) {
      const targetSimulationId = simulationId || editingSimulationId;
      toast.error(
        `Failed to ${targetSimulationId ? "update" : "create"} simulation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSimulation = async () => {
    if (!simulationToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading("Deleting simulation...");

      await deleteSimulation(simulationToDelete);

      // Refresh the simulation list
      queryClient.invalidateQueries({ queryKey: ["simulations"] });

      toast.dismiss();
      toast.success("Simulation deleted successfully");
      setShowDeleteDialog(false);
      setSimulationToDelete(null);
    } catch (error) {
      console.error("Error deleting simulation:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete simulation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4">
          {simulations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No simulations found
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first simulation to get started with student
                  interactions.
                </p>
              </CardContent>
            </Card>
          ) : (
            simulations.map((simulation: any) => (
              <Card
                key={simulation.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {simulation.title}
                      </CardTitle>
                      <CardDescription>
                        <span className="inline-flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {simulation.timeLimit || "No limit"}{" "}
                          {simulation.timeLimit ? "minutes" : ""}
                        </span>
                        <span className="inline-flex items-center text-sm text-muted-foreground ml-4">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          {simulation.scenarioIds?.filter(
                            (id: string) => id !== "RAY",
                          ).length || 0}{" "}
                          scenarios
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={simulation.active ? "default" : "secondary"}
                      >
                        {simulation.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSimulationClick(simulation.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSimulationToDelete(simulation.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Simulation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this simulation? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSimulation}
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

  // Create mode - render the full create form
  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Simulation Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Simulation Information</CardTitle>
                <CardDescription>
                  Configure the basic settings for this simulation
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="active-toggle" className="text-sm font-medium">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
                <Switch
                  id="active-toggle"
                  checked={formData.active}
                  onCheckedChange={(checked: boolean) =>
                    handleInputChange("active", checked)
                  }
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Simulation Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter simulation title"
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
              <Input
                id="timeLimit"
                type="number"
                min="1"
                max="120"
                value={formData.timeLimit || ""}
                onChange={(e) =>
                  handleInputChange(
                    "timeLimit",
                    parseInt(e.target.value) || null,
                  )
                }
                className={errors.timeLimit ? "border-destructive" : ""}
                placeholder="Leave empty for no time limit"
              />
              {errors.timeLimit && (
                <p className="text-sm text-destructive">{errors.timeLimit}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scenario Configuration */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Scenarios</CardTitle>
                <CardDescription>
                  Select and arrange the scenarios for this simulation
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addScenario(value);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios
                      .filter(
                        (scenario: Scenario) =>
                          !formData.scenarioIds.includes(scenario.id),
                      )
                      .map((scenario: Scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.scenarioIds.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={randomizeScenarios}
                    className="flex items-center gap-2"
                  >
                    <Shuffle className="h-4 w-4" />
                    Randomize
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {errors.scenarios && (
              <p className="text-sm text-destructive">{errors.scenarios}</p>
            )}

            {formData.scenarioIds.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
                <div>
                  <p className="text-red-500 font-medium mb-1">
                    No scenarios selected
                  </p>
                  <p className="text-sm">
                    You must add at least one scenario to create a simulation
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {formData.scenarioIds.map((scenarioId, index) => {
                  const scenario = scenarios.find(
                    (s: Scenario) => s.id === scenarioId,
                  );
                  if (!scenario) return null;

                  return (
                    <Card
                      key={scenarioId}
                      className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                        draggedScenario === scenarioId ? "opacity-50" : ""
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, scenarioId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, scenarioId)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">
                              #{index + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeScenario(scenarioId)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">
                            {scenario.name}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {scenario.description}
                          </p>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              Crowdedness: {scenario.crowdedness}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Intensity: {scenario.intensity}
                            </Badge>
                          </div>

                          <Badge
                            className={`text-xs ${
                              scenario.seniority === "freshman"
                                ? "bg-blue-100 text-blue-800"
                                : scenario.seniority === "sophomore"
                                  ? "bg-green-100 text-green-800"
                                  : scenario.seniority === "junior"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {scenario.seniority.charAt(0).toUpperCase() +
                              scenario.seniority.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          {(simulationId || editingSimulationId) && (
            <Button
              type="button"
              variant="outline"
              onClick={resetFormAndState}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {simulationId || editingSimulationId
                  ? "Updating..."
                  : "Creating..."}
              </>
            ) : simulationId || editingSimulationId ? (
              "Update Simulation"
            ) : (
              "Create Simulation"
            )}
          </Button>
        </div>
      </form>

      {/* Document Preview Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Document Preview: {previewDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewDocument && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Document preview would be displayed here
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}