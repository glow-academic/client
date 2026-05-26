/**
 * Texts.tsx
 * Resource component for text content selection
 * Simple multi-select component with GenericPicker and textarea for creating new texts
 * Pure UI: data in, IDs out via onChange
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, FileText, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface TextResourceItem {
  texts_id?: string | null;
  content?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface TextItem {
  texts_id?: string | null;
  content?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface TextsProps {
  text_ids?: string[];
  text_resources?: TextItem[];
  show_texts?: boolean;
  texts?: TextItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  searchTerm?: string;
  /** Called when text content is created — reports content for server-side chain creation */
  onTextContentCreate?: (content: string) => void;
  /** Per-field pending lifecycle (multi-select). See ParameterFields.tsx. */
  onAcceptPending?: (pendingIds: string[]) => void;
  onRejectPending?: (pendingIds: string[]) => void;
}

export function Texts({
  text_ids = [],
  text_resources = [],
  show_texts = true,
  texts = [],
  disabled = false,
  onChange,
  label = "Texts",
  required = false,
  searchTerm,
  onTextContentCreate,
  onAcceptPending,
  onRejectPending,
}: TextsProps) {
  const [newTextContent, setNewTextContent] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Derive selected texts from text_resources or texts list
  const selectedTexts = useMemo(() => {
    if (text_resources && text_resources.length > 0) {
      return text_resources.filter(
        (t) => t.texts_id && text_ids.includes(t.texts_id),
      );
    }
    return texts.filter((t) => t.texts_id && text_ids.includes(t.texts_id));
  }, [text_ids, text_resources, texts]);

  // Available texts for picker (exclude already selected)
  const availableTexts = useMemo(() => {
    const selectedSet = new Set(text_ids);
    return texts.filter((t) => t.texts_id && !selectedSet.has(t.texts_id));
  }, [texts, text_ids]);

  // Handle removing a text
  const handleRemove = useCallback(
    (textId: string) => {
      onChange(text_ids.filter((id) => id !== textId));
    },
    [text_ids, onChange],
  );

  // Handle creating a new text — report content to parent
  const handleCreate = useCallback(() => {
    if (!newTextContent.trim()) return;

    if (onTextContentCreate) {
      onTextContentCreate(newTextContent.trim());
      setNewTextContent("");
      setShowCreateForm(false);
    }
  }, [newTextContent, onTextContentCreate]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return texts.filter((t) => t.pending === true);
  }, [texts]);
  const pendingResourceIds = useMemo(
    () =>
      pendingItems
        .map((t) => t.texts_id)
        .filter((id): id is string => !!id),
    [pendingItems]
  );
  const pendingIds = useMemo(
    () => new Set(pendingResourceIds),
    [pendingResourceIds]
  );
  const showDiff = pendingItems.length > 0;

  // Accept pending — pending items are already in selection. Parent hook
  // strips the pending resource ids from `pending_ids`. See
  // ParameterFields.tsx for the full pattern.
  const handleAccept = useCallback(() => {
    if (onAcceptPending && pendingResourceIds.length > 0) {
      onAcceptPending(pendingResourceIds);
    }
    // Pending items are already in the selection; accepting is a no-op for form state
    // when no callback is provided. The parent will clear the pending flag server-side.
  }, [onAcceptPending, pendingResourceIds]);

  // Reject pending — drop them from selection AND from `pending_ids`.
  const handleReject = useCallback(() => {
    if (onRejectPending && pendingResourceIds.length > 0) {
      onRejectPending(pendingResourceIds);
      return;
    }
    const newIds = text_ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [text_ids, pendingIds, pendingResourceIds, onChange, onRejectPending]);

  if (!show_texts) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {showDiff && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    onClick={handleAccept}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Accept</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={handleReject}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reject</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
      </div>

      {/* Selected texts */}
      {selectedTexts.length > 0 && (
        <div className="space-y-2">
          {selectedTexts.map((text) => {
            const isPending = text.texts_id ? pendingIds.has(text.texts_id) : false;
            return (
              <div
                key={text.texts_id}
                className={cn(
                  "relative flex items-start gap-2 rounded-md border p-3 bg-muted/30",
                  isPending && "ring-2 ring-success bg-success/10",
                )}
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-sm whitespace-pre-wrap line-clamp-3">
                  {text.content || "Empty text"}
                </p>
                {isPending && (
                  <span className="absolute top-2 right-8 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                    Pending
                  </span>
                )}
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => text.texts_id && handleRemove(text.texts_id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Picker for existing texts */}
      {!disabled && availableTexts.length > 0 && (
        <GenericPicker
          items={availableTexts}
          selectedIds={text_ids}
          onSelect={(ids) => {
            // GenericPicker returns full array; find newly added
            const newIds = ids.filter((id) => !text_ids.includes(id));
            if (newIds.length > 0) {
              onChange([...text_ids, ...newIds]);
            }
          }}
          getId={(t) => t.texts_id || ""}
          getLabel={(t) => {
            const content = t.content || "";
            return content.length > 80 ? content.substring(0, 80) + "..." : content;
          }}
          getSearchText={(t) => t.content || ""}
          multiSelect
          placeholder="Select texts..."
          emptyMessage="No texts available"
          initialSearchTerm={searchTerm ?? ""}
        />
      )}

      {/* Create new text */}
      {!disabled && onTextContentCreate && (
        <div className="space-y-2">
          {!showCreateForm ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              Add new text
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border p-3">
              <Textarea
                value={newTextContent}
                onChange={(e) => setNewTextContent(e.target.value)}
                placeholder="Enter text content..."
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreate}
                  disabled={!newTextContent.trim()}
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTextContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
