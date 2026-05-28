"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of items that will actually be deleted (shown in title/button). */
  count: number;
  /** Singular label, e.g. "persona". Used in fallback copy. */
  entityLabel: string;
  /** Plural label, e.g. "personas". Used in title + default description. */
  entityLabelPlural: string;
  isDeleting: boolean;
  onConfirm: () => void | Promise<void>;
  /** Optional custom description body; defaults to standard confirmation copy. */
  description?: React.ReactNode;
  /** Optional extra testid suffix for stable e2e hooks. */
  testIdSuffix?: string;
}

/**
 * BulkDeleteDialog
 *
 * Shared confirmation dialog for bulk-delete actions across artifact list pages.
 * Keep per-page state (open flag, isDeleting, which items are deletable) in the parent.
 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  entityLabel,
  entityLabelPlural,
  isDeleting,
  onConfirm,
  description,
  testIdSuffix,
}: BulkDeleteDialogProps) {
  const titleId = `bulk-delete-${entityLabel.toLowerCase()}-title`;
  const suffix = testIdSuffix ?? entityLabel.toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        aria-labelledby={titleId}
        data-testid={`dialog-bulk-delete-${suffix}`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>
            Delete {count} {count === 1 ? entityLabel : entityLabelPlural}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {description ?? (
                <p>
                  Are you sure you want to delete {count} {count === 1 ? entityLabel : entityLabelPlural}?
                  This action cannot be undone.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting || count === 0}
            variant="destructive"
            data-testid="btn-confirm-bulk-delete"
          >
            {isDeleting ? "Deleting..." : `Delete ${count}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default BulkDeleteDialog;
