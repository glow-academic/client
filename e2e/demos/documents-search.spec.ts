import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import {
  hoverLocatorIfVisible,
  scrollToText,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: SEARCH-LED full-page tour of the documents library
// (/management/documents). This surface is a TanStack DATA TABLE (gridTestId
// `documents-table`, rows `documents-row`) — NOT a card grid — with a
// CLIENT-SIDE name search box (`documents-search`, placeholder "Filter
// documents..." that filters the `name` column live), three faceted picker
// filters (Scenarios / Fields / Department via ThreePickerFilters), a column
// "View" menu, and table pagination. The headline (distinct from
// documents-overview in this batch) is the SEARCH: we read a REAL document name
// off the loaded table, type a distinctive token of it character-by-character so
// the query AND the table narrowing both read on camera, hold, then clear back.
//
// PAGE-READY GATE: facade.library.openIfPopulated() navigates, waits the toolbar
// + table visible, and (when populated) waits the loading skeleton out — so the
// first recorded frame is the LOADED table, never a shimmer. The demo skips
// cleanly when the library is empty (no seed data to search). Past that gate
// EVERY beat self-guards (visible()/count() bail, helpers are internally guarded)
// so a control or row the page lacks is skipped, never failed. Beats:
//   (1) tour the toolbar + table top->bottom and walk a few rows so the camera
//       reads the library's contents;
//   (2) surface the first row's per-row affordances (Preview / Edit / Delete) by
//       HOVER only — never click (Edit navigates off the list, Delete is
//       irreversible; the Preview dialog IS opened later, non-destructively);
//   (3) THE SEARCH HEADLINE: derive a distinctive token from a real row's name,
//       type it char-by-char into `documents-search` (delay ~55), hold on the
//       narrowed table, then clear back to the full list;
//   (4) open the document Preview dialog (a row's `preview-{id}` → read-only
//       DocumentViewer modal), hold so its content reads, then dismiss (Escape);
//   (5) a brief FILTER/PAGINATION tour via exerciseListView (search step skipped
//       — we own it above): open the Department faceted filter (open -> pick ->
//       Reset), the column View toggle, pagination (Next -> Prev) and page-size.
// All non-destructive — search/filters open-then-reset, row links only hovered,
// the preview is read-only and Escaped, no checkbox is ticked so the destructive
// selection toolbar never appears, and no delete dialog is confirmed. We save
// once under the search slot's canonical "documents-search" name (saveDemoVideo
// closes the page, so it is the final beat).

/** First word (>= 2 chars, letters/digits only) of the first loaded document
 *  row's name, so the SEARCH types a REAL, matching token that visibly narrows
 *  the table. The name lives in the row's first cell as a `title`-bearing div
 *  (the on-screen text is truncated, but `title` holds the full name). Fully
 *  guarded: returns null on any miss so the caller falls back. Never throws. */
async function firstRowSearchToken(
  page: import("@playwright/test").Page,
): Promise<string | null> {
  const row = page.getByTestId("documents-row").first();
  if (!(await row.isVisible().catch(() => false))) return null;
  // The name cell renders the full name in a `title` attribute; prefer it over
  // the truncated visible text so the token is the real, complete word.
  const titled = row.locator("[title]").first();
  const full =
    (await titled.getAttribute("title").catch(() => null)) ??
    (await row.textContent().catch(() => null)) ??
    "";
  const word = (full.trim().split(/\s+/)[0] ?? "").replace(
    /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,
    "",
  );
  return word.length >= 2 ? word : null;
}

test.describe("demo: documents search", () => {
  test("search the documents library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["document"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // PAGE-READY GATE: open the library and confirm it's populated (toolbar +
    // table visible, skeleton settled). Skip — don't fail — when the library is
    // empty, since a search demo needs data to narrow.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} library is empty (no seed data to search)`,
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour top->bottom: surface the toolbar, then bring the table container
    // into frame, then walk the first few rows so the camera reads the library.
    const toolbar = page.getByTestId("documents-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const table = page.getByTestId("documents-table").first();
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const rows = page.getByTestId("documents-row");
    const rowCount = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible().catch(() => false))) continue;
      await row.scrollIntoViewIfNeeded().catch(() => undefined);
      await row.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // 2) Surface the first row's per-row affordances so the Preview / Edit /
    // Delete controls read on camera — HOVER only, never click (Edit navigates
    // off the list; Delete is irreversible). The action testids embed the row id
    // (`preview-{id}` / `edit-{id}` / `delete-{id}`), so target by a prefix
    // attribute selector + first match.
    await hoverLocatorIfVisible(page.locator('[data-testid^="preview-"]'));
    await hoverLocatorIfVisible(page.locator('[data-testid^="edit-"]'));
    await hoverLocatorIfVisible(page.locator('[data-testid^="delete-"]'));

    // 3) THE SEARCH HEADLINE — the centerpiece of this slot. The search box
    // (`documents-search`) filters the `name` column CLIENT-SIDE (no re-fetch, no
    // skeleton), so we read a REAL token off a loaded row and type it
    // character-by-character (delay ~55ms) so the query appears and the table
    // visibly narrows on camera. Then clear it back to the full list. Guarded:
    // skips cleanly if the box or a derivable token is absent.
    const search = page.getByTestId("documents-search").first();
    if (await search.isVisible().catch(() => false)) {
      const token = (await firstRowSearchToken(page)) ?? "a";
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click({ timeout: 10_000 }).catch(() => undefined);
      await search.fill("").catch(() => undefined);
      // Type the real matching token so the table narrows live on camera.
      await search.pressSequentially(token, { delay: 55 }).catch(() => undefined);
      // Client-side filter applies on change — hold so the narrowed table reads.
      await pauseForDemo(1400);
      // Clear back to the full list so the later filter/pagination tour runs
      // against the unfiltered table.
      await search.fill("").catch(() => undefined);
      await pauseForDemo(900);
    }

    // 4) Open a document's Preview dialog (read-only DocumentViewer modal) so its
    // content reads, then dismiss with Escape — non-destructive. The trigger is
    // the row's `preview-{id}` button; the modal is a Radix Dialog (no mutation).
    const previewBtn = page.locator('[data-testid^="preview-"]').first();
    if (await previewBtn.isVisible().catch(() => false)) {
      await previewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await previewBtn.click({ timeout: 10_000 }).catch(() => undefined);
      const dialog = page.getByRole("dialog").first();
      if (await dialog.isVisible().catch(() => false)) {
        // Hold so the preview content (viewer + title) reads on camera.
        await pauseForDemo(1600);
        await page.keyboard.press("Escape").catch(() => undefined);
        await dialog.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // 5) Brief FILTER / PAGINATION tour. exerciseListView drives the shared list
    // controls: we SKIP its search step (the data-derived search above is our
    // headline) and let it open the Department faceted filter (open -> pick ->
    // Reset), the column "View" toggle, pagination (Next -> Prev), and the
    // page-size selector. Each step is independently guarded so a control the
    // page lacks is skipped cleanly. All read-only / reversible — picking a facet
    // only filters the view, and Reset clears it; no row is selected so the
    // destructive selection bar never appears.
    await exerciseListView(page, { skipSearch: true });

    // Land the clip back on the populated table (a settled, full-list frame
    // rather than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /document|scenarios|departments/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "documents-search");
  });
});
