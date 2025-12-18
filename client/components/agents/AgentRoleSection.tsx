/**
 * AgentRoleSection.tsx
 * Role selection section component for Agent
 */
"use client";

import * as React from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_ROLES } from "@/components/common/forms/AgentRolePicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StepStatus = "pending" | "active" | "completed";

export interface AgentRoleSectionProps {
  // Data
  selectedRoleId: string;
  selectedModelId?: string | undefined;
  modelMapping?:
    | Record<
        string,
        {
          input_modalities?: string[] | null;
          output_modalities?: string[] | null;
        }
      >
    | undefined;

  // Callbacks
  onRoleChange: (roleId: string) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

// Helper to get required modalities for a role
const getRequiredModalitiesForRole = (
  roleId: string,
): {
  input: string[];
  output: string[];
} => {
  switch (roleId) {
    case "simulation-text":
    case "hint":
    case "question":
    case "outline":
    case "scenario":
    case "grade":
    case "document":
    case "classify":
    case "eval":
      return { input: ["text"], output: ["text"] };
    case "simulation-voice":
      return { input: ["text", "audio"], output: ["text", "audio"] };
    case "image":
      return { input: [], output: ["image"] };
    case "video":
      return { input: [], output: ["video"] };
    default:
      return { input: ["text"], output: ["text"] };
  }
};

export function AgentRoleSection({
  selectedRoleId,
  selectedModelId,
  modelMapping,
  onRoleChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: AgentRoleSectionProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter roles based on selected model capabilities
  const filteredRoles = React.useMemo(() => {
    let roles = [...AGENT_ROLES];

    // If a model is selected, filter roles based on model capabilities
    if (selectedModelId && modelMapping && selectedModelId in modelMapping) {
      const modelInfo = modelMapping[selectedModelId];
      if (!modelInfo) return roles; // Early return if undefined
      const modelInputMods = modelInfo.input_modalities || [];
      const modelOutputMods = modelInfo.output_modalities || [];

      // Special rule: Audio models (with both audio input and output) should only work with simulation-voice
      const hasAudioInput = modelInputMods.includes("audio");
      const hasAudioOutput = modelOutputMods.includes("audio");
      const isAudioModel = hasAudioInput && hasAudioOutput;

      roles = roles.filter((role) => {
        // If audio model, only allow simulation-voice
        if (isAudioModel) {
          return role.id === "simulation-voice";
        }

        const requiredModalities = getRequiredModalitiesForRole(role.id);

        // Check if model supports required input modalities
        const hasRequiredInput =
          requiredModalities.input.length === 0 ||
          requiredModalities.input.every((mod) => modelInputMods.includes(mod));

        // Check if model supports required output modalities
        const hasRequiredOutput =
          requiredModalities.output.length === 0 ||
          requiredModalities.output.every((mod) =>
            modelOutputMods.includes(mod),
          );

        return hasRequiredInput && hasRequiredOutput;
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      roles = roles.filter(
        (role) =>
          role.name?.toLowerCase().includes(searchLower) ||
          role.description?.toLowerCase().includes(searchLower),
      );
    }

    // Sort: selected role first, then by name
    return roles.sort((a, b) => {
      if (a.id === selectedRoleId) return -1;
      if (b.id === selectedRoleId) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [searchTerm, selectedRoleId, selectedModelId, modelMapping]);

  const handleSelect = (roleId: string) => {
    if (isReadonly) return;
    // Allow unselecting by clicking the same role again
    if (roleId === selectedRoleId) {
      onRoleChange("");
    } else {
      onRoleChange(roleId);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredRoles.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No roles found. Try adjusting your search.
            </div>
          ) : (
            filteredRoles.map((role) => {
              const isSelected = role.id === selectedRoleId;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleSelect(role.id)}
                  disabled={isReadonly}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent",
                  )}
                >
                  {/* Check icon - top right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm leading-tight">
                        {role.name}
                      </h3>
                      {role.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
