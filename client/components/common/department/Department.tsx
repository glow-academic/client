/**
 * Department.tsx
 * Used to display the department page with create/edit functionality.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAgentsByDepartmentId } from "@/lib/api/hooks/agents";
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
  agents?: Record<string, string>;
}

// Define the 6 required agent types
const REQUIRED_AGENT_TYPES = [
  {
    type: "title",
    label: "Title Agent",
    description: "Generates titles for simulations",
  },
  {
    type: "scenario",
    label: "Scenario Agent",
    description: "Creates simulation scenarios",
  },
  {
    type: "classify",
    label: "Classify Agent",
    description: "Classifies and categorizes content",
  },
  {
    type: "assistant",
    label: "Assistant Agent",
    description: "Provides general assistance",
  },
  {
    type: "grade",
    label: "Grade Agent",
    description: "Grades and evaluates submissions",
  },
  {
    type: "guardrail",
    label: "Guardrail Agent",
    description: "Ensures content safety and compliance",
  },
] as const;

export default function Department({ departmentId }: DepartmentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasInitialized = useRef(false);

  const isEditMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      title: "",
      description: "",
      agents: {},
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Data fetching
  const { data: department, isLoading: isDepartmentLoading } = useDepartment(
    departmentId!,
    !!departmentId
  );

  // Get agents for this department
  const { data: departmentAgents = [], isLoading: isAgentsLoading } =
    useAgentsByDepartmentId(departmentId!);

  // Mutation hooks
  const createDepartmentMutation = useCreateDepartment();
  const updateDepartmentMutation = useUpdateDepartment(departmentId);

  // Initialize form when department data loads or in create mode
  useEffect(() => {
    if (department && isEditMode && !hasInitialized.current) {
      // Map existing agents by type (handle case where no agents exist)
      const agentsByType: Record<string, string> = {};
      if (departmentAgents.length > 0) {
        departmentAgents.forEach((agent: Agent) => {
          agentsByType[agent.type] = agent.id;
        });
      }

      setFormData({
        title: department.title,
        description: department.description || "",
        agents: agentsByType,
      });
      hasInitialized.current = true;
    } else if (!isEditMode && !hasInitialized.current) {
      setFormData(initialFormData);
      hasInitialized.current = true;
    }
  }, [department, isEditMode, initialFormData, departmentAgents]);

  const isLoading = isDepartmentLoading || isAgentsLoading;

  const handleInputChange = (
    field: keyof FormData,
    value: string | undefined
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAgentChange = (agentType: string, agentId: string) => {
    setFormData((prev) => ({
      ...prev,
      agents: {
        ...prev.agents,
        [agentType]: agentId,
      },
    }));
    if (errors.agents) {
      setErrors((prev) => {
        const { agents: _agents, ...rest } = prev;
        return rest;
      });
    }
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.title) {
      setErrors((prev) => ({ ...prev, title: "Title is required" }));
      return;
    }

    if (!formData.description) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

    // Validate that all 6 agent types are selected
    const missingAgents = REQUIRED_AGENT_TYPES.filter(
      (agentType) =>
        !formData.agents?.[agentType.type] ||
        formData.agents?.[agentType.type] === "no-agents-available"
    );

    if (missingAgents.length > 0) {
      setErrors((prev) => ({
        ...prev,
        agents: `Please select agents for: ${missingAgents.map((a) => a.label).join(", ")}`,
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (isEditMode && departmentId && department) {
        // Prepare update data - only include changed fields
        const updateData: {
          title?: string;
          description?: string;
        } = {};

        if (formData.title !== department.title) {
          updateData.title = formData.title;
        }

        if (formData.description !== (department.description || "")) {
          updateData.description = formData.description;
        }

        result = await updateDepartmentMutation.mutateAsync(updateData);

        // TODO: Handle agent updates separately
        // For now, we'll just log the agent selections
        // In a real implementation, you might need to:
        // 1. Update agent department assignments
        // 2. Create/update agent-department relationships
        // 3. Handle agent type assignments
        log.info("department.agents.selected", {
          message: "Agent selections made",
          context: {
            component: "Department",
            departmentId,
            agents: formData.agents,
          },
        });
      } else {
        result = await createDepartmentMutation.mutateAsync({
          title: formData.title!,
          description: formData.description!,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // TODO: Handle agent assignments for new departments
        // For now, we'll just log the agent selections
        log.info("department.agents.selected", {
          message: "Agent selections made for new department",
          context: {
            component: "Department",
            agents: formData.agents,
          },
        });
      }

      if (!result) {
        toast.error(`Failed to ${isEditMode ? "update" : "create"} department`);
        return;
      }

      resetFormAndState();
      toast.success(
        isEditMode && departmentId
          ? "Department updated successfully!"
          : "Department created successfully!"
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
        `Failed to ${isEditMode ? "update" : "create"} department: ${error instanceof Error ? error.message : "Unknown error"}`
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
          <Label htmlFor="title">Title</Label>
          {formData.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter department title"
              className={errors.title ? "border-destructive" : ""}
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
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter department description"
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Agents Field */}
        <div className="space-y-4">
          {!isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REQUIRED_AGENT_TYPES.map((agentType) => (
                <div key={agentType.type} className="space-y-2">
                  <Label
                    htmlFor={`agent-${agentType.type}`}
                    className="text-sm font-medium"
                  >
                    {agentType.label}
                  </Label>
                  {departmentAgents.filter(
                    (agent: Agent) => agent.type === agentType.type
                  ).length > 0 ? (
                    <Select
                      value={formData.agents?.[agentType.type] || ""}
                      onValueChange={(value) =>
                        handleAgentChange(agentType.type, value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={`Select ${agentType.label}`}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-agents-available" disabled>
                          No {agentType.label.toLowerCase()} available
                        </SelectItem>
                        {departmentAgents
                          .filter(
                            (agent: Agent) => agent.type === agentType.type
                          )
                          .map((agent: Agent) => (
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
                          No {agentType.label.toLowerCase()} available for this
                          department. You'll need to create agents of this type
                          first.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
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

          {errors.agents && (
            <p className="text-sm text-destructive">{errors.agents}</p>
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
