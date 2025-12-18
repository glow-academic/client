/**
 * AgentBasicInfoSection.tsx
 * Basic information section component for Agent
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Power } from "lucide-react";

type StepStatus = "pending" | "active" | "completed";

type DepartmentMappingItem = {
  id: string;
  name: string;
  description?: string;
};

export interface AgentBasicInfoSectionProps {
  // Data
  name: string;
  description: string;
  departmentIds: string[];
  validDepartmentIds: string[];
  departmentMapping: Record<string, DepartmentMappingItem>;
  active: boolean;

  // Callbacks
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onActiveChange: (active: boolean) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  errors?: {
    name?: string;
    description?: string;
  };
}

export function AgentBasicInfoSection({
  name,
  description,
  departmentIds,
  validDepartmentIds,
  departmentMapping,
  active,
  onNameChange,
  onDescriptionChange,
  onDepartmentIdsChange,
  onActiveChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  errors,
}: AgentBasicInfoSectionProps) {
  const isCompleted = stepStatus === "completed";

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardContent className="pt-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
              isCompleted
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {isCompleted ? (
              <Check className="w-4 h-4" />
            ) : (
              <span>{stepNumber}</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{stepTitle}</h3>
            <p className="text-sm text-muted-foreground">{stepDescription}</p>
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name *</Label>
          <input
            type="text"
            id="name"
            data-testid="input-agent-name"
            value={name || ""}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Enthusiastic Student Agent"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              errors?.name && "border-destructive",
            )}
            disabled={isReadonly}
            required
          />
          {errors?.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            data-testid="input-agent-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Detailed behavior description and personality traits"
            rows={4}
            className={cn(errors?.description && "border-destructive")}
            disabled={isReadonly}
            required
          />
          {errors?.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
          )}
        </div>

        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {departmentIds !== undefined ? (
              <GenericPicker
                items={departmentMapping}
                itemIds={validDepartmentIds}
                selectedIds={departmentIds || []}
                onSelect={(ids) => onDepartmentIdsChange(ids)}
                getId={(dept) => (dept as unknown as { id: string }).id}
                getLabel={(dept) => dept.name || ""}
                getSearchText={(dept) =>
                  `${dept.name} ${dept.description || ""}`
                }
                placeholder="All Departments"
                disabled={isReadonly}
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            ) : null}
          </div>
        )}

        {/* Active Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="active"
                className="text-sm flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
              </Label>
              <Switch
                id="active"
                checked={active ?? true}
                onCheckedChange={onActiveChange}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive agents will not be available to perform operations for
              departments
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
