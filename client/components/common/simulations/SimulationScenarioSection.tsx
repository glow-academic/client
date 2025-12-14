/**
 * SimulationScenarioSection.tsx
 * Reusable scenario configuration section component for individual scenarios in simulations
 */
"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  FileText,
  Lightbulb,
  Mic,
  Pencil,
  Power,
  Text,
  Trash2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { cn } from "@/lib/utils";
import type { ContentItem } from "./SimulationContentTable";

type StepStatus = "pending" | "active" | "completed";

export interface SimulationScenarioSectionProps {
  // Data
  item: ContentItem;
  position: number;
  totalItems: number;
  rubricMapping: Record<string, { name: string; description?: string }>;
  validRubricIds: string[];

  // Callbacks
  onActiveToggle: (contentId: string, active: boolean) => void;
  onMoveUp: (contentId: string) => void;
  onMoveDown: (contentId: string) => void;
  onRemove: (contentId: string) => void;
  onEditScenario?: (scenarioId: string) => void;
  onShowProblemStatementToggle?: (contentId: string, enabled: boolean) => void;
  onShowObjectivesToggle?: (contentId: string, enabled: boolean) => void;
  onShowImageToggle?: (contentId: string, enabled: boolean) => void;
  onHintsToggle?: (contentId: string, enabled: boolean) => void;
  onCopyPasteToggle?: (contentId: string, enabled: boolean) => void;
  onAudioToggle?: (contentId: string, enabled: boolean) => void;
  onTextToggle?: (contentId: string, enabled: boolean) => void;
  onRubricChange?: (contentId: string, rubricId: string | null) => void;
  onTimeLimitChange?: (contentId: string, timeLimitMinutes: number | null) => void;

  // UI State
  readonly?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isEditMode?: boolean;
}

