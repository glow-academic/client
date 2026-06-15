import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// # coverage: full-page tour of the documents library — unlike the card-grid
// artifacts, documents render as a DATA TABLE (`documents-table` with
// `documents-row` rows), so this tour is table-shaped: scroll the loaded table
// top->bottom, surface a row's always-on action buttons (Preview / Edit /
// Delete), OPEN the read-only Preview detail dialog (hold so its content reads,
// then Escape), exercise sortable column headers (Document / Fields / Scenarios
// / Department / Updated re-sort the rows, fully reversible), open EACH faceted
// filter popover (Scenarios / Fields / Department — reveal options, Escape
// without committing), then drive every shared list control on camera via
// exerciseListView (the `documents-search` "Filter documents..." box ->
// faceted filter + Reset -> card View column toggle -> pagination -> page
// size). Every beat past the page-ready / populated-table gate (handled inside
// overviewDemo) is self-guarding: a control / row / dialog the page lacks is
// skipped, never failed. All NON-DESTRUCTIVE — the Preview dialog opens then
// Escapes, Edit/Delete are only hovered (never clicked, so we never navigate
// off the list or confirm a delete), sort/filter/search/view are all read-only
// or reversible.

test.describe("demo: documents overview", () => {
  test("browse the documents library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "document", async (p) => {
      // overviewDemo already opened the populated table + browsed (scroll) +
      // settled the skeleton. Trim any residual shimmer before the first beat
      // so no half-loaded frame is recorded.
      await waitOutSkeleton(p);

      // 1) Tour the table top->bottom: bring the table container into frame so
      // the camera reads the library's contents, then walk the first few rows.
      const table = p.getByTestId("documents-table").first();
      if (await table.isVisible().catch(() => false)) {
        await table.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }

      const rows = p.getByTestId("documents-row");
      const rowCount = await rows.count().catch(() => 0);
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const row = rows.nth(i);
        if (!(await row.isVisible().catch(() => false))) continue;
        await row.scrollIntoViewIfNeeded().catch(() => undefined);
        await row.hover().catch(() => undefined);
        await pauseForDemo(700);
      }

      // 2) Surface the first row's always-on action buttons so the camera reads
      // the Preview / Edit / Delete affordances. Edit (a link) and Delete (opens
      // a destructive confirm) are only HOVERED, never clicked.
      const previewBtn = p.locator('[data-testid^="preview-"]').first();
      await hoverLocatorIfVisible(previewBtn);
      await hoverLocatorIfVisible(p.locator('[data-testid^="edit-"]').first());
      await hoverLocatorIfVisible(p.locator('[data-testid^="delete-"]').first());

      // 3) Open the read-only Preview detail dialog so its content reads on
      // camera, then dismiss with Escape. Non-destructive — the dialog only
      // renders the document; closing leaves the list untouched.
      if (await previewBtn.isVisible().catch(() => false)) {
        await previewBtn.click({ timeout: 10_000 }).catch(() => undefined);
        const dialog = p.getByRole("dialog").filter({ visible: true }).first();
        if (await dialog.isVisible().catch(() => false)) {
          await waitOutSkeleton(p);
          await pauseForDemo(1_400);
        }
        await p.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }

      // 4) Exercise the sortable column headers — clicking a `DataTableColumnHeader`
      // re-sorts the rows in place (reversible, read-only). Walk the sortable
      // columns so the re-order reads on camera; each is independently guarded.
      for (const title of ["Document", "Fields", "Scenarios", "Department", "Updated"]) {
        const header = p.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
        if (!(await header.isVisible().catch(() => false))) continue;
        await header.scrollIntoViewIfNeeded().catch(() => undefined);
        await header.click({ timeout: 10_000 }).catch(() => undefined);
        await waitOutSkeleton(p);
        await pauseForDemo(700);
      }

      // 5) Open EACH faceted filter popover (Scenarios / Fields / Department),
      // reveal its options, then Escape WITHOUT committing — so the camera reads
      // the full filter surface. exerciseListView (step 6) opens the first
      // filter, commits + Resets it; this step previews the siblings it skips.
      for (const title of ["Scenarios", "Fields", "Department"]) {
        const trigger = p.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
        if (!(await trigger.isVisible().catch(() => false))) continue;
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click({ timeout: 10_000 }).catch(() => undefined);
        await pauseForDemo(800);
        // Surface the options list, then dismiss without selecting anything.
        const option = p.getByRole("option").first();
        if (await option.isVisible().catch(() => false)) await pauseForDemo(700);
        await p.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }

      // 6) Drive the shared interactive list controls on camera. Each step is
      // independently guarded (visible()/count() bail) so a missing control is
      // skipped cleanly: the `documents-search` box (type -> settle -> clear),
      // the first faceted filter (open -> pick -> Reset), the card View
      // (column-visibility) toggle, pagination (Next -> Prev), and the page-size
      // selector. All read-only / reversible.
      await exerciseListView(p);
    });
  });
});
