/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAgents } from "@/lib/api/hooks/agents";
import {
  useCreateDepartmentAgent,
  useDepartmentAgentsByDepartmentId,
} from "@/lib/api/hooks/department_agents";
import {
  useCreateDepartment,
  useDepartment,
  useUpdateDepartment,
} from "@/lib/api/hooks/departments";
import { Agent } from "@/types";
import { log } from "@/utils/logger";

export interface DepartmentProps {
  departmentId?: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  agents?: string;
}

interface FormData {
  title?: string;
  description?: string;
  active?: boolean;
}

// Agent role definitions
type AgentRole =
  | "title"
  | "scenario"
  | "classify"
  | "assistant"
  | "grade"
  | "input_guardrail"
  | "output_guardrail"
  | "hint";

// Define the 8 required agent types
const REQUIRED_AGENT_TYPES = [
  {
    type: "title",
    field: "titleAgentId",
    label: "Title Agent",
    description: "Generates titles for simulations",
  },
  {
    type: "scenario",
    field: "scenarioAgentId",
    label: "Scenario Agent",
    description: "Creates simulation scenarios",
  },
  {
    type: "classify",
    field: "classifyAgentId",
    label: "Classify Agent",
    description: "Classifies and categorizes content",
  },
  {
    type: "assistant",
    field: "assistantAgentId",
    label: "Assistant Agent",
    description: "Provides general assistance",
  },
  {
    type: "grade",
    field: "gradeAgentId",
    label: "Grade Agent",
    description: "Grades and evaluates submissions",
  },
  {
    type: "input_guardrail",
    field: "inputGuardrailAgentId",
    label: "Input Guardrail Agent",
    description: "Validates student input for safety and compliance",
  },
  {
    type: "output_guardrail",
    field: "outputGuardrailAgentId",
    label: "Output Guardrail Agent",
    description: "Validates simulation output for safety and compliance",
  },
  {
    type: "hint",
    field: "hintAgentId",
    label: "Hint Agent",
    description: "Provides hints and guidance to students",
  },
] as const;

