/**
 * ParameterFieldSection.tsx
 * Reusable field configuration section component for individual fields in parameters
 */
"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Power,
  ChevronDown,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

type StepStatus = "pending" | "active" | "completed";

export interface ParameterFieldSectionProps {
  // Data
  fieldId: string;
  fieldName: string;
  fieldDescription?: string;
  position: number;
  totalItems: number;
  active: boolean;
  default: boolean;
  isNew?: boolean;

  // Callbacks
  onActiveToggle: (fieldId: string, active: boolean) => void;
  onDefaultToggle: (fieldId: string, isDefault: boolean) => void;
  onMoveUp: (fieldId: string) => void;
  onMoveDown: (fieldId: string) => void;

  // UI State
  readonly?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isEditMode?: boolean;
  showDefaultSwitch?: boolean;

  // Accordion props
  accordionValue?: string;
  isAccordionOpen?: boolean;
  onAccordionToggle?: (open: boolean) => void;
}

export function ParameterFieldSection({
  fieldId,
  fieldName,
  fieldDescription,
  position,
  totalItems,
  active,
  default: isDefault,
  isNew = false,
  onActiveToggle,
  onDefaultToggle,
  onMoveUp,
  onMoveDown,
  readonly = false,
  stepStatus = "active",
  stepNumber,
  isEditMode = false,
  showDefaultSwitch = true,
  accordionValue,
  isAccordionOpen = false,
  onAccordionToggle,
}: ParameterFieldSectionProps) {
  const canMoveUp = position > 1;
  const canMoveDown = position < totalItems;

  // Use stepNumber if provided, otherwise fall back to position
  const displayNumber = stepNumber ?? position;

  // Use AccordionItem if accordion props are provided
  if (accordionValue && onAccordionToggle !== undefined) {
    return (
      <TooltipProvider>
        <AccordionItem value={accordionValue} className="border-none">
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
                <AccordionTrigger className="flex-1 min-w-0 px-0 hover:no-underline [&>svg]:hidden">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">
                      <span className="truncate">{fieldName}</span>
                      {isNew && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
                          NEW
                        </span>
                      )}
                      {isDefault && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded shrink-0 ml-2">
                          DEFAULT
                        </span>
                      )}
                    </CardTitle>
                    {fieldDescription && (
                      <CardDescription className="line-clamp-2">
                        {fieldDescription}
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
                        onMoveUp(fieldId);
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
                        onMoveDown(fieldId);
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
                          isAccordionOpen && "rotate-180"
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
                {/* Active Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`${fieldId}-active`}
                      className="text-sm flex items-center gap-1.5 min-w-[60px]"
                    >
                      <Power className="h-3.5 w-3.5 text-muted-foreground" />
                      Active
                    </Label>
                    <Switch
                      id={`${fieldId}-active`}
                      checked={active}
                      onCheckedChange={(checked) =>
                        onActiveToggle(fieldId, checked)
                      }
                      disabled={readonly}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Enable or disable this field connection
                  </p>
                </div>

                {/* Default Toggle */}
                {showDefaultSwitch && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`${fieldId}-default`}
                        className="text-sm flex items-center gap-1.5 min-w-[60px]"
                      >
                        <Star className="h-3.5 w-3.5 text-muted-foreground" />
                        Default
                      </Label>
                      <Switch
                        id={`${fieldId}-default`}
                        checked={isDefault}
                        onCheckedChange={(checked) =>
                          onDefaultToggle(fieldId, checked)
                        }
                        disabled={readonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Mark as default field (only one can be default)
                    </p>
                  </div>
                )}
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>
      </TooltipProvider>
    );
  }

  // Fallback to Card layout if accordion props not provided
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
              <CardTitle className="text-lg">
                <span className="truncate">{fieldName}</span>
                {isNew && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
                    NEW
                  </span>
                )}
                {isDefault && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded shrink-0 ml-2">
                    DEFAULT
                  </span>
                )}
              </CardTitle>
              {fieldDescription && (
                <CardDescription className="line-clamp-2">
                  {fieldDescription}
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
                  onClick={() => onMoveUp(fieldId)}
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
                  onClick={() => onMoveDown(fieldId)}
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
          {/* Active Toggle */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`${fieldId}-active`}
                className="text-sm flex items-center gap-1.5 min-w-[60px]"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
              </Label>
              <Switch
                id={`${fieldId}-active`}
                checked={active}
                onCheckedChange={(checked) => onActiveToggle(fieldId, checked)}
                disabled={readonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Enable or disable this field connection
            </p>
          </div>

          {/* Default Toggle */}
          {showDefaultSwitch && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`${fieldId}-default`}
                  className="text-sm flex items-center gap-1.5 min-w-[60px]"
                >
                  <Star className="h-3.5 w-3.5 text-muted-foreground" />
                  Default
                </Label>
                <Switch
                  id={`${fieldId}-default`}
                  checked={isDefault}
                  onCheckedChange={(checked) => onDefaultToggle(fieldId, checked)}
                  disabled={readonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                Mark as default field (only one can be default)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

