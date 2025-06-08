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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  FileText,
  Clock,
  Users,
  Shuffle,
  GripVertical,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import DocumentViewer from "@/components/DocumentViewer";
import { simulations as Simulations } from "@/drizzle/schema";
import { interactions as Interactions } from "@/drizzle/schema";
import { documents as Documents } from "@/drizzle/schema";
import { agents as Agents } from "@/drizzle/schema";

// Queries and mutations
import { getAgents } from "@/utils/queries/get-agents";
import { getSimulations } from "@/utils/queries/get-simulations";
import { getSimulation } from "@/utils/queries/get-simulation";
import { createSimulation } from "@/utils/mutations/create-simulation";
import { updateSimulation } from "@/utils/mutations/update-simulation";
import { deleteSimulation } from "@/utils/mutations/delete-simulation";
import { getInteractions } from "@/utils/queries/get-interactions";
import { createInteraction } from "@/utils/mutations/create-interaction";
import { updateInteraction } from "@/utils/mutations/update-interaction";
import { getAllDocuments } from "@/utils/queries/get-all-documents";

interface InteractionConfig {
  id: string;
  agentId: string;
  crowdedness: number;
  intensity: number;
  seniority: string;
  isNew?: boolean; // Track if this is a new interaction that needs to be created
}

interface SimulationComponentFormData {
  title: string;
  timeLimit: number | null;
  documents: string[];
  interactionConfigs: InteractionConfig[];
  active: boolean;
}

interface FormErrors {
  title?: string;
  timeLimit?: string;
  interactions?: string;
}

interface SimulationProps {
  mode?: "list" | "create";
  simulationId?: string;
}

// Preset configurations for quick setup
const INTERACTION_PRESETS = [
  {
    name: "Balanced Classroom",
    description: "A mix of engaged and confused students",
    configs: [
      { agentId: "", crowdedness: 3, intensity: 2, seniority: "sophomore" },
      { agentId: "", crowdedness: 4, intensity: 3, seniority: "junior" },
      { agentId: "", crowdedness: 2, intensity: 4, seniority: "freshman" },
    ]
  },
  {
    name: "High Energy Session",
    description: "Active and engaged students",
    configs: [
      { agentId: "", crowdedness: 4, intensity: 4, seniority: "junior" },
      { agentId: "", crowdedness: 5, intensity: 3, seniority: "senior" },
      { agentId: "", crowdedness: 3, intensity: 5, seniority: "sophomore" },
    ]
  },
  {
    name: "Quiet Study Group",
    description: "Focused, low-intensity environment",
    configs: [
      { agentId: "", crowdedness: 2, intensity: 2, seniority: "senior" },
      { agentId: "", crowdedness: 1, intensity: 1, seniority: "junior" },
    ]
  },
  {
    name: "Mixed Experience",
    description: "Students from all levels",
    configs: [
      { agentId: "", crowdedness: 3, intensity: 3, seniority: "freshman" },
      { agentId: "", crowdedness: 3, intensity: 3, seniority: "sophomore" },
      { agentId: "", crowdedness: 3, intensity: 3, seniority: "junior" },
      { agentId: "", crowdedness: 3, intensity: 3, seniority: "senior" },
    ]
  }
];

