/**
 * Emails.tsx
 * Resource component for email selection
 * Uses GenericPicker to select existing email resources
 * Manages email_ids array with primary email index and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Mail, Sparkles } from "lucide-react";
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
      )}
      <GenericPicker<EmailItem>
        items={emailItems}
        itemIds={allEmails
          .map((e) => e.id)
          .filter((id): id is string => id !== null)} // All email IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.email}
        renderItem={(item, isSelected) => {
          const isPrimary =
            isSelected && ids.indexOf(item.id) === primaryIndex;
          return (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isSuggested(item.id) && !isSelected && (
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                    Suggested
                  </span>
                )}
                {isPrimary && (
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const index = ids.indexOf(item.id);
                      if (index >= 0) {
                        handlePrimaryChange(index);
                      }
                    }}
                    disabled={disabled || !isSelected}
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
                <Check
                  className={cn(
                    "flex-shrink-0 h-4 w-4",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
              </div>
            </div>
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
