/**
 * DefaultAccounts.tsx
 * Resource component for default account resources
 * Uses GenericPicker to select existing profile artifacts
 * Manages default_account_ids array and reports to parent
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
import { Check, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftDefaultAccountsIn = InputOf<
  "/api/v4/resources/default_accounts",
  "post"
>;
type CreateDraftDefaultAccountsOut = OutputOf<
  "/api/v4/resources/default_accounts",
  "post"
>;

export interface DefaultAccountItem {
  id: string;
  name: string;
  description?: string;
}

export interface DefaultAccountsProps {
  default_account_ids?: string[];
  default_account_resources?: Array<{
    default_account_id: string | null;
    profile_id: string | null;
    type: string | null;
    generated?: boolean | null;
  }>;
  show_default_accounts?: boolean;
  default_account_suggestions?: string[];
  profiles?: Array<{
    profile_id: string | null;
    name: string | null;
    description?: string | null;
  }>;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createDefaultAccountsAction?:
    | ((
        input: CreateDraftDefaultAccountsIn
      ) => Promise<CreateDraftDefaultAccountsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function DefaultAccounts({
  default_account_ids,
  default_account_resources,
  show_default_accounts = false,
  default_account_suggestions,
  profiles,
  disabled = false,
  onChange,
  label = "Default Accounts",
  id = "default_accounts",
  required = false,
  placeholder = "Select default accounts...",
  description,
  group_id,
  agent_id,
  createDefaultAccountsAction,
  onGenerate,
  isGenerating = false,
}: DefaultAccountsProps) {
  const ids = useMemo(() => default_account_ids ?? [], [default_account_ids]);
  const show = show_default_accounts ?? false;
  const allProfiles = useMemo(() => profiles ?? [], [profiles]);
  const suggestionsList = useMemo(
    () => default_account_suggestions ?? [],
    [default_account_suggestions]
  );

  const createdDefaultAccountIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    ids.forEach((id) => createdDefaultAccountIdsRef.current.add(id));
  }, [ids]);

  const profileItems = useMemo(() => {
    return allProfiles
      .filter((p) => p.profile_id && p.name)
      .map((p) => ({
        id: p.profile_id!,
        name: p.name!,
        ...(p.description ? { description: p.description } : {}),
      }));
  }, [allProfiles]);

  const isSuggested = useCallback(
    (profileId: string) => suggestionsList.includes(profileId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      const newlySelected = selectedIds.filter(
        (id) =>
          !ids.includes(id) && !createdDefaultAccountIdsRef.current.has(id)
      );

      if (
        newlySelected.length > 0 &&
        createDefaultAccountsAction &&
        agent_id &&
        group_id
      ) {
        for (const profileId of newlySelected) {
          try {
            await createDefaultAccountsAction({
              body: {
                agent_id: agent_id,
                group_id: group_id,
                profile_id: profileId,
                type: "default", // Default type - can be made configurable
                mcp: false,
              },
            });
            createdDefaultAccountIdsRef.current.add(profileId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create default account resource for ${profileId}:`,
              error
            );
          }
        }
      }

      onChange(selectedIds);
    },
    [ids, onChange, createDefaultAccountsAction, agent_id, group_id]
  );

  const hasGenerated = useMemo(() => {
    return default_account_resources?.some((d) => d.generated) ?? false;
  }, [default_account_resources]);

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
      <GenericPicker<DefaultAccountItem>
        items={profileItems}
        itemIds={allProfiles
          .map((p) => p.profile_id)
          .filter((id): id is string => id !== null)}
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.name}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
