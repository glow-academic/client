/**
 * ArtifactToolbarActions
 *
 * Top-right list-page toolbar with three actions in canonical order:
 *
 *   [+ New X]   [⬇ Download]   [↻ Refresh]
 *
 * - **Download**: POST ``/{artifact}/export`` → ``file_id`` → opens
 *   ``/api/{artifact}/download/{file_id}`` to trigger the browser's
 *   native download via the BFF (file modality; same path PDF exports
 *   will use later).
 * - **Refresh**: POST ``/{artifact}/refresh`` (real server-side cache
 *   invalidation + MV refresh) → ``router.refresh()`` to re-pull SSR.
 *
 * The sidebar toggle is rendered by ``FullPageLayout`` separately;
 * this component only occupies the ``toolbar`` slot.
 */
"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Download, Loader2, Plus } from "lucide-react";
import { HoverPrefetchLink } from "@/components/common/HoverPrefetchLink";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { RefreshButton } from "./RefreshButton";

export interface ArtifactToolbarActionsProps {
  /** Optional left-most "New X" button. */
  newButton?: { label: string; href: string };
  /** Custom leftmost slot — used in place of ``newButton`` on detail
   *  pages where the drafts dropdown (``<SaveToolbar />``) sits where
   *  the "New X" button does on the list page. Layout stays identical:
   *  [leftSlot]  [⬇ Download]  [↻ Refresh]. */
  leftSlot?: React.ReactNode;
  /** Server action that posts to ``/{artifact}/export`` and returns
   *  ``{file_id, file_name}``. Omit to hide the Download button. */
  exportAction?: () => Promise<{ file_id: string; file_name?: string }>;
  /** Server action that posts to ``/{artifact}/refresh``. Omit to hide
   *  the Refresh button. */
  refreshAction?: () => Promise<unknown>;
  /** BFF download path prefix — e.g. ``/api/persona/download``. The
   *  ``file_id`` returned from ``exportAction`` is appended. */
  bffDownloadPrefix?: string;
}

export function ArtifactToolbarActions({
  newButton,
  leftSlot,
  exportAction,
  refreshAction,
  bffDownloadPrefix,
}: ArtifactToolbarActionsProps) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();

  const handleDownload = useCallback(() => {
    if (!exportAction || !bffDownloadPrefix) return;
    startExport(async () => {
      try {
        const result = await exportAction();
        if (!result.file_id) {
          toast.error("Export returned no file_id");
          return;
        }
        // Native browser download via the BFF route. The server stamps
        // Content-Disposition: attachment so the browser saves it
        // instead of navigating.
        window.location.href = `${bffDownloadPrefix}/${result.file_id}`;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Export failed",
        );
      }
    });
  }, [exportAction, bffDownloadPrefix]);

  const handleRefresh = useCallback(async () => {
    if (!refreshAction) return;
    try {
      await refreshAction();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    }
  }, [refreshAction, router]);

  return (
    <div className="flex items-center gap-2">
      {leftSlot ?? (newButton ? (
        <Button asChild size="sm">
          <HoverPrefetchLink href={newButton.href}>
            <Plus className="h-4 w-4" />
            {newButton.label}
          </HoverPrefetchLink>
        </Button>
      ) : null)}
      {exportAction && bffDownloadPrefix && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleDownload}
                disabled={isExporting}
                aria-label="Download CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download CSV</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {refreshAction && <RefreshButton onClick={handleRefresh} />}
    </div>
  );
}
