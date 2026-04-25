"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of items affected by the bulk edit. */
  count: number;
  /** Plural label, e.g. "personas". */
  entityLabelPlural: string;
  isSaving: boolean;
  onSave: () => void | Promise<void>;
  /** Disable Save button when nothing has changed; defaults to true (always enabled). */
  canSave?: boolean;
  /** Per-artifact field rows live here (flags, pickers, etc.). */
  children: React.ReactNode;
}

/**
 * BulkEditDialog
 *
 * Shell for bulk-edit modals. The dialog renders:
 *   - Header: "Edit {count} {entityLabelPlural}"
 *   - Helper copy: "Only fields you change will be updated."
 *   - Body: children (per-artifact field rows)
 *   - Footer: Cancel + Save (with loading state)
 *
 * Per-artifact form state and save-handlers stay in the parent page — pass them
 * via children + `onSave`.
 */
export function BulkEditDialog({
  open,
  onOpenChange,
  count,
  entityLabelPlural,
  isSaving,
  onSave,
  canSave = true,
  children,
}: BulkEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Edit {count} {entityLabelPlural}
          </DialogTitle>
          <DialogDescription>
            Only fields you change will be updated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">{children}</div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving || !canSave}>
            {isSaving ? "Applying..." : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkEditDialog;
