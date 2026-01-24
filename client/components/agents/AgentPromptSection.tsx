/**
 * AgentPromptSection.tsx
 * Prompt instructions section component for Agent
 */
"use client";

import type { AgentDetailOut } from "@/app/(main)/engine/agents/a/[agentId]/page";
import UnifiedPromptEditor from "@/components/common/editor/UnifiedPromptEditor";
import {
  PromptInfo,
  PromptPicker,
} from "@/components/common/forms/PromptPicker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Bug, Check, Eye, RotateCcw, Trash2 } from "lucide-react";
import { useMemo } from "react";
import AgentDebugInfo, { type ModelMapping } from "./AgentDebugInfo";

type StepStatus = "pending" | "active" | "completed";

export interface AgentPromptSectionProps {
  // Data
  systemPrompt: string;
  promptId: string | null;
  promptMapping: Record<string, PromptInfo>;
  filteredPromptMapping: Record<string, PromptInfo>;
  hasPromptChanges: boolean;
  resolvedPrompt: {
    promptId: string | null;
    content: string;
  };
  resolvedPromptContent: string;
  editorMode: "editor" | "preview" | "debug";
  isEditMode: boolean;
  agentDetail?: AgentDetailOut;
  profile?: {
    role?: string;
  };

  // Callbacks
  onPromptChange: (prompt: string) => void;
  onPromptIdChange: (promptId: string | null) => void;
  onResetPrompt: () => void;
  onEditorModeChange: (mode: "editor" | "preview" | "debug") => void;
  onDeletePrompt: (promptId: string, isDepartmentSpecific: boolean) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  errors?: {
    systemPrompt?: string;
  };
}

export function AgentPromptSection({
  systemPrompt,
  promptId,
  promptMapping,
  filteredPromptMapping,
  hasPromptChanges,
  editorMode,
  isEditMode,
  agentDetail,
  profile,
  onPromptChange,
  onPromptIdChange,
  onResetPrompt,
  onEditorModeChange,
  onDeletePrompt,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  errors,
}: AgentPromptSectionProps) {
  // Build model mapping from models array (similar to Agent.tsx)
  const modelMapping = useMemo((): ModelMapping => {
    if (!agentDetail?.models || !Array.isArray(agentDetail.models)) {
      return {};
    }
    const mapping: ModelMapping = {};
    agentDetail.models.forEach((model) => {
      if (model.model_id) {
        mapping[model.model_id] = {
          name: model.name || "",
          description: model.description || "",
        };
      }
    });
    return mapping;
  }, [agentDetail?.models]);

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="systemPrompt">System Prompt *</Label>
            <div className="flex gap-2">
              {isEditMode &&
                agentDetail &&
                filteredPromptMapping &&
                (Object.keys(filteredPromptMapping).length > 0 ||
                  (promptMapping && Object.keys(promptMapping).length > 0)) && (
                  <PromptPicker
                    promptMapping={filteredPromptMapping}
                    selectedPromptId={promptId || null}
                    defaultPromptId={agentDetail?.prompt_id || null}
                    onSelect={(selectedPromptId) => {
                      if (
                        selectedPromptId &&
                        filteredPromptMapping[selectedPromptId]
                      ) {
                        const prompt = filteredPromptMapping[selectedPromptId];
                        onPromptIdChange(selectedPromptId);
                        onPromptChange(prompt.system_prompt);
                      } else {
                        onPromptIdChange(null);
                      }
                    }}
                    placeholder="Select prompt..."
                    disabled={isReadonly}
                    buttonClassName="h-8"
                  />
                )}
              {systemPrompt !== undefined && (
                <>
                  {hasPromptChanges && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={onResetPrompt}
                          className="h-8 w-8 p-0"
                          data-testid="btn-reset-changes"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reset to saved prompt</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={
                          editorMode === "preview" ? "default" : "secondary"
                        }
                        size="sm"
                        onClick={() =>
                          onEditorModeChange(
                            editorMode === "preview" ? "editor" : "preview",
                          )
                        }
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Preview</p>
                    </TooltipContent>
                  </Tooltip>
                  {isEditMode && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={
                            editorMode === "debug" ? "default" : "secondary"
                          }
                          size="sm"
                          onClick={() =>
                            onEditorModeChange(
                              editorMode === "debug" ? "editor" : "debug",
                            )
                          }
                          className="h-8 w-8 p-0"
                        >
                          <Bug className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Debug</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {isEditMode &&
                    !isReadonly &&
                    promptId &&
                    filteredPromptMapping[promptId]?.can_delete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const promptInfo =
                                filteredPromptMapping[promptId];
                              if (!promptInfo) return;
                              onDeletePrompt(
                                promptId,
                                !!(
                                  promptInfo.department_ids &&
                                  promptInfo.department_ids.length > 0
                                ),
                              );
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                </>
              )}
            </div>
          </div>
          {systemPrompt !== undefined ? (
            <div className="h-[500px]" data-testid="editor-system-prompt">
              <UnifiedPromptEditor
                value={systemPrompt || ""}
                onChange={(value) => {
                  onPromptChange(value);
                  // Clear promptId when editing, indicating new prompt
                  onPromptIdChange(null);
                }}
                placeholder="System prompt that defines how the agent should behave and respond. You can use markdown formatting."
                className="h-full"
                debugContent={
                  isEditMode &&
                  agentDetail &&
                  profile?.role === "superadmin" &&
                  agentDetail.debug_info &&
                  Array.isArray(agentDetail.debug_info) ? (
                    <AgentDebugInfo
                      debugInfo={
                        agentDetail.debug_info && Array.isArray(agentDetail.debug_info)
                          ? agentDetail.debug_info
                              .filter((item): item is { created_at: string; model_id: string; content: string } => 
                                !!item.created_at && !!item.model_id && !!item.content
                              )
                              .map((item) => ({
                                created_at: item.created_at!,
                                model_id: item.model_id!,
                                content: item.content!,
                              }))
                          : []
                      }
                      modelMapping={modelMapping}
                    />
                  ) : undefined
                }
                activeMode={editorMode}
              />
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            This prompt defines the agent's behavior and personality in
            conversations. You can use markdown formatting for better
            organization.
          </p>
          {errors?.systemPrompt && (
            <p className="text-sm text-destructive">{errors.systemPrompt}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
