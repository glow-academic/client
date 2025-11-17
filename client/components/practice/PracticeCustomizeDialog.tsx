"use client";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { PersonaPicker } from "@/components/common/forms/PersonaPicker";
import { SimulationPicker } from "@/components/common/forms/SimulationPicker";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Infinity, Target } from "lucide-react";

type ProfileItem = {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: "superadmin" | "admin" | "instructional" | "ta" | "guest";
  active: boolean;
  viewedIntro: boolean;
  viewedChat: boolean;
  defaultProfile: boolean;
  reqPerDay: number | null;
  lastLogin: string;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
  primaryDepartmentId: string | null;
};

type ScenarioMappingItem = {
  name: string;
  description: string;
  persona_ids: string[];
};
type ScenarioMapping = Record<string, ScenarioMappingItem>;

type PersonaMappingItem = {
  name: string;
  description: string;
  color: string;
  icon: string;
};

type PersonaMapping = Record<string, PersonaMappingItem>;

// Note: These types are simplified - ParameterSelector expects additional fields
// but we'll cast them appropriately since the API provides the full structure
type ParameterMappingItem = {
  name: string;
  description: string;
  numerical?: boolean;
  document_parameter?: boolean;
};

type ParameterMapping = Record<string, ParameterMappingItem>;

type ParameterItemMappingItem = {
  name: string;
  description: string;
  parameter_id?: string;
  parameter_name?: string;
  value?: string;
};

type ParameterItemMapping = Record<string, ParameterItemMappingItem>;

type SimulationMappingItem = {
  name: string;
  description: string;
};

type SimulationMapping = Record<string, SimulationMappingItem>;

type DepartmentMappingItem = {
  name: string;
  description: string;
};

type DepartmentMapping = Record<string, DepartmentMappingItem>;

import { useMemo, useState } from "react";
import { toast } from "sonner";

interface PracticeCustomizeDialogProps {
  open: boolean;
  onClose: () => void;
  onStartAttempt: (params: {
    simulationId: string;
    personaId?: string;
    parameterItemIds?: string[];
    timeLimit?: number;
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
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [infiniteTimeLimit, setInfiniteTimeLimit] = useState<string>("");
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedParameterItemIds, setSelectedParameterItemIds] = useState<
    string[]
  >([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  // Build valid IDs from mappings (server already filtered to relevant items)
  const validSimulationIds = useMemo(
    () => Object.keys(simulationMapping),
    [simulationMapping]
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
    [filteredPersonaMapping]
  );

  const validParameterItemIds = useMemo(
    () => Object.keys(filteredParameterItemMapping),
    [filteredParameterItemMapping]
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
    [scenarioMapping]
  );

  const personas = useMemo(
    () =>
      Object.entries(personaMapping).map(([id, p]) => ({
        id,
        name: p.name,
      })),
    [personaMapping]
  );

  const handleStartAttempt = async () => {
    const departmentId =
      selectedDepartmentIds.length > 0 ? selectedDepartmentIds[0] : undefined;

    if (isInfiniteMode) {
      if (!selectedSimulationId) {
        toast.error("Please select a simulation");
        return;
      }
      if (!infiniteTimeLimit || parseInt(infiniteTimeLimit) < 1) {
        toast.error("Please enter a valid time limit");
        return;
      }

      onStartAttempt({
        simulationId: selectedSimulationId,
        timeLimit: parseInt(infiniteTimeLimit),
      });
    } else {
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
        s.name.toLowerCase().includes(selectedPersona.name.toLowerCase())
      );

      // Use first available practice simulation (server filtered to practice only)
      const firstSimulationId = validSimulationIds[0];
      if (!firstSimulationId || !baseScenario) {
        toast.error(
          `No practice simulation found for persona "${selectedPersona.name}". Please contact an administrator.`
        );
        return;
      }

      onStartAttempt({
        simulationId: firstSimulationId,
        personaId: selectedPersona.id,
        parameterItemIds: selectedParameterItemIds,
        ...(departmentId && { departmentId }),
      });
    }
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
            {isInfiniteMode
              ? "Start an infinite practice session with a specific simulation. Toggle to Standard Mode to practice with a single target persona."
              : "Practice with a single target persona and specific parameter set in Standard Mode. Toggle to Infinite Mode for extended practice sessions."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Switch */}
          <div className="space-y-2 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="infinite-mode"
                  className="text-sm flex items-center gap-1.5"
                >
                  {isInfiniteMode ? (
                    <>
                      <Infinity className="h-3.5 w-3.5 text-muted-foreground" />
                      Infinite Mode
                    </>
                  ) : (
                    <>
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      Standard Mode
                    </>
                  )}
                </Label>
                <Switch
                  id="infinite-mode"
                  checked={isInfiniteMode}
                  onCheckedChange={setIsInfiniteMode}
                  data-testid="practice-mode-switch"
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                {isInfiniteMode
                  ? "Start an infinite practice session with a specific simulation. Toggle to view Standard Mode."
                  : "Practice with a single target persona and specific parameter set. Toggle to view Infinite Mode."}
              </p>
            </div>
          </div>

          {isInfiniteMode ? (
            <div className="grid gap-4">
              <div
                className="grid gap-2"
                data-testid="practice-simulation-picker"
              >
                <SimulationPicker
                  simulationMapping={simulationMapping}
                  validSimulationIds={validSimulationIds}
                  selectedSimulationIds={
                    selectedSimulationId ? [selectedSimulationId] : []
                  }
                  onSelect={(ids) => {
                    setSelectedSimulationId(ids[0] || "");
                  }}
                  multiSelect={false}
                  label="Start Simulation"
                  placeholder="Choose a practice simulation"
                  description="Select a practice simulation to start in infinite mode."
                  hideSelectedChips={true}
                  showLabel={true}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="infinite-time-limit">
                  Time Limit (minutes)
                </Label>
                <Input
                  id="infinite-time-limit"
                  type="number"
                  min={1}
                  required
                  placeholder="e.g. 15"
                  value={infiniteTimeLimit}
                  onChange={(e) => setInfiniteTimeLimit(e.target.value)}
                  data-testid="practice-time-limit-input"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <div
                className="grid gap-2"
                data-testid="practice-department-picker"
              >
                <Label>Department</Label>
                <DepartmentPicker
                  mapping={departmentMapping}
                  validIds={validDepartmentIds}
                  selectedIds={selectedDepartmentIds}
                  onSelect={setSelectedDepartmentIds}
                  multiSelect={false}
                  placeholder="Select department (optional)"
                />
              </div>
              <div className="grid gap-2" data-testid="practice-persona-picker">
                <PersonaPicker
                  mapping={filteredPersonaMapping}
                  validIds={validPersonaIds}
                  selectedIds={selectedPersonaIds}
                  onSelect={setSelectedPersonaIds}
                  multiSelect={false}
                  label="Target Persona"
                  description="Choose the target persona you'll practice with in standard mode."
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
                  parameterItemMapping={
                    filteredParameterItemMapping as Parameters<
                      typeof ParameterSelector
                    >[0]["parameterItemMapping"]
                  }
                  validParameterItemIds={validParameterItemIds}
                  selectedParameterItemIds={selectedParameterItemIds}
                  onParameterItemIdsChange={setSelectedParameterItemIds}
                />
              </div>
            </div>
          )}
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
