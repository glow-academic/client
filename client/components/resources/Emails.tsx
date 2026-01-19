/**
 * Emails.tsx
 * Resource component for email selection
 * Uses GenericPicker to select existing email resources
 * Manages email_ids array with primary email index and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  Check,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CreateDraftEmailsIn = InputOf<"/api/v4/resources/emails", "post">;
type CreateDraftEmailsOut = OutputOf<"/api/v4/resources/emails", "post">;

export interface EmailItem {
  id: string;
  email: string;
}

export interface EmailsProps {
  email_ids?: string[]; // Current email resource IDs (standardized prop name)
  email_resources?: Array<{
    id: string | null;
    email: string | null;
    generated?: boolean | null;
  }>; // Selected email resources (each includes generated field)
  show_emails?: boolean; // Whether to show this resource picker
  email_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  emails?: Array<{
    id: string | null;
    email: string | null;
    generated?: boolean | null;
  }>; // All available emails from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[], primaryIndex: number) => void; // Update email_ids and primary_email_index in form state
  primary_email_index?: number; // Index of primary email in email_ids array
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  agent_id?: string | null; // Agent ID for resource creation
  createEmailsAction?:
    | ((input: CreateDraftEmailsIn) => Promise<CreateDraftEmailsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function Emails({
  email_ids,
  email_resources,
  show_emails = true,
  email_suggestions,
  emails,
  disabled = false,
  onChange,
  primary_email_index = 0,
  label = "Emails",
  id = "emails",
  required = false,
  placeholder = "Select emails...",
  description,
  group_id,
  agent_id,
  createEmailsAction,
  onGenerate,
  isGenerating = false,
}: EmailsProps) {
  const ids = useMemo(() => email_ids ?? [], [email_ids]);
  const show = show_emails ?? true;
  const allEmails = useMemo(() => emails ?? [], [emails]);
  const suggestionsList = useMemo(
    () => email_suggestions ?? [],
    [email_suggestions]
  );
  const [primaryIndex, setPrimaryIndex] = useState(primary_email_index ?? 0);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [newEmailValue, setNewEmailValue] = useState("");
  const [createdEmailValues, setCreatedEmailValues] = useState<
    Record<string, string>
  >({});
  const emailLookup = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(createdEmailValues).forEach(([id, email]) => {
      map.set(id, email);
    });
    allEmails.forEach((email) => {
      if (email.id && email.email) {
        map.set(email.id, email.email);
      }
    });
    email_resources?.forEach((email) => {
      if (email.id && email.email) {
        map.set(email.id, email.email);
      }
    });
    return map;
  }, [allEmails, email_resources, createdEmailValues]);

  // Track which email IDs have already had resources created
  const createdEmailIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdEmailIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdEmailIdsRef.current.add(id));
  }, [ids]);

  // Update primary index when prop changes
  useEffect(() => {
    if (primary_email_index !== undefined) {
      setPrimaryIndex(primary_email_index);
    }
  }, [primary_email_index]);

  // Convert emails array to EmailItem format for GenericPicker
  const emailItems = useMemo(() => {
    return allEmails
      .filter((e) => e.id && e.email) // Filter out nulls
      .map((e) => ({
        id: e.id!,
        email: e.email!,
      }));
  }, [allEmails]);
  const selectedEmails = useMemo(() => {
    return ids.map((emailId) => ({
      id: emailId,
      email: emailLookup.get(emailId) ?? "",
    }));
  }, [ids, emailLookup]);

  // Check if an email is suggested
  const isSuggested = useCallback(
    (emailId: string) => suggestionsList.includes(emailId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdEmailIdsRef.current.has(id)
      );

      // Create resources for newly selected emails
      if (
        newlySelected.length > 0 &&
        createEmailsAction &&
        agent_id &&
        group_id
      ) {
        for (const emailId of newlySelected) {
          try {
            // Find email text from emails array
            const emailObj = allEmails.find((e) => e.id === emailId);
            if (emailObj?.email) {
              await createEmailsAction({
                body: {
                  agent_id: agent_id,
                  group_id: group_id,
                  email: emailObj.email,
                  mcp: false,
                },
              });
              createdEmailIdsRef.current.add(emailId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create email resource for ${emailId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Ensure primary index is valid
      const validPrimaryIndex = Math.min(
        primaryIndex,
        Math.max(0, selectedIds.length - 1)
      );

      // Update parent state
      onChange(selectedIds, validPrimaryIndex);
    },
    [
      ids,
      onChange,
      createEmailsAction,
      agent_id,
      group_id,
      allEmails,
      primaryIndex,
    ]
  );

  const handlePrimaryChange = useCallback(
    (newPrimaryIndex: number) => {
      if (newPrimaryIndex >= 0 && newPrimaryIndex < ids.length) {
        setPrimaryIndex(newPrimaryIndex);
        onChange(ids, newPrimaryIndex);
      }
    },
    [ids, onChange]
  );
  const createEmailResource = useCallback(
    async (value: string) => {
      if (!createEmailsAction || !agent_id || !group_id) {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed) return null;

      try {
        const result = await createEmailsAction({
          body: {
            agent_id: agent_id,
            group_id: group_id,
            email: trimmed,
            mcp: false,
          },
        });
        return result.emails_id ?? null;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to create email resource:", error);
        return null;
      }
    },
    [agent_id, group_id, createEmailsAction]
  );
  const handleSaveEdit = useCallback(async () => {
    if (!editingEmailId) return;
    const trimmed = editingEmailValue.trim();
    if (!trimmed) {
      setEditingEmailId(null);
      setEditingEmailValue("");
      return;
    }
    const newId = await createEmailResource(trimmed);
    if (!newId) return;

    const index = ids.indexOf(editingEmailId);
    if (index < 0) return;

    const nextIds = [...ids];
    nextIds[index] = newId;
    createdEmailIdsRef.current.add(newId);
    setCreatedEmailValues((prev) => ({ ...prev, [newId]: trimmed }));

    const nextPrimaryIndex = index === primaryIndex ? index : primaryIndex;
    setPrimaryIndex(nextPrimaryIndex);
    onChange(nextIds, nextPrimaryIndex);
    setEditingEmailId(null);
    setEditingEmailValue("");
  }, [
    editingEmailId,
    editingEmailValue,
    createEmailResource,
    ids,
    onChange,
    primaryIndex,
  ]);
  const handleAddEmail = useCallback(async () => {
    const trimmed = newEmailValue.trim();
    if (!trimmed) {
      setIsAddingEmail(false);
      setNewEmailValue("");
      return;
    }
    const newId = await createEmailResource(trimmed);
    if (!newId) return;

    const nextIds = [...ids, newId];
    const nextPrimaryIndex =
      nextIds.length === 1 ? 0 : Math.min(primaryIndex, nextIds.length - 1);
    createdEmailIdsRef.current.add(newId);
    setCreatedEmailValues((prev) => ({ ...prev, [newId]: trimmed }));
    setPrimaryIndex(nextPrimaryIndex);
    onChange(nextIds, nextPrimaryIndex);
    setIsAddingEmail(false);
    setNewEmailValue("");
  }, [
    newEmailValue,
    createEmailResource,
    ids,
    onChange,
    primaryIndex,
  ]);
  const handleRemove = useCallback(
    (emailId: string) => {
      const removeIndex = ids.indexOf(emailId);
      if (removeIndex < 0) return;

      const nextIds = ids.filter((id) => id !== emailId);
      let nextPrimaryIndex = primaryIndex;

      if (nextIds.length === 0) {
        nextPrimaryIndex = 0;
      } else if (removeIndex === primaryIndex) {
        nextPrimaryIndex = 0;
      } else if (removeIndex < primaryIndex) {
        nextPrimaryIndex = Math.max(0, primaryIndex - 1);
      }

      setPrimaryIndex(nextPrimaryIndex);
      onChange(nextIds, Math.min(nextPrimaryIndex, nextIds.length - 1));
    },
    [ids, onChange, primaryIndex]
  );

  // Check if any email resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return email_resources?.some((e) => e.generated) ?? false;
  }, [email_resources]);

  // Don't render if show_emails is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor={id} className="flex items-center gap-1">
              {label}
              {required && <span className="text-destructive">*</span>}
              {description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {description}
                </span>
              )}
            </Label>
            {onGenerate && agent_id && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={onGenerate}
                      disabled={disabled || isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasGenerated ? "Regenerate" : "Generate"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <GenericPicker<EmailItem>
            items={emailItems}
            itemIds={emailItems.map((item) => item.id)}
            selectedIds={ids}
            onSelect={handleSelect}
            multiSelect={true}
            getId={(item) => item.id}
            getLabel={(item) => item.email}
            getSearchText={(item) => `${item.email} ${item.id}`}
            placeholder={placeholder}
            disabled={disabled}
            compact={true}
            buttonClassName="h-8"
            showLabel={false}
            hideSelectedChips={true}
            showClearAll={false}
          />
        </div>
      )}
      {selectedEmails.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 py-6 text-center text-sm text-muted-foreground">
          No emails selected. Use the picker to add previous emails.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {selectedEmails.map((item, index) => {
            const isPrimary = index === primaryIndex;
            const isSuggestedItem = isSuggested(item.id);
            const emailLabel =
              item.email || `Email ${item.id.slice(0, 8)}...`;
            const isEditing = editingEmailId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-all",
                  "hover:shadow-md hover:bg-accent/50",
                  isPrimary && "ring-2 ring-primary bg-accent"
                )}
                onClick={() => {
                  if (disabled) return;
                  if (!isEditing) {
                    handlePrimaryChange(index);
                  }
                }}
              >
                <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <Input
                        type="email"
                        value={editingEmailValue}
                        onChange={(e) => setEditingEmailValue(e.target.value)}
                        placeholder="email@example.com"
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveEdit();
                          } else if (e.key === "Escape") {
                            setEditingEmailId(null);
                            setEditingEmailValue("");
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (disabled) return;
                          setEditingEmailId(item.id);
                          setEditingEmailValue(item.email || "");
                        }}
                        className="truncate text-left text-sm font-medium text-foreground hover:underline"
                      >
                        {emailLabel}
                      </button>
                    )}
                    {isSuggestedItem && (
                      <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                        Suggested
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isPrimary ? "Primary email" : "Click to set primary"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        disabled={disabled}
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEmailId(null);
                          setEditingEmailValue("");
                        }}
                        disabled={disabled}
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrimaryChange(index);
                      }}
                      disabled={disabled}
                      className={cn(
                        "text-xs px-2 py-1 rounded",
                        isPrimary
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                        disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isPrimary ? "Primary" : "Set Primary"}
                    </button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(item.id);
                    }}
                    disabled={disabled}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Check
                  className={cn(
                    "absolute right-3 top-3 h-4 w-4",
                    isPrimary ? "opacity-100" : "opacity-0"
                  )}
                />
              </div>
            );
          })}
        </div>
      )}
      {!disabled && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
          {isAddingEmail ? (
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={newEmailValue}
                onChange={(e) => setNewEmailValue(e.target.value)}
                placeholder="email@example.com"
                className="h-8"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmail();
                  } else if (e.key === "Escape") {
                    setIsAddingEmail(false);
                    setNewEmailValue("");
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleAddEmail}
                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsAddingEmail(false);
                  setNewEmailValue("");
                }}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingEmail(true)}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add custom email
            </button>
          )}
        </div>
      )}
    </div>
  );
}
