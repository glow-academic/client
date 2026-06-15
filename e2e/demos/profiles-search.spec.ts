import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: search-led full-page tour of the profiles directory
// (/management/profiles). Unlike the card-grid libraries this surface is a
// TanStack DATA TABLE (gridTestId `profiles-table`, rows `profiles-row`) with a
// client-side name/email search box (`profiles-search`), three faceted picker
// filters (Role / Permissions / Department), a column-View menu, and table
// pagination — so the demo tours the table, not a card deck.
//
// PAGE-READY GATE: facade.library.openIfPopulated() navigates, waits the
// toolbar + table visible, and (when populated) waits the loading skeleton out
// — so the first recorded frame is the LOADED table, never a shimmer. The demo
// skips cleanly when the directory is empty (no seed data to search). Past that
// gate every beat self-guards (visible()/count() bail) so a control or row the
// page lacks is skipped, never failed. Beats:
//   (1) tour the toolbar + table top->bottom and walk a few rows so the camera
//       reads the directory's contents;
//   (2) surface each row's per-row affordances (View Report / Edit / Delete /
//       Emulate) by HOVER only — never click, since View Report opens a tab,
//       Edit navigates off the list, and Delete/Emulate mutate;
//   (3) the SEARCH headline: exerciseListView types a term into the page's
//       `profiles-search` box character-by-character (so the query + the
//       narrowing table both read on camera), settles, then clears back;
//   (4) it then opens the Role / Department faceted filters and the column
//       View menu, reveals options, then Reset/closes;
//   (5) it pages through pagination (Next -> Prev) and resizes the page.
// All non-destructive — search/filters open-then-reset, row actions are only
// hovered, no checkbox is ticked so the destructive bulk bar never appears, and
// the single/bulk delete dialogs are never opened. We save once under the
// search slot's canonical "profiles-search" name (saveDemoVideo closes the
// page, so it is the final beat).

test.describe("demo: profiles search", () => {
  test("search the profiles library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["profile"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // PAGE-READY GATE: open the directory and confirm it's populated (toolbar +
    // table visible, skeleton settled). Skip — don't fail — when the directory
    // is empty, since a search demo needs data to narrow.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} directory is empty (no seed data to search)`,
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour top->bottom: surface the toolbar, then bring the table container
    // into frame, then walk the first few rows so the camera reads the roster.
    const toolbar = page.getByTestId("profiles-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const table = page.getByTestId("profiles-table").first();
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const rows = page.getByTestId("profiles-row");
    const rowCount = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible().catch(() => false))) continue;
      await row.scrollIntoViewIfNeeded().catch(() => undefined);
      await row.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // 2) Surface the per-row affordances on the first row so the View Report /
    // Edit / Delete / Emulate controls read on camera — HOVER only, never click
    // (View Report opens a new tab; Edit navigates off the list; Delete and
    // Emulate are mutating/irreversible).
    await hoverLocatorIfVisible(page.getByTestId("btn-preview-profile"));
    await hoverLocatorIfVisible(page.getByTestId("btn-edit-profile"));
    await hoverLocatorIfVisible(page.getByTestId("btn-emulate-profile"));
    await hoverLocatorIfVisible(page.getByTestId("btn-delete-profile"));

    // 3+4+5) The headline of the SEARCH slot: drive every interactive list
    // control on camera. exerciseListView's search step targets the page's
    // `profiles-search` box by testid (sidebar-proof), types a selective term
    // character-by-character (so the query appears) and settles on the filtered
    // table, then clears back. It then opens the Role / Department faceted
    // filters (open -> pick -> Reset), the column View toggle, pagination
    // (Next -> Prev), and the page-size selector. Each step is independently
    // guarded so a control the page lacks is skipped cleanly. All read-only /
    // reversible — picking a facet only filters the view, and Reset clears it.
    await exerciseListView(page);

    // Land the clip back on the populated table (a settled, full-list frame
    // rather than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /profile|role|department/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "profiles-search");
  });
});