export default function Simulation({ mode = "create", simulationId }: SimulationProps) {
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [simulationToDelete, setSimulationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<typeof Documents.$inferSelect | null>(null);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(null);
  const [draggedCard, setDraggedCard] = useState<InteractionConfig | null>(null);

  const initialFormData: SimulationComponentFormData = {
    title: "",
    timeLimit: 15,
    documents: [],
    interactionConfigs: [],
    active: true,
  };

  const [formData, setFormData] = useState<SimulationComponentFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: getAllDocuments,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: getAgents,
  });

  // Fetch simulations for the list mode
  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: getSimulations,
    enabled: mode === "list",
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["interactions"],
    queryFn: getInteractions,
  });

  // Fetch specific simulation for editing
  const { data: simulationToEdit } = useQuery({
    queryKey: ["simulation", simulationId],
    queryFn: () => getSimulation(simulationId!),
    enabled: !!simulationId && mode === "create",
  });

  // Load simulation data when editing
  useEffect(() => {
    if (simulationToEdit && simulationId && interactions.length > 0) {
      setEditingSimulationId(simulationToEdit.id);
      
      // Map existing interaction IDs to full interaction objects
      const existingInteractionConfigs = simulationToEdit.interactionIds
        ?.map((id: string) => {
          const interaction = interactions.find((t: typeof Interactions.$inferSelect) => t.id === id);
          return interaction ? {
            id: interaction.id,
            agentId: interaction.agentId,
            crowdedness: interaction.crowdedness,
            intensity: interaction.intensity,
            seniority: interaction.seniority,
            isNew: false,
          } : null;
        })
        .filter(Boolean) || [];

      setFormData({
        title: simulationToEdit.title,
        timeLimit: simulationToEdit.timeLimit,
        documents: simulationToEdit.documents || [],
        interactionConfigs: existingInteractionConfigs as InteractionConfig[],
        active: simulationToEdit.active ?? true,
      });
      setErrors({});
    }
  }, [simulationToEdit, simulationId, interactions]);

  const handleInputChange = (field: keyof SimulationComponentFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const addInteraction = () => {
    if (agents.length === 0) {
      toast.error("No agents available. Please create agents first.");
      return;
    }

    const newConfig: InteractionConfig = {
      id: `temp-${Date.now()}`,
      agentId: agents[0]?.id || "",
      crowdedness: 3,
      intensity: 3,
      seniority: "freshman",
      isNew: true,
    };
    setFormData(prev => ({
      ...prev,
      interactionConfigs: [...prev.interactionConfigs, newConfig]
    }));
  };

  const addPresetInteractions = (preset: typeof INTERACTION_PRESETS[0]) => {
    if (agents.length === 0) {
      toast.error("No agents available. Please create agents first.");
      return;
    }

    const defaultAgentId = agents[0]?.id || "";
    const newConfigs: InteractionConfig[] = preset.configs.map((config, index) => ({
      id: `temp-${Date.now()}-${index}`,
      agentId: config.agentId || defaultAgentId,
      crowdedness: config.crowdedness,
      intensity: config.intensity,
      seniority: config.seniority,
      isNew: true,
    }));

    setFormData(prev => ({
      ...prev,
      interactionConfigs: [...prev.interactionConfigs, ...newConfigs]
    }));

    toast.success(`Added ${preset.name} preset with ${newConfigs.length} interactions!`);
  };

  const removeInteraction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      interactionConfigs: prev.interactionConfigs.filter((_, i) => i !== index)
    }));
  };

  const updateInteractionConfig = (index: number, field: keyof InteractionConfig, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      interactionConfigs: prev.interactionConfigs.map((config, i) => 
        i === index ? { ...config, [field]: value } : config
      )
    }));
  };

  const randomizeCards = () => {
    const shuffled = [...formData.interactionConfigs].sort(() => Math.random() - 0.5);
    setFormData(prev => ({ ...prev, interactionConfigs: shuffled }));
    toast.success("Interactions randomized!");
  };

  const handleDragStart = (e: React.DragEvent, config: InteractionConfig) => {
    setDraggedCard(config);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetConfig: InteractionConfig) => {
    e.preventDefault();
    
    if (!draggedCard) return;

    const newOrder = [...formData.interactionConfigs];
    const draggedIndex = newOrder.findIndex(config => config.id === draggedCard.id);
    const targetIndex = newOrder.findIndex(config => config.id === targetConfig.id);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      
      setFormData(prev => ({ ...prev, interactionConfigs: newOrder }));
    }
    
    setDraggedCard(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (formData.timeLimit && (formData.timeLimit < 1 || formData.timeLimit > 120)) {
      newErrors.timeLimit = "Time limit must be between 1 and 120 minutes";
    }
    
    if (formData.interactionConfigs.length === 0) {
      newErrors.interactions = "At least one interaction must be configured";
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
    const simulationToEdit = simulations.find((t: typeof Simulations.$inferSelect) => t.id === simulationId);
    if (simulationToEdit) {
      setEditingSimulationId(simulationToEdit.id);
      
      // Map existing interaction IDs to full interaction objects
      const existingInteractionConfigs = simulationToEdit.interactionIds
        ?.map((id: string) => {
          const interaction = interactions.find((t: typeof Interactions.$inferSelect) => t.id === id);
          return interaction ? {
            id: interaction.id,
            agentId: interaction.agentId,
            crowdedness: interaction.crowdedness,
            intensity: interaction.intensity,
            seniority: interaction.seniority,
            isNew: false,
          } : null;
        })
        .filter(Boolean) || [];

      setFormData({
        title: simulationToEdit.title,
        timeLimit: simulationToEdit.timeLimit,
        documents: simulationToEdit.documents || [],
        interactionConfigs: existingInteractionConfigs as InteractionConfig[],
        active: simulationToEdit.active ?? true,
      });
      setErrors({});
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      if (errors.interactions) {
        toast.error(errors.interactions);
      } else {
        toast.error("Please fill in all required fields");
      }
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // First, create any new interactions
      const interactionIds: string[] = [];
      
      for (const config of formData.interactionConfigs) {
        if (config.isNew) {
          // Create new interaction
          const result = await createInteraction(
            config.agentId,
            config.crowdedness,
            config.intensity,
            config.seniority as "freshman" | "sophomore" | "junior" | "senior"
          );
          
          if (result.success && result.interaction) {
            interactionIds.push(result.interaction.id);
          } else {
            throw new Error(`Failed to create interaction: ${result.error}`);
          }
        } else {
          // Use existing interaction ID
          interactionIds.push(config.id);
          
          // Update existing interaction if needed
          await updateInteraction(
            config.id,
            config.agentId,
            config.crowdedness,
            config.intensity,
            config.seniority as "freshman" | "sophomore" | "junior" | "senior"
          );
        }
      }

      const payload = {
        title: formData.title,
        timeLimit: formData.timeLimit,
        documents: formData.documents,
        interactionIds: interactionIds,
      };

      let result;
      if (editingSimulationId) {
        result = await updateSimulation(editingSimulationId, payload.title, payload.timeLimit, payload.documents, payload.interactionIds, formData.active);
      } else {
        result = await createSimulation(payload.title, payload.timeLimit, payload.documents, payload.interactionIds);
        // Set active status after creation if needed
        if (result.success && result.simulation && !formData.active) {
          await updateSimulation(result.simulation.id, undefined, undefined, undefined, undefined, formData.active);
        }
      }
      
      if (result.success) {
        resetFormAndState();
        queryClient.invalidateQueries({ queryKey: ["simulations"] });
        queryClient.invalidateQueries({ queryKey: ["interactions"] });
        toast.success(editingSimulationId ? "Simulation updated successfully!" : "Simulation created successfully!");
      } else {
        toast.error(`Failed to ${editingSimulationId ? 'update' : 'create'} simulation: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Failed to ${editingSimulationId ? 'update' : 'create'} simulation: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSimulation = async () => {
    if (!simulationToDelete) return;

    try {
      setIsDeleting(true);
      toast.loading("Deleting simulation...");

      const result = await deleteSimulation(simulationToDelete);

      if (result.success) {
        // Refresh the simulation list
        queryClient.invalidateQueries({ queryKey: ["simulations"] });
        
        toast.dismiss();
        toast.success("Simulation deleted successfully");
        setShowDeleteDialog(false);
        setSimulationToDelete(null);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error deleting simulation:", error);
      toast.dismiss();
      toast.error(
        `Failed to delete simulation: ${error instanceof Error ? error.message : "Unknown error"}`
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
                <h3 className="text-lg font-semibold mb-2">No simulations found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first simulation to get started with student interactions.
                </p>
              </CardContent>
            </Card>
          ) : (
            simulations.map((simulation: typeof Simulations.$inferSelect) => (
              <Card key={simulation.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{simulation.title}</CardTitle>
                      <CardDescription>
                        <span className="inline-flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {simulation.timeLimit} minutes
                        </span>
                        <span className="inline-flex items-center text-sm text-muted-foreground ml-4">
                          <Users className="h-4 w-4 mr-1" />
                          {simulation.interactionIds?.length || 0} interactions
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={simulation.active ? "default" : "secondary"}>
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
                Are you sure you want to delete this simulation? This action cannot be undone.
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

              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="active-toggle" className="text-sm font-medium">
                  {formData.active ? "Active" : "Inactive"}
                </Label>
                <Switch
                  id="active-toggle"
                  checked={formData.active}
                  onCheckedChange={(checked: boolean) => handleInputChange("active", checked)}
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
                onChange={(e) => handleInputChange("timeLimit", parseInt(e.target.value) || 0)}
                className={errors.timeLimit ? "border-destructive" : ""}
              />
              {errors.timeLimit && (
                <p className="text-sm text-destructive">{errors.timeLimit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="documents">Reference Documents (Optional)</Label>
              <Select
                value={formData.documents[0] || "none"}
                onValueChange={(value: string) => handleInputChange("documents", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select documents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No documents</SelectItem>
                  {documents.map((doc: typeof Documents.$inferSelect) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.documents.length > 0 && formData.documents[0] && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const doc = documents.find((d: typeof Documents.$inferSelect) => d.id === formData.documents[0]);
                    if (doc) {
                      setPreviewDocument(doc);
                      setShowDocumentModal(true);
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview Document
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interaction Configuration */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Simulation</CardTitle>
                <CardDescription>
                  Configure the AI student interactions for this simulation
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={agents.length === 0}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Presets
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium">Quick Setup Presets</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose a preset to quickly add multiple interactions
                        </p>
                      </div>
                      <div className="space-y-2">
                        {INTERACTION_PRESETS.map((preset, index) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => addPresetInteractions(preset)}
                          >
                            <div className="font-medium text-sm">{preset.name}</div>
                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {preset.configs.length} interactions
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addInteraction}
                  disabled={agents.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Interaction
                </Button>
                {formData.interactionConfigs.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={randomizeCards}
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
            {errors.interactions && (
              <p className="text-sm text-destructive">{errors.interactions}</p>
            )}

            {formData.interactionConfigs.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
                <div>
                  <p className="text-red-500 font-medium mb-1">No simulations configured</p>
                  <p className="text-sm">You must add at least one chat to create a simulation</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {formData.interactionConfigs.map((config, index) => {
                  return (
                    <Card 
                      key={config.id} 
                      className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 ${
                        config.isNew ? 'border-l-green-500' : 'border-l-blue-500'
                      } ${draggedCard?.id === config.id ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, config)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, config)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium">Interaction {index + 1}</span>
                            {config.isNew && (
                              <Badge variant="secondary" className="text-xs">New</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">#{index + 1}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeInteraction(index)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Agent</Label>
                            <Select
                              value={config.agentId}
                              onValueChange={(value) => updateInteractionConfig(index, "agentId", value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select profile" />
                              </SelectTrigger>
                              <SelectContent>
                                {agents.map((agent: typeof Agents.$inferSelect) => (
                                  <SelectItem key={agent.id} value={agent.id}>
                                    {agent.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-xs">Seniority</Label>
                            <Select
                              value={config.seniority}
                              onValueChange={(value) => updateInteractionConfig(index, "seniority", value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select seniority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="freshman">Freshman</SelectItem>
                                <SelectItem value="sophomore">Sophomore</SelectItem>
                                <SelectItem value="junior">Junior</SelectItem>
                                <SelectItem value="senior">Senior</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs">Crowdedness (Low - High)</Label>
                              <span className="text-xs text-muted-foreground">
                                {config.crowdedness === 1 ? "Empty" : 
                                 config.crowdedness === 2 ? "Sparse" :
                                 config.crowdedness === 3 ? "Moderate" :
                                 config.crowdedness === 4 ? "Busy" : "Crowded"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button
                                  key={level}
                                  type="button"
                                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                                    level === config.crowdedness 
                                      ? 'bg-blue-500 border-blue-500' 
                                      : 'border-gray-300 hover:border-blue-300'
                                  }`}
                                  onClick={() => updateInteractionConfig(index, 'crowdedness', level)}
                                />
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <Label className="text-xs">Intensity (Low - High)</Label>
                              <span className="text-xs text-muted-foreground">
                                {config.intensity === 1 ? "Low" : 
                                 config.intensity === 2 ? "Mild" :
                                 config.intensity === 3 ? "Moderate" :
                                 config.intensity === 4 ? "High" : "Very High"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              {[1, 2, 3, 4, 5].map(level => (
                                <button
                                  key={level}
                                  type="button"
                                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                                    level === config.intensity 
                                      ? 'bg-orange-500 border-orange-500' 
                                      : 'border-gray-300 hover:border-orange-300'
                                  }`}
                                  onClick={() => updateInteractionConfig(index, 'intensity', level)}
                                />
                              ))}
                            </div>
                          </div>

                          <Badge className={`text-xs ${
                            config.seniority === 'freshman' ? 'bg-blue-100 text-blue-800' :
                            config.seniority === 'sophomore' ? 'bg-green-100 text-green-800' :
                            config.seniority === 'junior' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {config.seniority.charAt(0).toUpperCase() + config.seniority.slice(1)}
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
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {editingSimulationId ? "Updating..." : "Creating..."}
              </>
            ) : (
              editingSimulationId ? "Update Simulation" : "Create Simulation"
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
              <DocumentViewer document={previewDocument} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
