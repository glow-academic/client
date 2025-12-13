"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";
import type { OutputOf } from "@/lib/api/types";

// Extract types from API response (single source of truth)
type PracticeOverviewOut = OutputOf<"/api/v3/practice/overview", "post">;
type ScenarioMapping = PracticeOverviewOut["scenario_mapping"];
type PersonaMapping = PracticeOverviewOut["persona_mapping"];
type ParameterMapping = PracticeOverviewOut["parameter_mapping"];
type ParameterItemMapping = PracticeOverviewOut["field_mapping"];
type SimulationMapping = PracticeOverviewOut["simulation_mapping"];
type DepartmentMapping = PracticeOverviewOut["department_mapping"];

import { useMemo, useState } from "react";
import { toast } from "sonner";

interface PracticeCustomizeDialogProps {
  open: boolean;
  onClose: () => void;
  onStartAttempt: (params: {
    simulationId: string;
    personaId?: string;
    parameterItemIds?: string[];
    departmentId?: string;
  }) => void;
  isStartingAttempt: boolean;
  effectiveProfile: ProfileItem | null;
  activeProfile: ProfileItem | null;
  // Entity mappings from parent
  personaMapping: PersonaMapping;
  scenarioMapping: ScenarioMapping;
  parameterMapping: ParameterMapping;
  parameterItemMapping: ParameterItemMapping;
  simulationMapping: SimulationMapping;
  departmentMapping: DepartmentMapping;
  validDepartmentIds: string[];
}

export function PracticeCustomizeDialog({
  open,
  onClose,
  onStartAttempt,
  isStartingAttempt,
  effectiveProfile,
  activeProfile,
  personaMapping,
  scenarioMapping,
  parameterMapping,
  parameterItemMapping,
  simulationMapping,
  departmentMapping,
  validDepartmentIds,
}: PracticeCustomizeDialogProps) {
  // State for the dialog
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    [],
  );

  // Build valid IDs from mappings (server already filtered to relevant items)
  const validSimulationIds = useMemo(
    () => Object.keys(simulationMapping),
    [simulationMapping],
  );

  // Filter personas and parameter items based on selected departments
  const filteredPersonaMapping = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return personaMapping; // Show all if no department selected
    }
    // Filter personas that are available to selected departments
    // This is a simplified filter - in reality, we'd need to check persona_departments junction
    // For now, we'll show all personas and let the backend handle filtering
    return personaMapping;
  }, [personaMapping, selectedDepartmentIds]);

  const filteredParameterItemMapping = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return parameterItemMapping; // Show all if no department selected
    }
    // Filter parameter items that are available to selected departments
    // This is a simplified filter - in reality, we'd need to check parameter_item_departments junction
    // For now, we'll show all parameter items and let the backend handle filtering
    return parameterItemMapping;
  }, [parameterItemMapping, selectedDepartmentIds]);

  const validPersonaIds = useMemo(
    () => Object.keys(filteredPersonaMapping),
    [filteredPersonaMapping],
  );

  const validParameterItemIds = useMemo(
    () => Object.keys(filteredParameterItemMapping),
    [filteredParameterItemMapping],
  );

  // Build arrays from mappings for components that need them
  const scenarios = useMemo(
    () =>
      Object.entries(scenarioMapping).map(([id, sc]) => ({
        id,
        name: sc.name,
        defaultScenario: true, // Server filters to defaults
        personaId:
          sc.persona_ids && sc.persona_ids.length > 0
            ? sc.persona_ids[0]
            : undefined,
      })),
    [scenarioMapping],
  );

  const personas = useMemo(
    () =>
      Object.entries(personaMapping).map(([id, p]) => ({
        id,
        name: p.name,
      })),
    [personaMapping],
  );

  const handleStartAttempt = async () => {
    const departmentId =
      selectedDepartmentIds.length > 0 ? selectedDepartmentIds[0] : undefined;

    const selectedPersonaId = selectedPersonaIds[0];
    if (!selectedPersonaId) {
      toast.error("Please select a persona");
      return;
    }

    const selectedPersona = personas.find((p) => p.id === selectedPersonaId);
    if (!selectedPersona) {
      toast.error("Selected persona not found");
      return;
    }

    // Find base default practice scenario for this persona
    const baseScenario = scenarios.find((s) =>
      s.name.toLowerCase().includes(selectedPersona.name.toLowerCase()),
    );

    // Use first available practice simulation (server filtered to practice only)
    const firstSimulationId = validSimulationIds[0];
    if (!firstSimulationId || !baseScenario) {
      toast.error(
        `No practice simulation found for persona "${selectedPersona.name}". Please contact an administrator.`,
      );
      return;
    }

    onStartAttempt({
      simulationId: firstSimulationId,
      personaId: selectedPersona.id,
      parameterItemIds: selectedParameterItemIds,
      ...(departmentId && { departmentId }),
    });
  };

  const isDisabled = effectiveProfile?.id !== activeProfile?.id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[600px]"
        data-testid="practice-customize-dialog"
      >
        <DialogHeader>
          <DialogTitle>Customize Practice Session</DialogTitle>
          <DialogDescription className="hidden">
            Practice with a single target persona and specific parameter set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-6">
            {validDepartmentIds.length > 1 && (
              <div
                className="grid gap-2"
                data-testid="practice-department-picker"
              >
                <Label>Department</Label>
                <GenericPicker
                  items={departmentMapping}
                  itemIds={validDepartmentIds}
                  selectedIds={selectedDepartmentIds}
                  onSelect={setSelectedDepartmentIds}
                  getId={(dept) => (dept as unknown as { id: string }).id}
                  getLabel={(dept) => dept.name || ""}
                  getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
                  multiSelect={false}
                  placeholder="Select department (optional)"
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                />
              </div>
            )}
            <div className="grid gap-2" data-testid="practice-persona-picker">
              <Label>Target Persona</Label>
              <GenericPicker
                items={filteredPersonaMapping}
                itemIds={validPersonaIds}
                selectedIds={selectedPersonaIds}
                onSelect={setSelectedPersonaIds}
                getId={(item) => {
                  const entry = Object.entries(filteredPersonaMapping).find(([, v]) => v === item);
                  return entry ? entry[0] : "";
                }}
                getLabel={(item) => (item as { name: string }).name || ""}
                getSearchText={(item) => `${(item as { name: string }).name} ${((item as { description?: string }).description) || ""}`}
                multiSelect={false}
                placeholder="Choose the target persona you'll practice with in standard mode."
                buttonClassName="w-full"
              />
            </div>
            <div
              className="grid gap-2"
              data-testid="practice-parameter-selector"
            >
              <ParameterSelector
                parameterMapping={
                  parameterMapping as Parameters<
                    typeof ParameterSelector
                  >[0]["parameterMapping"]
                }
                fieldMapping={
                  filteredParameterItemMapping as Parameters<
                    typeof ParameterSelector
                  >[0]["fieldMapping"]
                }
                validParameterItemIds={validParameterItemIds}
                selectedParameterItemIds={selectedParameterItemIds}
                onParameterItemIdsChange={setSelectedParameterItemIds}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {isDisabled ? (
            <Button className="cursor-not-allowed opacity-70" disabled>
              Unavailable
            </Button>
          ) : (
            <Button
              onClick={handleStartAttempt}
              disabled={isStartingAttempt}
              className="min-w-[120px]"
              data-testid="practice-start-button"
            >
              {isStartingAttempt ? "Starting..." : "Start Practice"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
