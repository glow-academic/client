/**
 * SimulationScenarioSection.tsx
 * Reusable scenario configuration section component for individual scenarios in simulations
 */
"use client";

import { useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Lightbulb,
  Mic,
  Power,
  Text,
  Clock,
  ChevronDown,
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { cn } from "@/lib/utils";
import type { ContentItem } from "./SimulationContentTable";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type StepStatus = "pending" | "active" | "completed";

export interface SimulationScenarioSectionProps {
  // Data
  item: ContentItem;
  position: number;
  totalItems: number;
  rubricMapping: Record<string, { name: string; description?: string }>;
  validRubricIds: string[];
  agentMapping?: Record<string, { name: string; description?: string; roles?: string[] }>;
  validGradeTextAgentIds?: string[];
  validGradeVoiceAgentIds?: string[];

  // Callbacks
  onActiveToggle: (contentId: string, active: boolean) => void;
  onMoveUp: (contentId: string) => void;
  onMoveDown: (contentId: string) => void;
  onRemove: (contentId: string) => void;
  onEditScenario?: (scenarioId: string) => void;
  onHintsToggle?: (contentId: string, enabled: boolean) => void;
  onCopyPasteToggle?: (contentId: string, enabled: boolean) => void;
  onAudioToggle?: (contentId: string, enabled: boolean) => void;
  onTextToggle?: (contentId: string, enabled: boolean) => void;
  onRubricChange?: (contentId: string, rubricId: string | null) => void;
  onRubricGradeAgentsChange?: (
    contentId: string,
    rubricGradeAgents: Array<{
      rubric_id: string;
      grade_text_agent_id: string;
      grade_voice_agent_id?: string | null;
    }>
  ) => void;
  onTimeLimitChange?: (
    contentId: string,
    timeLimitMinutes: number | null,
  ) => void;

  // UI State
  readonly?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isEditMode?: boolean;
  practiceSimulation?: boolean; // Hide hints switch if true

  // Accordion props
  accordionValue?: string;
  isAccordionOpen?: boolean;
  onAccordionToggle?: (open: boolean) => void;
}

export function SimulationScenarioSection({
  item,
  position,
  totalItems,
  rubricMapping,
  validRubricIds,
  agentMapping: _agentMapping = {},
  validGradeTextAgentIds: _validGradeTextAgentIds = [],
  validGradeVoiceAgentIds: _validGradeVoiceAgentIds = [],
  onActiveToggle,
  onMoveUp,
  onMoveDown,
  onHintsToggle,
  onCopyPasteToggle,
  onAudioToggle,
  onTextToggle,
  onRubricChange,
  onRubricGradeAgentsChange: _onRubricGradeAgentsChange,
  onTimeLimitChange,
  readonly = false,
  stepStatus = "active",
  stepNumber,
  isEditMode = false,
  practiceSimulation = false,
  accordionValue,
  isAccordionOpen = false,
  onAccordionToggle,
}: SimulationScenarioSectionProps) {
  const contentId = `${item.type}:${item.id}`;
  const canMoveUp = position > 1;
  const canMoveDown = position < totalItems;

  // Convert seconds to minutes for display
  const timeLimitMinutes = item.time_limit_seconds
    ? Math.round(item.time_limit_seconds / 60)
    : null;
  const hasTimeLimit = timeLimitMinutes !== null && timeLimitMinutes > 0;

  // Use stepNumber if provided, otherwise fall back to position
  const displayNumber = stepNumber ?? position;

  // Conditional rendering flags
  const showHints = practiceSimulation; // Show hints only when practice simulation is true
  const showCopyPaste = item.text_enabled ?? true; // Show when text is enabled
  const hasActiveVideo = item.has_active_video ?? false;

  // Track if we've already auto-selected a rubric to prevent infinite loops
  const hasAutoSelectedRef = useRef<string | null>(null);

  // Auto-select first rubric if validRubricIds has items and rubric_id is not set
  useEffect(() => {
    // If rubric_id is set (not null), reset the ref and don't auto-select
    if (item.rubric_id && item.rubric_id !== null) {
      if (hasAutoSelectedRef.current !== item.rubric_id) {
        hasAutoSelectedRef.current = null; // Reset if different rubric is set
      }
      return;
    }

    // Only auto-select once per contentId, and only if conditions are met
    if (
      !readonly &&
      validRubricIds.length > 0 &&
      (!item.rubric_id || item.rubric_id === null) &&
      hasAutoSelectedRef.current !== contentId &&
      onRubricChange
    ) {
      hasAutoSelectedRef.current = contentId; // Track that we've auto-selected for this contentId
      if (contentId && validRubricIds[0]) {
        onRubricChange(contentId, validRubricIds[0]);
      }
    }
  }, [validRubricIds, item.rubric_id, contentId, readonly, onRubricChange]);

  // Use AccordionItem if accordion props are provided, otherwise use Card
  if (accordionValue && onAccordionToggle !== undefined) {
    return (
      <TooltipProvider>
        <AccordionItem value={accordionValue} className="border-none">
          <Card
            className={cn(
              "transition-all",
              !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
              !isEditMode && stepStatus === "pending" && "opacity-50",
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
                        : "bg-muted",
                  )}
                >
                  {stepStatus === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{displayNumber}</span>
                  )}
                </div>
                <AccordionTrigger className="flex-1 min-w-0 px-0 hover:no-underline [&>svg]:hidden">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">
                      <span className="truncate">{item.title}</span>
                      {item.isNew && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
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
                </AccordionTrigger>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveUp(contentId);
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveDown(contentId);
                      }}
                      disabled={!canMoveDown || readonly}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Move Down</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAccordionToggle?.(!isAccordionOpen);
                      }}
                      disabled={readonly}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          isAccordionOpen && "rotate-180",
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isAccordionOpen ? "Collapse" : "Expand"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>
            <AccordionContent>
              <CardContent className="space-y-6 px-6 pt-0">
                {/* If has_active_video, only show time limit and active switches */}
                {hasActiveVideo ? (
                  <>
                    {/* Active Toggle */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`${contentId}-active`}
                          className="text-sm flex items-center gap-1.5"
                        >
                          <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          Active
                        </Label>
                        <Switch
                          id={`${contentId}-active`}
                          checked={item.active}
                          onCheckedChange={(checked) =>
                            onActiveToggle(contentId, checked)
                          }
                          disabled={readonly}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Enable or disable this scenario
                      </p>
                    </div>

                    {/* Time Limit */}
                    <Collapsible
                      open={hasTimeLimit}
                      onOpenChange={(open) => {
                        if (!open && onTimeLimitChange) {
                          onTimeLimitChange(contentId, null);
                        } else if (open && !hasTimeLimit && onTimeLimitChange) {
                          onTimeLimitChange(contentId, 30); // Default to 30 minutes
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label
                            htmlFor={`${contentId}-time-limit-toggle`}
                            className="text-sm font-medium"
                          >
                            Time Limit
                          </Label>
                          <Switch
                            id={`${contentId}-time-limit-toggle`}
                            checked={hasTimeLimit}
                            onCheckedChange={(checked) => {
                              if (!checked && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else if (
                                checked &&
                                !hasTimeLimit &&
                                onTimeLimitChange
                              ) {
                                onTimeLimitChange(contentId, 30); // Default to 30 minutes
                              }
                            }}
                            disabled={readonly || !onTimeLimitChange}
                          />
                        </div>
                        {!hasTimeLimit && (
                          <p className="text-xs text-muted-foreground pl-6">
                            Set a time limit for this scenario
                          </p>
                        )}
                        <CollapsibleContent>
                          {hasTimeLimit && (
                            <div className="pl-6 pt-1">
                              {readonly ? (
                                <p className="text-sm text-muted-foreground">
                                  {timeLimitMinutes
                                    ? `${timeLimitMinutes} min`
                                    : "No limit"}
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
                                    // If value becomes empty while switch is on, turn off switch
                                    if (
                                      !value &&
                                      hasTimeLimit &&
                                      onTimeLimitChange
                                    ) {
                                      onTimeLimitChange(contentId, null);
                                    } else {
                                      onTimeLimitChange?.(contentId, value);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value
                                      ? parseInt(e.target.value)
                                      : null;
                                    // If blur with empty value while switch is on, turn off switch
                                    if (
                                      !value &&
                                      hasTimeLimit &&
                                      onTimeLimitChange
                                    ) {
                                      onTimeLimitChange(contentId, null);
                                    } else if (value) {
                                      onTimeLimitChange?.(contentId, value);
                                    }
                                  }}
                                  placeholder="Enter minutes"
                                  className="w-full"
                                  disabled={readonly || !onTimeLimitChange}
                                />
                              )}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </>
                ) : (
                  <>
                    {/* Rubric Picker */}
                    <div className="space-y-2">
                      <Label
                        htmlFor={`${contentId}-rubric`}
                        className="text-sm"
                      >
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
                          key={`${contentId}-rubric-${item.rubric_id || "none"}`}
                          items={rubricMapping}
                          itemIds={validRubricIds}
                          selectedIds={
                            item.rubric_id &&
                            rubricMapping[item.rubric_id] &&
                            validRubricIds.includes(item.rubric_id)
                              ? [item.rubric_id]
                              : []
                          }
                          onSelect={(ids) =>
                            onRubricChange?.(contentId, ids[0] || null)
                          }
                          getId={(rubric) =>
                            (rubric as unknown as { id: string }).id
                          }
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

                    {/* Active Toggle */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`${contentId}-active`}
                          className="text-sm flex items-center gap-1.5"
                        >
                          <Power className="h-3.5 w-3.5 text-muted-foreground" />
                          Active
                        </Label>
                        <Switch
                          id={`${contentId}-active`}
                          checked={item.active}
                          onCheckedChange={(checked) =>
                            onActiveToggle(contentId, checked)
                          }
                          disabled={readonly}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Enable or disable this scenario
                      </p>
                    </div>

                    {/* Hints Toggle - Only show if not practice simulation */}
                    {showHints && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`${contentId}-hints`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                            Hints
                          </Label>
                          <Switch
                            id={`${contentId}-hints`}
                            checked={item.hints_enabled ?? false}
                            onCheckedChange={(checked) =>
                              onHintsToggle?.(contentId, checked)
                            }
                            disabled={readonly || !onHintsToggle}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          Provide hints to help students progress
                        </p>
                      </div>
                    )}

                    {/* Text Enabled Toggle */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`${contentId}-text`}
                          className="text-sm flex items-center gap-1.5"
                        >
                          <Text className="h-3.5 w-3.5 text-muted-foreground" />
                          Text Enabled
                        </Label>
                        <Switch
                          id={`${contentId}-text`}
                          checked={item.text_enabled ?? true}
                          onCheckedChange={(checked) => {
                            // Allow both to be off - validation happens on submit
                            onTextToggle?.(contentId, checked);
                          }}
                          disabled={readonly || !onTextToggle}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Allow students to input text responses
                      </p>
                    </div>

                    {/* Copy/Paste Toggle - Only show when text is enabled, placed below text switch */}
                    {showCopyPaste && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={`${contentId}-copy-paste`}
                            className="text-sm flex items-center gap-1.5"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            Copy/Paste
                          </Label>
                          <Switch
                            id={`${contentId}-copy-paste`}
                            checked={item.copy_paste_allowed ?? false}
                            onCheckedChange={(checked) =>
                              onCopyPasteToggle?.(contentId, checked)
                            }
                            disabled={readonly || !onCopyPasteToggle}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">
                          Allow students to copy and paste text
                        </p>
                      </div>
                    )}

                    {/* Audio Enabled Toggle */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`${contentId}-audio`}
                          className="text-sm flex items-center gap-1.5"
                        >
                          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                          Audio Enabled
                        </Label>
                        <Switch
                          id={`${contentId}-audio`}
                          checked={item.audio_enabled ?? false}
                          onCheckedChange={(checked) => {
                            // Allow both to be off - validation happens on submit
                            onAudioToggle?.(contentId, checked);
                          }}
                          disabled={readonly || !onAudioToggle}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        Allow students to input audio responses
                      </p>
                    </div>

                    {/* Time Limit */}
                    <Collapsible
                      open={hasTimeLimit}
                      onOpenChange={(open) => {
                        if (!open && onTimeLimitChange) {
                          onTimeLimitChange(contentId, null);
                        } else if (open && !hasTimeLimit && onTimeLimitChange) {
                          onTimeLimitChange(contentId, 30); // Default to 30 minutes
                        }
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label
                            htmlFor={`${contentId}-time-limit-toggle`}
                            className="text-sm font-medium"
                          >
                            Time Limit
                          </Label>
                          <Switch
                            id={`${contentId}-time-limit-toggle`}
                            checked={hasTimeLimit}
                            onCheckedChange={(checked) => {
                              if (!checked && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else if (
                                checked &&
                                !hasTimeLimit &&
                                onTimeLimitChange
                              ) {
                                onTimeLimitChange(contentId, 30); // Default to 30 minutes
                              }
                            }}
                            disabled={readonly || !onTimeLimitChange}
                          />
                        </div>
                        {!hasTimeLimit && (
                          <p className="text-xs text-muted-foreground pl-6">
                            Set a time limit for this scenario
                          </p>
                        )}
                        <CollapsibleContent>
                          {hasTimeLimit && (
                            <div className="pl-6 pt-1">
                              {readonly ? (
                                <p className="text-sm text-muted-foreground">
                                  {timeLimitMinutes
                                    ? `${timeLimitMinutes} min`
                                    : "No limit"}
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
                                    // If value becomes empty while switch is on, turn off switch
                                    if (
                                      !value &&
                                      hasTimeLimit &&
                                      onTimeLimitChange
                                    ) {
                                      onTimeLimitChange(contentId, null);
                                    } else {
                                      onTimeLimitChange?.(contentId, value);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = e.target.value
                                      ? parseInt(e.target.value)
                                      : null;
                                    // If blur with empty value while switch is on, turn off switch
                                    if (
                                      !value &&
                                      hasTimeLimit &&
                                      onTimeLimitChange
                                    ) {
                                      onTimeLimitChange(contentId, null);
                                    } else if (value) {
                                      onTimeLimitChange?.(contentId, value);
                                    }
                                  }}
                                  placeholder="Enter minutes"
                                  className="w-full"
                                  disabled={readonly || !onTimeLimitChange}
                                />
                              )}
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </TooltipProvider>
    );
  }

  // Fallback to original Card layout if accordion props not provided
  return (
    <TooltipProvider>
      <Card
        className={cn(
          "transition-all",
          !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
          !isEditMode && stepStatus === "pending" && "opacity-50",
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
                    : "bg-muted",
              )}
            >
              {stepStatus === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                <span>{displayNumber}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">
                <span className="truncate">{item.title}</span>
                {item.isNew && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
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
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6">
          {/* If has_active_video, only show time limit and active switches */}
          {hasActiveVideo ? (
            <>
              {/* Active Toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${contentId}-active`}
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                  <Switch
                    id={`${contentId}-active`}
                    checked={item.active}
                    onCheckedChange={(checked) =>
                      onActiveToggle(contentId, checked)
                    }
                    disabled={readonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Enable or disable this scenario
                </p>
              </div>

              {/* Time Limit */}
              <Collapsible
                open={hasTimeLimit}
                onOpenChange={(open) => {
                  if (!open && onTimeLimitChange) {
                    onTimeLimitChange(contentId, null);
                  } else if (open && !hasTimeLimit && onTimeLimitChange) {
                    onTimeLimitChange(contentId, 30); // Default to 30 minutes
                  }
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label
                      htmlFor={`${contentId}-time-limit-toggle`}
                      className="text-sm font-medium"
                    >
                      Time Limit
                    </Label>
                    <Switch
                      id={`${contentId}-time-limit-toggle`}
                      checked={hasTimeLimit}
                      onCheckedChange={(checked) => {
                        if (!checked && onTimeLimitChange) {
                          onTimeLimitChange(contentId, null);
                        } else if (
                          checked &&
                          !hasTimeLimit &&
                          onTimeLimitChange
                        ) {
                          onTimeLimitChange(contentId, 30); // Default to 30 minutes
                        }
                      }}
                      disabled={readonly || !onTimeLimitChange}
                    />
                  </div>
                  {!hasTimeLimit && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Set a time limit for this scenario
                    </p>
                  )}
                  <CollapsibleContent>
                    {hasTimeLimit && (
                      <div className="pl-6 pt-1">
                        {readonly ? (
                          <p className="text-sm text-muted-foreground">
                            {timeLimitMinutes
                              ? `${timeLimitMinutes} min`
                              : "No limit"}
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
                              // If value becomes empty while switch is on, turn off switch
                              if (!value && hasTimeLimit && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else {
                                onTimeLimitChange?.(contentId, value);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value
                                ? parseInt(e.target.value)
                                : null;
                              // If blur with empty value while switch is on, turn off switch
                              if (!value && hasTimeLimit && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else if (value) {
                                onTimeLimitChange?.(contentId, value);
                              }
                            }}
                            placeholder="Enter minutes"
                            className="w-full"
                            disabled={readonly || !onTimeLimitChange}
                          />
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </>
          ) : (
            <>
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
                    key={`${contentId}-rubric-${item.rubric_id || "none"}`}
                    items={rubricMapping}
                    itemIds={validRubricIds}
                    selectedIds={
                      item.rubric_id &&
                      rubricMapping[item.rubric_id] &&
                      validRubricIds.includes(item.rubric_id)
                        ? [item.rubric_id]
                        : []
                    }
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

              {/* Active Toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${contentId}-active`}
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                  <Switch
                    id={`${contentId}-active`}
                    checked={item.active}
                    onCheckedChange={(checked) =>
                      onActiveToggle(contentId, checked)
                    }
                    disabled={readonly}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Enable or disable this scenario
                </p>
              </div>

              {/* Hints Toggle - Only show if not practice simulation */}
              {showHints && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`${contentId}-hints`}
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                      Hints
                    </Label>
                    <Switch
                      id={`${contentId}-hints`}
                      checked={item.hints_enabled ?? false}
                      onCheckedChange={(checked) =>
                        onHintsToggle?.(contentId, checked)
                      }
                      disabled={readonly || !onHintsToggle}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Provide hints to help students progress
                  </p>
                </div>
              )}

              {/* Text Enabled Toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${contentId}-text`}
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Text className="h-3.5 w-3.5 text-muted-foreground" />
                    Text Enabled
                  </Label>
                  <Switch
                    id={`${contentId}-text`}
                    checked={item.text_enabled ?? true}
                    onCheckedChange={(checked) => {
                      // Allow both to be off - validation happens on submit
                      onTextToggle?.(contentId, checked);
                    }}
                    disabled={readonly || !onTextToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Allow students to input text responses
                </p>
              </div>

              {/* Copy/Paste Toggle - Only show when text is enabled, placed below text switch */}
              {showCopyPaste && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`${contentId}-copy-paste`}
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      Copy/Paste
                    </Label>
                    <Switch
                      id={`${contentId}-copy-paste`}
                      checked={item.copy_paste_allowed ?? false}
                      onCheckedChange={(checked) =>
                        onCopyPasteToggle?.(contentId, checked)
                      }
                      disabled={readonly || !onCopyPasteToggle}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Allow students to copy and paste text
                  </p>
                </div>
              )}

              {/* Audio Enabled Toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`${contentId}-audio`}
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    Audio Enabled
                  </Label>
                  <Switch
                    id={`${contentId}-audio`}
                    checked={item.audio_enabled ?? false}
                    onCheckedChange={(checked) => {
                      // Allow both to be off - validation happens on submit
                      onAudioToggle?.(contentId, checked);
                    }}
                    disabled={readonly || !onAudioToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  Allow students to input audio responses
                </p>
              </div>

              {/* Time Limit */}
              <Collapsible
                open={hasTimeLimit}
                onOpenChange={(open) => {
                  if (!open && onTimeLimitChange) {
                    onTimeLimitChange(contentId, null);
                  } else if (open && !hasTimeLimit && onTimeLimitChange) {
                    onTimeLimitChange(contentId, 30); // Default to 30 minutes
                  }
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label
                      htmlFor={`${contentId}-time-limit-toggle`}
                      className="text-sm font-medium"
                    >
                      Time Limit
                    </Label>
                    <Switch
                      id={`${contentId}-time-limit-toggle`}
                      checked={hasTimeLimit}
                      onCheckedChange={(checked) => {
                        if (!checked && onTimeLimitChange) {
                          onTimeLimitChange(contentId, null);
                        } else if (
                          checked &&
                          !hasTimeLimit &&
                          onTimeLimitChange
                        ) {
                          onTimeLimitChange(contentId, 30); // Default to 30 minutes
                        }
                      }}
                      disabled={readonly || !onTimeLimitChange}
                    />
                  </div>
                  {!hasTimeLimit && (
                    <p className="text-xs text-muted-foreground pl-6">
                      Set a time limit for this scenario
                    </p>
                  )}
                  <CollapsibleContent>
                    {hasTimeLimit && (
                      <div className="pl-6 pt-1">
                        {readonly ? (
                          <p className="text-sm text-muted-foreground">
                            {timeLimitMinutes
                              ? `${timeLimitMinutes} min`
                              : "No limit"}
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
                              // If value becomes empty while switch is on, turn off switch
                              if (!value && hasTimeLimit && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else {
                                onTimeLimitChange?.(contentId, value);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value
                                ? parseInt(e.target.value)
                                : null;
                              // If blur with empty value while switch is on, turn off switch
                              if (!value && hasTimeLimit && onTimeLimitChange) {
                                onTimeLimitChange(contentId, null);
                              } else if (value) {
                                onTimeLimitChange?.(contentId, value);
                              }
                            }}
                            placeholder="Enter minutes"
                            className="w-full"
                            disabled={readonly || !onTimeLimitChange}
                          />
                        )}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
