/**
 * Eval.tsx
 * Used to create and manage evaluations - supports both creation and editing
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import {
  Trash2,
  Bot,
  MessageSquare,
  FileCheck,
  GripVertical,
  Shuffle,
} from "lucide-react";

// API imports
import { getEval } from "@/utils/queries/evals/get-eval";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { createEval } from "@/utils/mutations/evals/create-eval";
import { updateEval } from "@/utils/mutations/evals/update-eval";

// Types
import { Agent, Scenario, Rubric, Class } from "@/types";

interface EvalProps {
  evalId?: string;
  mode?: "create" | "edit";
}

interface EvalFormData {
  name: string;
  description: string;
  classId: string | null;
  baseAgentId: string;
  scenarioIds: string[];
  agentIds: string[];
  evalType: "student" | "ta";
  maxTurns: number;
  numParallelRuns: number;
  rubricIds: string[];
}

interface FormErrors {
  name?: string;
  description?: string;
  baseAgentId?: string;
  scenarioIds?: string;
  agentIds?: string;
  maxTurns?: string;
  numParallelRuns?: string;
  rubricIds?: string;
}

export default function Eval({
  evalId,
  mode = evalId ? "edit" : "create",
}: EvalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === "edit" && !!evalId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const initialFormData: EvalFormData = {
    name: "",
    description: "",
    classId: null,
    baseAgentId: "",
    scenarioIds: [],
    agentIds: [],
    evalType: "student",
    maxTurns: 10,
    numParallelRuns: 1,
    rubricIds: [],
  };

  const [formData, setFormData] = useState<EvalFormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch eval data if editing
  const { data: evalData, isLoading: isLoadingEval } = useQuery({
    queryKey: ["eval", evalId],
    queryFn: () => getEval(evalId!),
    enabled: isEditMode,
  });

  // Fetch related data
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: rubrics = [] } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createEval,
    onSuccess: () => {
      toast.success("Evaluation created successfully!");
      queryClient.invalidateQueries({ queryKey: ["evals"] });
      router.push("/management/evals");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create evaluation: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateEval(id, data),
    onSuccess: () => {
      toast.success("Evaluation updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["evals"] });
      queryClient.invalidateQueries({ queryKey: ["eval", evalId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update evaluation: ${error.message}`);
    },
  });

  // Load eval data when editing
  useEffect(() => {
    if (isEditMode && evalData) {
      setFormData({
        name: evalData.name || "",
        description: evalData.description || "",
        classId: evalData.classId || null,
        baseAgentId: evalData.baseAgentId || "",
        scenarioIds:
          evalData.scenarioIds?.filter((id: string) => id !== "RAY") || [],
        agentIds: evalData.agentIds?.filter((id: string) => id !== "RAY") || [],
        evalType: evalData.evalType || "student",
        maxTurns: evalData.maxTurns || 10,
        numParallelRuns: evalData.numParallelRuns || 1,
        rubricIds:
          evalData.rubricIds?.filter((id: string) => id !== "RAY") || [],
      });
    }
  }, [isEditMode, evalData]);

  const handleInputChange = (
    field: keyof EvalFormData,
    value: string | number | string[] | null,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addItem = (
    field: "scenarioIds" | "agentIds" | "rubricIds",
    itemId: string,
  ) => {
    if (!formData[field].includes(itemId)) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], itemId],
      }));
    }
  };

  const removeItem = (
    field: "scenarioIds" | "agentIds" | "rubricIds",
    itemId: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((id) => id !== itemId),
    }));
  };

  const randomizeOrder = (field: "scenarioIds" | "agentIds" | "rubricIds") => {
    const shuffled = [...formData[field]].sort(() => Math.random() - 0.5);
    setFormData((prev) => ({ ...prev, [field]: shuffled }));
    toast.success(
      `${field === "scenarioIds" ? "Scenarios" : field === "agentIds" ? "Agents" : "Rubrics"} randomized!`,
    );
  };

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (
    e: React.DragEvent,
    targetItemId: string,
    field: "scenarioIds" | "agentIds" | "rubricIds",
  ) => {
    e.preventDefault();

    if (!draggedItem) return;

    const newOrder = [...formData[field]];
    const draggedIndex = newOrder.findIndex((id) => id === draggedItem);
    const targetIndex = newOrder.findIndex((id) => id === targetItemId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      setFormData((prev) => ({ ...prev, [field]: newOrder }));
    }

    setDraggedItem(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    }

    if (!formData.baseAgentId) {
      newErrors.baseAgentId = "Base agent is required";
    }

    if (formData.scenarioIds.length === 0) {
      newErrors.scenarioIds = "At least one scenario must be selected";
    }

    if (formData.agentIds.length === 0) {
      newErrors.agentIds = "At least one agent must be selected";
    }

    if (formData.maxTurns < 1 || formData.maxTurns > 100) {
      newErrors.maxTurns = "Max turns must be between 1 and 100";
    }

    if (formData.numParallelRuns < 1 || formData.numParallelRuns > 10) {
      newErrors.numParallelRuns = "Parallel runs must be between 1 and 10";
    }

    if (formData.rubricIds.length === 0) {
      newErrors.rubricIds = "At least one rubric must be selected";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        classId: formData.classId,
        baseAgentId: formData.baseAgentId,
        scenarioIds:
          formData.scenarioIds.length > 0 ? formData.scenarioIds : ["RAY"],
        agentIds: formData.agentIds.length > 0 ? formData.agentIds : ["RAY"],
        evalType: formData.evalType,
        maxTurns: formData.maxTurns,
        numParallelRuns: formData.numParallelRuns,
        rubricIds: formData.rubricIds.length > 0 ? formData.rubricIds : ["RAY"],
      };

      if (isEditMode) {
        updateMutation.mutate({ id: evalId!, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    } catch (error) {
      toast.error(`Failed to ${isEditMode ? "update" : "create"} evaluation`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push("/management/evals");
  };

  if (isEditMode && isLoadingEval) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Edit Evaluation" : "Create Evaluation"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode
            ? "Update the evaluation configuration and settings"
            : "Create a new evaluation to assess agent performance"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Configure the basic settings for this evaluation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Evaluation Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter evaluation name"
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="evalType">Evaluation Type</Label>
                <Select
                  value={formData.evalType}
                  onValueChange={(value: "student" | "ta") =>
                    handleInputChange("evalType", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="ta">Teaching Assistant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Describe the purpose and goals of this evaluation"
                rows={3}
                className={errors.description ? "border-destructive" : ""}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="classId">Class (Optional)</Label>
              <Select
                value={formData.classId || "none"}
                onValueChange={(value: string) =>
                  handleInputChange("classId", value === "none" ? null : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific class</SelectItem>
                  {classes.map((cls: Class) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.classCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration Settings</CardTitle>
            <CardDescription>
              Set the evaluation parameters and limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxTurns">Max Turns *</Label>
                <Input
                  id="maxTurns"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.maxTurns}
                  onChange={(e) =>
                    handleInputChange("maxTurns", parseInt(e.target.value) || 1)
                  }
                  className={errors.maxTurns ? "border-destructive" : ""}
                />
                {errors.maxTurns && (
                  <p className="text-sm text-destructive">{errors.maxTurns}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numParallelRuns">Parallel Runs *</Label>
                <Input
                  id="numParallelRuns"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.numParallelRuns}
                  onChange={(e) =>
                    handleInputChange(
                      "numParallelRuns",
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className={errors.numParallelRuns ? "border-destructive" : ""}
                />
                {errors.numParallelRuns && (
                  <p className="text-sm text-destructive">
                    {errors.numParallelRuns}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseAgentId">Base Agent *</Label>
                <Select
                  value={formData.baseAgentId}
                  onValueChange={(value: string) =>
                    handleInputChange("baseAgentId", value)
                  }
                >
                  <SelectTrigger
                    className={errors.baseAgentId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select base agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent: Agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.baseAgentId && (
                  <p className="text-sm text-destructive">
                    {errors.baseAgentId}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scenarios */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Scenarios *</CardTitle>
                <CardDescription>
                  Select and arrange scenarios for this evaluation
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addItem("scenarioIds", value);
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
                    onClick={() => randomizeOrder("scenarioIds")}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errors.scenarioIds && (
              <p className="text-sm text-destructive mb-4">
                {errors.scenarioIds}
              </p>
            )}

            {formData.scenarioIds.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center text-muted-foreground border border-dashed rounded-md">
                <div>
                  <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">No scenarios selected</p>
                  <p className="text-sm">
                    Add scenarios to define evaluation contexts
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formData.scenarioIds.map((scenarioId, index) => {
                  const scenario = scenarios.find(
                    (s: Scenario) => s.id === scenarioId,
                  );
                  if (!scenario) return null;

                  return (
                    <Card
                      key={scenarioId}
                      className="p-3 cursor-move hover:shadow-md transition-all"
                      draggable
                      onDragStart={(e) => handleDragStart(e, scenarioId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, scenarioId, "scenarioIds")}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              removeItem("scenarioIds", scenarioId)
                            }
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <h4 className="font-medium text-sm mb-1">
                        {scenario.name}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {scenario.description}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Evaluation Agents *</CardTitle>
                <CardDescription>
                  Select agents to be evaluated in this assessment
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addItem("agentIds", value);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents
                      .filter(
                        (agent: Agent) =>
                          !formData.agentIds.includes(agent.id) &&
                          agent.id !== formData.baseAgentId,
                      )
                      .map((agent: Agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.agentIds.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => randomizeOrder("agentIds")}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errors.agentIds && (
              <p className="text-sm text-destructive mb-4">{errors.agentIds}</p>
            )}

            {formData.agentIds.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center text-muted-foreground border border-dashed rounded-md">
                <div>
                  <Bot className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">No agents selected</p>
                  <p className="text-sm">Add agents to be evaluated</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formData.agentIds.map((agentId, index) => {
                  const agent = agents.find((a: Agent) => a.id === agentId);
                  if (!agent) return null;

                  return (
                    <Card
                      key={agentId}
                      className="p-3 cursor-move hover:shadow-md transition-all"
                      draggable
                      onDragStart={(e) => handleDragStart(e, agentId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, agentId, "agentIds")}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem("agentIds", agentId)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <h4 className="font-medium text-sm mb-1">{agent.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {agent.subtitle}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rubrics */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Evaluation Rubrics *</CardTitle>
                <CardDescription>
                  Select rubrics to assess agent performance
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value=""
                  onValueChange={(value: string) => {
                    if (value) addItem("rubricIds", value);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add rubric" />
                  </SelectTrigger>
                  <SelectContent>
                    {rubrics
                      .filter(
                        (rubric: Rubric) =>
                          !formData.rubricIds.includes(rubric.id),
                      )
                      .map((rubric: Rubric) => (
                        <SelectItem key={rubric.id} value={rubric.id}>
                          {rubric.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {formData.rubricIds.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => randomizeOrder("rubricIds")}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errors.rubricIds && (
              <p className="text-sm text-destructive mb-4">
                {errors.rubricIds}
              </p>
            )}

            {formData.rubricIds.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-center text-muted-foreground border border-dashed rounded-md">
                <div>
                  <FileCheck className="h-8 w-8 mx-auto mb-2" />
                  <p className="font-medium">No rubrics selected</p>
                  <p className="text-sm">
                    Add rubrics to define evaluation criteria
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formData.rubricIds.map((rubricId, index) => {
                  const rubric = rubrics.find((r: Rubric) => r.id === rubricId);
                  if (!rubric) return null;

                  return (
                    <Card
                      key={rubricId}
                      className="p-3 cursor-move hover:shadow-md transition-all"
                      draggable
                      onDragStart={(e) => handleDragStart(e, rubricId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, rubricId, "rubricIds")}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeItem("rubricIds", rubricId)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <h4 className="font-medium text-sm mb-1">
                        {rubric.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{rubric.points} points</span>
                        <span>•</span>
                        <span>Pass: {rubric.passPoints}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Evaluation"
            ) : (
              "Create Evaluation"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
