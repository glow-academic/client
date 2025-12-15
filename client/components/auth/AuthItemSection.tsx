/**
 * AuthItemSection.tsx
 * Reusable auth item configuration section component for individual auth items
 */
"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Power,
  ChevronDown,
  Lock,
  LockOpen,
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
import { Textarea } from "@/components/ui/textarea";
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

export interface AuthItemSectionProps {
  // Data
  authItemId: string;
  name: string;
  description: string;
  position: number;
  totalItems: number;
  active: boolean;
  encrypted: boolean;
  isNew?: boolean;

  // Callbacks
  onNameChange: (authItemId: string, name: string) => void;
  onDescriptionChange: (authItemId: string, description: string) => void;
  onActiveToggle: (authItemId: string, active: boolean) => void;
  onEncryptedToggle: (authItemId: string, encrypted: boolean) => void;
  onMoveUp: (authItemId: string) => void;
  onMoveDown: (authItemId: string) => void;

  // UI State
  readonly?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isEditMode?: boolean;

  // Accordion props
  accordionValue?: string;
  isAccordionOpen?: boolean;
  onAccordionToggle?: (open: boolean) => void;
}

export function AuthItemSection({
  authItemId,
  name,
  description,
  position,
  totalItems,
  active,
  encrypted,
  isNew = false,
  onNameChange,
  onDescriptionChange,
  onActiveToggle,
  onEncryptedToggle,
  onMoveUp,
  onMoveDown,
  readonly = false,
  stepStatus = "active",
  stepNumber,
  isEditMode = false,
  accordionValue,
  isAccordionOpen = false,
  onAccordionToggle,
}: AuthItemSectionProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const [editedDescription, setEditedDescription] = useState(description);

  const canMoveUp = position > 1;
  const canMoveDown = position < totalItems;

  // Use stepNumber if provided, otherwise fall back to position
  const displayNumber = stepNumber ?? position;

  // Sync local state with props
  if (editedName !== name && !isEditingName) {
    setEditedName(name);
  }
  if (editedDescription !== description && !isEditingDescription) {
    setEditedDescription(description);
  }

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editedName.trim() !== name) {
      onNameChange(authItemId, editedName.trim() || name);
    } else {
      setEditedName(name);
    }
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (editedDescription.trim() !== description) {
      onDescriptionChange(authItemId, editedDescription.trim() || description);
    } else {
      setEditedDescription(description);
    }
  };

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
                      {isEditingName ? (
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onBlur={handleNameBlur}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleNameBlur();
                            }
                            if (e.key === "Escape") {
                              setEditedName(name);
                              setIsEditingName(false);
                            }
                          }}
                          className={cn(
                            "w-full text-lg font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                          )}
                          autoFocus
                          disabled={readonly}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="truncate cursor-text hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                          onClick={(e) => {
                            if (!readonly) {
                              e.stopPropagation();
                              setIsEditingName(true);
                            }
                          }}
                        >
                          {name || "Unnamed Item"}
                        </span>
                      )}
                      {isNew && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
                          NEW
                        </span>
                      )}
                    </CardTitle>
                    {isEditingDescription ? (
                      <Textarea
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        onBlur={handleDescriptionBlur}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditedDescription(description);
                            setIsEditingDescription(false);
                          }
                        }}
                        className="mt-2 min-h-[60px] resize-none"
                        placeholder="Item description"
                        disabled={readonly}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <CardDescription
                        className="line-clamp-2 cursor-text hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                        onClick={(e) => {
                          if (!readonly) {
                            e.stopPropagation();
                            setIsEditingDescription(true);
                          }
                        }}
                      >
                        {description || "Click to add description"}
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
                        onMoveUp(authItemId);
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
                        onMoveDown(authItemId);
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
                      htmlFor={`${authItemId}-active`}
                      className="text-sm flex items-center gap-1.5 min-w-[60px]"
                    >
                      <Power className="h-3.5 w-3.5 text-muted-foreground" />
                      Active
                    </Label>
                    <Switch
                      id={`${authItemId}-active`}
                      checked={active}
                      onCheckedChange={(checked) =>
                        onActiveToggle(authItemId, checked)
                      }
                      disabled={readonly}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Enable or disable this auth item
                  </p>
                </div>

                {/* Encrypted Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`${authItemId}-encrypted`}
                      className="text-sm flex items-center gap-1.5 min-w-[60px]"
                    >
                      {encrypted ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      Encrypted
                    </Label>
                    <Switch
                      id={`${authItemId}-encrypted`}
                      checked={encrypted}
                      onCheckedChange={(checked) =>
                        onEncryptedToggle(authItemId, checked)
                      }
                      disabled={readonly || !isNew}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    {encrypted
                      ? "This item is encrypted. Keys are managed on the Settings page."
                      : "This item stores plain text values."}
                    {!isNew && (
                      <span className="block mt-1 text-orange-600">
                        Encryption status cannot be changed after creation.
                      </span>
                    )}
                  </p>
                </div>
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
                {isEditingName ? (
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleNameBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleNameBlur();
                      }
                      if (e.key === "Escape") {
                        setEditedName(name);
                        setIsEditingName(false);
                      }
                    }}
                    className={cn(
                      "w-full text-lg font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                    )}
                    autoFocus
                    disabled={readonly}
                  />
                ) : (
                  <span
                    className="truncate cursor-text hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                    onClick={() => {
                      if (!readonly) {
                        setIsEditingName(true);
                      }
                    }}
                  >
                    {name || "Unnamed Item"}
                  </span>
                )}
                {isNew && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded shrink-0 ml-2">
                    NEW
                  </span>
                )}
              </CardTitle>
              {isEditingDescription ? (
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setEditedDescription(description);
                      setIsEditingDescription(false);
                    }
                  }}
                  className="mt-2 min-h-[60px] resize-none"
                  placeholder="Item description"
                  disabled={readonly}
                  autoFocus
                />
              ) : (
                <CardDescription
                  className="line-clamp-2 cursor-text hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                  onClick={() => {
                    if (!readonly) {
                      setIsEditingDescription(true);
                    }
                  }}
                >
                  {description || "Click to add description"}
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
                  onClick={() => onMoveUp(authItemId)}
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
                  onClick={() => onMoveDown(authItemId)}
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
                htmlFor={`${authItemId}-active`}
                className="text-sm flex items-center gap-1.5 min-w-[60px]"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
              </Label>
              <Switch
                id={`${authItemId}-active`}
                checked={active}
                onCheckedChange={(checked) => onActiveToggle(authItemId, checked)}
                disabled={readonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              Enable or disable this auth item
            </p>
          </div>

          {/* Encrypted Toggle */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`${authItemId}-encrypted`}
                className="text-sm flex items-center gap-1.5 min-w-[60px]"
              >
                {encrypted ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                Encrypted
              </Label>
              <Switch
                id={`${authItemId}-encrypted`}
                checked={encrypted}
                onCheckedChange={(checked) =>
                  onEncryptedToggle(authItemId, checked)
                }
                disabled={readonly || !isNew}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {encrypted
                ? "This item is encrypted. Keys are managed on the Settings page."
                : "This item stores plain text values."}
              {!isNew && (
                <span className="block mt-1 text-orange-600">
                  Encryption status cannot be changed after creation.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