export default function Department({ departmentId }: DepartmentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      active: true,
    }),
    [],
  );

  const [formData, setFormData] = useState<FormData>();
  const [errors, setErrors] = useState<FormErrors>({});

  // State for department agents (role -> agentId mapping)
  const [departmentAgents, setDepartmentAgents] = useState<
    Record<AgentRole, string>
  >({
    title: "",
    scenario: "",
    classify: "",
    assistant: "",
    grade: "",
    input_guardrail: "",
    output_guardrail: "",
    hint: "",
  });

  // Data fetching
  const { data: department, isLoading: isDepartmentLoading } = useDepartment(
    departmentId!,
    !!departmentId,
  );

  // Load department agents from junction table
  const { data: linkedAgents = [] } = useDepartmentAgentsByDepartmentId(
    departmentId || "",
  );

  // Get all agents for selection
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();

  // Mutation hooks
  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment(departmentId);
  const createDepartmentAgentMutation = useCreateDepartmentAgent();

  const isLoading = isDepartmentLoading || isAgentsLoading;

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (department && isEditMode) {
      setFormData({
        title: department.title,
        description: department.description || "",
        active: department.active ?? true,
      });
    } else if (!isEditMode) {
      setFormData(initialFormData);
    }
  }, [department, isEditMode, initialFormData]);

  // Load department agents from junction table
  useEffect(() => {
    if (linkedAgents.length > 0) {
      const agentMap: Record<AgentRole, string> = {
        title: "",
        scenario: "",
        classify: "",
        assistant: "",
        grade: "",
        input_guardrail: "",
        output_guardrail: "",
        hint: "",
      };

      linkedAgents.forEach((link) => {
        agentMap[link.role as AgentRole] = link.agentId;
      });

      setDepartmentAgents(agentMap);
    }
  }, [linkedAgents]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle agent assignment changes
  const handleAgentChange = (role: AgentRole, agentId: string) => {
    setDepartmentAgents((prev) => ({ ...prev, [role]: agentId }));
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData?.title) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      return;
    }

    if (!formData?.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

    // Validate that all 8 agent types are selected
    const missingAgents = REQUIRED_AGENT_TYPES.filter(
      (agentType) => !departmentAgents[agentType.type as AgentRole],
    );

    if (missingAgents.length > 0) {
      const firstMissing = missingAgents[0];
      if (firstMissing) {
        setErrors((prev) => ({
          ...prev,
          agents: `Please select a ${firstMissing.label.toLowerCase()}`,
        }));
      }
      toast.error(`Please select all required agents`);
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && departmentId) {
        // UPDATE mode - update department metadata
        result = await updateDepartmentMutation.mutateAsync({
          title: formData.title!,
          description: formData.description!,
          active: formData.active,
          updatedAt: new Date().toISOString(),
        });

        // Update department agents via junction table (upsert pattern via API)
        // Note: This requires server-side upsert support or batch update endpoint
        // TODO: Add batch upsert endpoint for department_agents
        for (const agentType of REQUIRED_AGENT_TYPES) {
          const role = agentType.type as AgentRole;
          const agentId = departmentAgents[role];

          if (agentId) {
            // Create or update will be handled by API upsert logic
            await createDepartmentAgentMutation.mutateAsync({
              departmentId: departmentId,
              role: role,
              agentId: agentId,
            });
          }
        }
      } else {
        // CREATE mode - create department first, then junction records
        result = await createDepartmentMutation.mutateAsync({
          title: formData.title!,
          description: formData.description!,
          active: formData.active ?? true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Create department agent links
        if (result?.id) {
          for (const agentType of REQUIRED_AGENT_TYPES) {
            const role = agentType.type as AgentRole;
            const agentId = departmentAgents[role];

            if (agentId) {
              await createDepartmentAgentMutation.mutateAsync({
                departmentId: result.id,
                role: role,
                agentId: agentId,
              });
            }
          }
        }
      }

      if (!result) {
        toast.error(`Failed to ${isEditMode ? "update" : "create"} department`);
        return;
      }

      resetFormAndState();
      toast.success(
        isEditMode
          ? "Department updated successfully!"
          : "Department created successfully!",
      );
      router.push(`/system/departments`);
    } catch (error) {
      const message = `Error ${isEditMode ? "updating" : "creating"} department:`;
      log.error("department.save.failed", {
        message,
        error,
        context: { component: "Department", isEditMode, departmentId },
      });
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Field */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData?.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
              required
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          {formData?.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
              required
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Active Switch */}
        <div className="space-y-2">
          <Label htmlFor="active" className="text-sm">
            Department Active
          </Label>
          {formData?.active !== undefined && !isLoading ? (
            <Switch
              id="active"
              checked={formData.active ?? true}
              onCheckedChange={(checked) =>
                handleInputChange("active", checked)
              }
            />
          ) : (
            <Skeleton className="h-6 w-11" />
          )}
        </div>

        {/* Agents Field */}
        <div className="space-y-4">
          {!isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REQUIRED_AGENT_TYPES.map((agentType) => {
                const role = agentType.type as AgentRole;
                const fieldValue = departmentAgents[role] || "";

                return (
                  <div key={agentType.type} className="space-y-2">
                    <Label
                      htmlFor={`agent-${agentType.type}`}
                      className="text-sm font-medium"
                    >
                      {agentType.label}
                    </Label>
                    {agents.length > 0 ? (
                      <Select
                        value={fieldValue}
                        onValueChange={(value) =>
                          handleAgentChange(role, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={`Select ${agentType.label}`}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent: Agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="w-full p-3 text-sm text-muted-foreground bg-muted rounded-md border">
                        <div className="flex items-center gap-2">
                          <span>⚠️</span>
                          <span>
                            No agents available. You'll need to create agents
                            first.
                          </span>
                        </div>
                      </div>
                    )}
                    {errors.agents && (
                      <p className="text-sm text-destructive">
                        {errors.agents}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {agentType.description}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REQUIRED_AGENT_TYPES.map((agentType) => (
                <div key={agentType.type} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting || isLoading}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isEditMode ? "Updating..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Update Department"
            ) : (
              "Create Department"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
