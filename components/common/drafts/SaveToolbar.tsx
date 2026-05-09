/**
 * SaveToolbar.tsx
 * Single unified button: shows "Save Draft" when unsaved changes exist,
 * otherwise shows a "Drafts" dropdown for browsing/switching drafts.
 *
 * Drafts dropdown layout (mirrors GenerationPanel's group-search panel —
 * search flows straight into the list with no separator):
 *   1. Search input — URL-backed via nuqs (``?draftSearch=…``). Persists
 *      across closes so back/forward respects the filter.
 *   2. Filtered draft list (or loading / empty states).
 *   3. Separator
 *   4. Autosave toggle
 *   5. Create new draft (no separator between 4 and 5 — they're a
 *      contiguous "settings + actions" footer cluster).
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDrafts } from "@/contexts/draft-context";
import { ChevronsUpDown, Loader2, Plus, RefreshCw, Save, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";

const SEARCH_DEBOUNCE_MS = 250;

export function SaveToolbar() {
  const {
    isAutosaveEnabled,
    isAutosaveLoaded,
    setAutosaveEnabled,
    saveStatus,
    hasUnsavedChanges,
    triggerSave,
    drafts,
    selectedDraftId,
    setSelectedDraftId,
    isDraftsLoading,
    loadDrafts,
    currentDraftName,
  } = useDrafts();
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-backed search state — survives refresh, sharable. Empty string
  // ⇒ remove the param so the URL stays clean. Mirrors GenerationPanel.
  const [draftSearchUrl, setDraftSearchUrl] = useQueryState(
    "draftSearch",
    parseAsString,
  );
  const draftSearch = draftSearchUrl ?? "";
  const setDraftSearch = useCallback(
    (value: string) => {
      void setDraftSearchUrl(value || null);
    },
    [setDraftSearchUrl],
  );

  // Get draft name for display
  const getDraftName = useCallback((draft: (typeof drafts)[0]): string => {
    // Prefer the immutable label persisted on the draft entry; fall
    // back to the created_at date for legacy drafts that pre-date the
    // ``name`` column. ``DraftItem`` carries an open index signature
    // for forward-compat, so the ``name`` field uses bracket access.
    const name = draft["name"];
    if (typeof name === "string" && name.length > 0) {
      return name;
    }
    return draft.created_at
      ? new Date(draft.created_at).toLocaleDateString()
      : "Draft";
  }, []);

  // Debounced search → loadDrafts. Mirrors generation-search behavior:
  // every keystroke schedules a fetch ~250ms later; the latest call
  // cancels the previous via the ref-tracked timeout. When the page
  // hasn't wired ``searchDraftsAction``, the load is a no-op; the
  // client-side filter below still works against the eager list.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadDrafts({ search: draftSearch });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [draftSearch, loadDrafts]);

  // Client-side filter — narrows whatever ``drafts`` currently holds.
  // For pages with ``searchDraftsAction``, the server already returns
  // filtered results (this becomes a no-op). For legacy eager-load
  // pages the client filter is the only filter, so the search input
  // still works without a network roundtrip.
  const filteredDrafts = useMemo(() => {
    const q = draftSearch.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((d) => {
      const nameVal = d["name"];
      const name = typeof nameVal === "string" ? nameVal.toLowerCase() : "";
      if (name.includes(q)) return true;
      // Fallback: match against the ISO-ish created_at so date searches
      // (``2026-05``) work even on drafts with empty names.
      const created =
        typeof d.created_at === "string" ? d.created_at.toLowerCase() : "";
      return created.includes(q);
    });
  }, [drafts, draftSearch]);

  // Handle Save button click
  const handleSaveClick = useCallback(() => {
    if (hasUnsavedChanges) {
      triggerSave();
    }
  }, [hasUnsavedChanges, triggerSave]);

  // Switch to an existing draft
  const handleDraftSwitch = useCallback(
    (draftId: string) => {
      setSelectedDraftId(draftId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("draftId", draftId);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, setSelectedDraftId],
  );

  // Create a new draft
  const handleCreateNew = useCallback(() => {
    setSelectedDraftId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("draftId");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams, setSelectedDraftId]);

  // Kick off a load on dropdown open with the current (URL-backed)
  // search. Don't clear ``draftSearch`` on close — the nuqs setter
  // races with the ``router.replace`` from ``handleDraftSwitch`` and
  // can swallow the just-set ``draftId``. Keeping the filter in the
  // URL also makes back/forward navigation honor it. The user can
  // clear it manually in the input.
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        loadDrafts({ search: draftSearch || null });
      }
    },
    [draftSearch, loadDrafts],
  );

  const isSaving = saveStatus === "saving";
  const showSaveButton = isAutosaveLoaded && (hasUnsavedChanges || isSaving);

  // When there are unsaved changes, show a save button instead of the drafts dropdown
  if (showSaveButton) {
    return (
      <div className="pr-0">
        <Button
          variant="default"
          size="sm"
          onClick={handleSaveClick}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Draft
            </>
          )}
        </Button>
      </div>
    );
  }

  // No unsaved changes — show the drafts dropdown.
  // Trigger label resolution order:
  //   1. ``currentDraftName`` from context (page-supplied via SSR
  //      ``/<art>/get`` → ``draft_name``).
  //   2. Looked up by id in the lazily-loaded drafts list — uses
  //      ``getDraftName`` which already handles the no-name → date
  //      fallback (matches the dropdown items, so the trigger never
  //      reads "Draft" when a real timestamp is available).
  //   3. Fallback "Draft" — only seen briefly while drafts load if
  //      no page passed currentDraftName and the lookup also misses.
  //   4. "New draft" when there's no active draft.
  const activeDraftId = searchParams.get("draftId");
  const triggerLabel = !activeDraftId
    ? "New draft"
    : currentDraftName ||
      (() => {
        const found = drafts.find((d) => d.id === activeDraftId);
        return found ? getDraftName(found) : "Draft";
      })();

  // Layout: primary "create new" action on the left (only when there's
  // an existing draft to step away from), and a one-line outline picker
  // on the right that reads as a menu — light border, no icon, just the
  // current draft name and a chevron.
  return (
    <div className="flex items-center gap-2 pr-0">
      {/* Create-new is only meaningful when there's an active draft.
          On a fresh ``/new`` (no ``draftId``) we're already drafting,
          so the button collapses out of the toolbar. */}
      {activeDraftId && (
        <Button variant="default" size="sm" onClick={handleCreateNew}>
          <Plus className="h-4 w-4" />
          New draft
        </Button>
      )}
      <DropdownMenu onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Drafts picker"
          >
            <span className="max-w-[200px] truncate">{triggerLabel}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {/* Search input — debounced load on change. No divider after
              this row: search flows straight into the filtered list,
              matching GenerationPanel's group-search panel. */}
          <div className="px-2 py-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Search drafts…"
                className="h-8 pl-7 text-sm"
                // Stop typing keystrokes from bubbling up to the
                // dropdown's keyboard navigation handler (which would
                // otherwise interpret letters as menu shortcuts).
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          {isDraftsLoading && filteredDrafts.length === 0 ? (
            <DropdownMenuItem disabled>
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
              Loading drafts...
            </DropdownMenuItem>
          ) : filteredDrafts.length === 0 ? (
            <DropdownMenuItem disabled>
              {draftSearch ? "No drafts match your search" : "No drafts available"}
            </DropdownMenuItem>
          ) : (
            filteredDrafts
              .filter((draft) => draft.id !== null)
              .map((draft) => (
                <DropdownMenuItem
                  key={draft.id}
                  onClick={() => handleDraftSwitch(draft.id!)}
                  className={selectedDraftId === draft.id ? "bg-accent" : ""}
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-medium truncate">
                      {getDraftName(draft)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {draft.created_at
                        ? new Date(draft.created_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
          )}
          {/* Footer: autosave only — "Create new draft" is now a
              first-class button outside the dropdown. */}
          {isAutosaveLoaded && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center justify-between font-normal">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="size-3" />
                  <span>Autosave</span>
                </div>
                <Switch
                  checked={isAutosaveEnabled}
                  onCheckedChange={setAutosaveEnabled}
                />
              </DropdownMenuLabel>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
