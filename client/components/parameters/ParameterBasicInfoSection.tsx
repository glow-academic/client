/**
 * ParameterBasicInfoSection.tsx
 * Basic information section component for Parameter
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, PlayCircle, Power } from "lucide-react";

type MappingItem = {
  name: string;
  description: string;
  entity_id: string;
  entity_type: string;
};

export interface ParameterBasicInfoSectionProps {
  // Data
  name: string;
  description: string;
  departmentIds: string[] | null;
  validDepartmentIds: string[];
  departmentMapping: Record<string, MappingItem>;
  active: boolean;
  simulation_parameter: boolean;
  document_parameter: boolean;
  persona_parameter: boolean;
  scenario_parameter: boolean;
  video_parameter: boolean;

  // Callbacks
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onDepartmentIdsChange: (ids: string[] | null) => void;
  onActiveChange: (active: boolean) => void;
  onSimulationParameterChange: (enabled: boolean) => void;
  onDocumentParameterChange: (enabled: boolean) => void;
  onPersonaParameterChange: (enabled: boolean) => void;
  onScenarioParameterChange: (enabled: boolean) => void;
  onVideoParameterChange: (enabled: boolean) => void;

  // UI State
  isReadonly: boolean;
  stepStatus?: "pending" | "active" | "completed";
  defaultName?: string;
}

export function ParameterBasicInfoSection({
  name,
  description,
  departmentIds,
  validDepartmentIds,
  departmentMapping,
  active,
  simulation_parameter,
  onNameChange,
  onDescriptionChange,
  onDepartmentIdsChange,
  onActiveChange,
  onSimulationParameterChange,
  onDocumentParameterChange,
  onPersonaParameterChange,
  onScenarioParameterChange,
  onVideoParameterChange,
  isReadonly,
  stepStatus = "active",
  defaultName = "New Parameter",
}: ParameterBasicInfoSectionProps) {
  const isCompleted = stepStatus === "completed";

  return (
    <Card className="transition-all">
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
            {isCompleted ? <Check className="w-4 h-4" /> : <span>1</span>}
          </div>
          <div className="flex-1">
            <input
              type="text"
              id="name"
              data-testid="input-parameter-name"
              value={name || ""}
              onChange={(e) => onNameChange(e.target.value)}
              onFocus={(e) => {
                if (e.target.value === defaultName) {
                  e.target.select();
                }
              }}
              onBlur={(e) => {
                // If empty on blur, revert to default name
                if (!e.target.value || e.target.value.trim() === "") {
                  onNameChange(defaultName);
                }
              }}
              className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
              placeholder={defaultName || "e.g., Difficulty Level"}
              disabled={isReadonly}
            />
            <p className="text-xs text-muted-foreground mt-1 px-2">
              {name === defaultName || !name
                ? "Click to edit • Name will be auto-generated if unchanged"
                : "Click to edit"}
            </p>
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-parameter-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Enter a brief description (optional)"
            rows={4}
            disabled={isReadonly}
          />
        </div>

        {/* Department Selection */}
        {validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label>Departments</Label>
            <GenericPicker
              items={departmentMapping}
              itemIds={validDepartmentIds}
              selectedIds={departmentIds || []}
              onSelect={(ids) =>
                onDepartmentIdsChange(ids.length > 0 ? ids : null)
              }
              getId={(dept) => (dept as unknown as { id: string }).id}
              getLabel={(dept) => dept.name || ""}
              getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
              placeholder="All Departments"
              multiSelect={true}
              hideSelectedChips={true}
              disabled={isReadonly}
              buttonClassName="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to make this parameter available to all departments
            </p>
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
                data-testid="switch-parameter-active"
                checked={active}
                onCheckedChange={onActiveChange}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive parameters will not be available for scenarios
            </p>
          </div>
        </div>

        {/* Simulation Parameter Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="simulation_parameter"
                className="text-sm flex items-center gap-1.5"
              >
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Simulation Parameter
              </Label>
              <Switch
                id="simulation_parameter"
                data-testid="switch-parameter-simulation"
                checked={simulation_parameter}
                onCheckedChange={(checked) => {
                  onSimulationParameterChange(checked);
                  // Reset child switches when toggling simulation_parameter
                  if (checked) {
                    onDocumentParameterChange(false);
                    onPersonaParameterChange(false);
                    onScenarioParameterChange(false);
                    onVideoParameterChange(false);
                  }
                }}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Enable to use this parameter for simulation analysis
              (scenarios/videos)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
