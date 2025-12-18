/**
 * ParameterConfigurationSection.tsx
 * Parameter configuration section component for selecting parameter types
 */
"use client";

import { Check, FileText, PlayCircle, Users, Video } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ParameterConfigurationSectionProps {
  // Data
  simulation_parameter: boolean;
  scenario_parameter: boolean;
  video_parameter: boolean;
  document_parameter: boolean;
  persona_parameter: boolean;

  // Callbacks
  onScenarioParameterChange: (enabled: boolean) => void;
  onVideoParameterChange: (enabled: boolean) => void;
  onDocumentParameterChange: (enabled: boolean) => void;
  onPersonaParameterChange: (enabled: boolean) => void;

  // UI State
  isReadonly: boolean;
  stepStatus?: "pending" | "active" | "completed";
}

export function ParameterConfigurationSection({
  simulation_parameter,
  scenario_parameter,
  video_parameter,
  document_parameter,
  persona_parameter,
  onScenarioParameterChange,
  onVideoParameterChange,
  onDocumentParameterChange,
  onPersonaParameterChange,
  isReadonly,
  stepStatus = "active",
}: ParameterConfigurationSectionProps) {
  const isCompleted = stepStatus === "completed";

  return (
    <Card className="transition-all">
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              isCompleted
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {isCompleted ? <Check className="w-4 h-4" /> : <span>2</span>}
          </div>
          <div>
            <CardTitle className="text-lg">Parameter Configuration</CardTitle>
            <CardDescription>
              Configure which parameter types this parameter applies to
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6">
        {simulation_parameter === true ? (
          <>
            {/* Scenario Parameter Switch */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="scenario_parameter"
                  className="text-sm flex items-center gap-1.5"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Scenario Parameter
                </Label>
                <Switch
                  id="scenario_parameter"
                  data-testid="switch-parameter-scenario"
                  checked={scenario_parameter}
                  onCheckedChange={onScenarioParameterChange}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Enable for scenario analysis (links populated after-the-fact)
              </p>
            </div>

            {/* Video Parameter Switch */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="video_parameter"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Video className="h-3.5 w-3.5 text-muted-foreground" />
                  Video Parameter
                </Label>
                <Switch
                  id="video_parameter"
                  data-testid="switch-parameter-video"
                  checked={video_parameter}
                  onCheckedChange={onVideoParameterChange}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Enable for video analysis (links populated after-the-fact)
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Persona Parameter Switch */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="persona_parameter"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Persona Parameter
                </Label>
                <Switch
                  id="persona_parameter"
                  data-testid="switch-parameter-persona"
                  checked={persona_parameter}
                  onCheckedChange={onPersonaParameterChange}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Link this parameter to specific personas
              </p>
            </div>

            {/* Document Parameter Switch */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="document_parameter"
                  className="text-sm flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Document Parameter
                </Label>
                <Switch
                  id="document_parameter"
                  data-testid="switch-parameter-document"
                  checked={document_parameter}
                  onCheckedChange={onDocumentParameterChange}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Link this parameter to specific documents
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