export function SimulationScenarioSection({
  item,
  position,
  totalItems,
  rubricMapping,
  validRubricIds,
  onActiveToggle,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEditScenario,
  onShowProblemStatementToggle,
  onShowObjectivesToggle,
  onShowImageToggle,
  onHintsToggle,
  onCopyPasteToggle,
  onAudioToggle,
  onTextToggle,
  onRubricChange,
  onTimeLimitChange,
  readonly = false,
  stepStatus = "active",
  stepNumber,
  isEditMode = false,
}: SimulationScenarioSectionProps) {
  const contentId = `${item.type}:${item.id}`;
  const canMoveUp = position > 1;
  const canMoveDown = position < totalItems;

  // Convert seconds to minutes for display
  const timeLimitMinutes = item.time_limit_seconds
    ? Math.round(item.time_limit_seconds / 60)
    : null;

  // Use stepNumber if provided, otherwise fall back to position
  const displayNumber = stepNumber ?? position;

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "transition-all",
          !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
          !isEditMode && stepStatus === "pending" && "opacity-50"
        )}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                stepStatus === "completed"
                  ? "bg-green-500 text-white"
                  : stepStatus === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              )}
            >
              {stepStatus === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                <span>{displayNumber}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="truncate">{item.title}</span>
                {item.isNew && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0">
                    NEW
                  </span>
                )}
              </CardTitle>
              {item.description && (
                <CardDescription className="line-clamp-2">
                  {item.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onMoveUp(contentId)}
                  disabled={!canMoveUp || readonly}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Move Up</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onMoveDown(contentId)}
                  disabled={!canMoveDown || readonly}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Move Down</p>
              </TooltipContent>
            </Tooltip>
            {onEditScenario && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEditScenario(item.id)}
                    disabled={readonly}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Scenario</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => onRemove(contentId)}
                  disabled={readonly}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor={`${contentId}-active`}
                className="text-sm flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Enable or disable this scenario
              </p>
            </div>
            <Switch
              id={`${contentId}-active`}
              checked={item.active}
              onCheckedChange={(checked) => onActiveToggle(contentId, checked)}
              disabled={readonly}
            />
          </div>

          {/* Show Fields Section */}
          <div className="space-y-3">
            <Label className="text-sm flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              Display Options
            </Label>
            <div className="space-y-3 pl-5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`${contentId}-show-problem`}
                  className="text-sm font-normal"
                >
                  Problem Statement
                </Label>
                <Switch
                  id={`${contentId}-show-problem`}
                  checked={item.show_problem_statement ?? true}
                  onCheckedChange={(checked) =>
                    onShowProblemStatementToggle?.(contentId, checked)
                  }
                  disabled={readonly || !onShowProblemStatementToggle}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`${contentId}-show-objectives`}
                  className="text-sm font-normal"
                >
                  Objectives
                </Label>
                <Switch
                  id={`${contentId}-show-objectives`}
                  checked={item.show_objectives ?? true}
                  onCheckedChange={(checked) =>
                    onShowObjectivesToggle?.(contentId, checked)
                  }
                  disabled={readonly || !onShowObjectivesToggle}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`${contentId}-show-image`}
                  className="text-sm font-normal"
                >
                  Image
                </Label>
                <Switch
                  id={`${contentId}-show-image`}
                  checked={item.show_image ?? true}
                  onCheckedChange={(checked) =>
                    onShowImageToggle?.(contentId, checked)
                  }
                  disabled={readonly || !onShowImageToggle}
                />
              </div>
            </div>
          </div>

          {/* Hints Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor={`${contentId}-hints`}
                className="text-sm flex items-center gap-1.5"
              >
                <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                Hints
              </Label>
              <p className="text-xs text-muted-foreground">
                Provide hints to help students progress
              </p>
            </div>
            <Switch
              id={`${contentId}-hints`}
              checked={item.hints_enabled ?? false}
              onCheckedChange={(checked) =>
                onHintsToggle?.(contentId, checked)
              }
              disabled={readonly || !onHintsToggle}
            />
          </div>

          {/* Copy/Paste Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor={`${contentId}-copy-paste`}
                className="text-sm flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                Copy/Paste
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow students to copy and paste text
              </p>
            </div>
            <Switch
              id={`${contentId}-copy-paste`}
              checked={item.copy_paste_allowed ?? false}
              onCheckedChange={(checked) =>
                onCopyPasteToggle?.(contentId, checked)
              }
              disabled={readonly || !onCopyPasteToggle}
            />
          </div>

          {/* Modality Section */}
          <div className="space-y-3">
            <Label className="text-sm flex items-center gap-1.5">
              <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              Input Modality
            </Label>
            <div className="space-y-3 pl-5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`${contentId}-text`}
                  className="text-sm font-normal flex items-center gap-1.5"
                >
                  <Text className="h-3 w-3 text-muted-foreground" />
                  Text
                </Label>
                <Switch
                  id={`${contentId}-text`}
                  checked={item.text_enabled ?? true}
                  onCheckedChange={(checked) =>
                    onTextToggle?.(contentId, checked)
                  }
                  disabled={readonly || !onTextToggle}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`${contentId}-audio`}
                  className="text-sm font-normal flex items-center gap-1.5"
                >
                  <Mic className="h-3 w-3 text-muted-foreground" />
                  Audio
                </Label>
                <Switch
                  id={`${contentId}-audio`}
                  checked={item.audio_enabled ?? false}
                  onCheckedChange={(checked) =>
                    onAudioToggle?.(contentId, checked)
                  }
                  disabled={readonly || !onAudioToggle}
                />
              </div>
            </div>
          </div>

          {/* Rubric Picker */}
          <div className="space-y-2">
            <Label htmlFor={`${contentId}-rubric`} className="text-sm">
              Rubric
            </Label>
            {readonly ? (
              <p className="text-sm text-muted-foreground">
                {item.rubric_id && rubricMapping[item.rubric_id]
                  ? rubricMapping[item.rubric_id]?.name || "None"
                  : "None"}
              </p>
            ) : (
              <GenericPicker
                items={rubricMapping}
                itemIds={validRubricIds}
                selectedIds={item.rubric_id ? [item.rubric_id] : []}
                onSelect={(ids) =>
                  onRubricChange?.(contentId, ids[0] || null)
                }
                getId={(rubric) => (rubric as unknown as { id: string }).id}
                getLabel={(rubric) => rubric.name || ""}
                getSearchText={(rubric) =>
                  `${rubric.name} ${rubric.description || ""}`
                }
                placeholder="Select rubric..."
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            )}
          </div>

          {/* Time Limit */}
          <div className="space-y-2">
            <Label
              htmlFor={`${contentId}-time-limit`}
              className="text-sm flex items-center gap-1.5"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Time Limit (minutes)
            </Label>
            {readonly ? (
              <p className="text-sm text-muted-foreground">
                {timeLimitMinutes ? `${timeLimitMinutes} min` : "No limit"}
              </p>
            ) : (
              <Input
                id={`${contentId}-time-limit`}
                type="number"
                min="1"
                max="120"
                value={timeLimitMinutes || ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? parseInt(e.target.value)
                    : null;
                  onTimeLimitChange?.(contentId, value);
                }}
                placeholder="No limit"
                className="w-full"
                disabled={readonly}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

