import { test } from "../fixtures";
import { DomainFacade, DOMAINS } from "../actions/domains";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: search-led full-page tour of the fields library
// (/management/fields). PAGE-READY GATE: facade.library.openIfPopulated()
// navigates, waits the toolbar (`fields-toolbar`) + grid (`fields-grid`)
// visible, and (when populated) waits the loading skeleton out — so the first
// recorded frame is the LOADED card grid, never the shimmer. The demo skips
// cleanly when the library is empty (no seed data to search). Past that gate
// every beat self-guards (visible()/count() bail) so a control or card the
// page lacks is skipped, never failed. Beats:
//   (1) tour the loaded grid top->bottom and walk the first few `field-card-*`
//       cards, surfacing each card's per-row affordances (View / Edit /
//       Duplicate / Delete — HOVER only, never click, so we stay on the list
//       and never mutate);
//   (2) reveal the selection toolbar by clicking ONE card (selecting it, which
//       swaps the toolbar in for the Delete/Edit bulk-action bar), hold so the
//       bar reads, then click "Unselect All" to return the list to its resting
//       state — non-destructive (a select is reversible; no bulk op is run);
//   (3) the SEARCH headline: exerciseListView types a selective term into the
//       page's `fields-search` box character-by-character (so the query + the
//       narrowing grid both read on camera), settles, then clears back;
//   (4) it then opens the Parameter/Persona/Department faceted filters and the
//       card View (column-visibility) menu, reveals options, then Reset/closes;
//   (5) it pages through pagination (Next -> Prev) and resizes the page.
// All non-destructive — search/filters open-then-reset, the card selection is
// reversed, links are only hovered, Duplicate/Delete are never invoked. We save
// once under the search slot's canonical "fields-search" name (saveDemoVideo
// closes the page, so it is the final beat).

test.describe("demo: fields search", () => {
  test("search the fields library", async ({ page, demo, registry, request, runId }) => {
    void request;
    void runId;
    const spec = DOMAINS["field"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // PAGE-READY GATE: open the list and confirm it's populated (toolbar + grid
    // visible, skeleton settled). Skip — don't fail — when the library is empty,
    // since a search demo needs data to narrow.
    test.skip(
      !(await facade.library.openIfPopulated()),
      `${spec.plural} library is empty (no seed data to search)`,
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour the grid top->bottom: bring the grid container into frame, then
    // walk the first few cards so the camera reads the library's contents.
    const grid = page.getByTestId("fields-grid").first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const cards = page.getByTestId(/^field-card-/);
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // 2) Surface the per-card row affordances on the first card so its
    // View / Edit / Duplicate / Delete controls read on camera — HOVER only,
    // never click (View/Edit navigate off the list; Duplicate/Delete mutate).
    // The View/Edit/Delete buttons embed the row id (`view-{id}` etc.) so target
    // the first match by an attribute-prefix locator; Duplicate uses a fixed
    // testid. Each hover is guarded and skips cleanly if the control is absent.
    await hoverLocatorIfVisible(page.locator('[data-testid^="view-"]'));
    await hoverLocatorIfVisible(page.locator('[data-testid^="edit-"]'));
    await hoverLocatorIfVisible(page.getByTestId("btn-duplicate-field"));
    await hoverLocatorIfVisible(page.locator('[data-testid^="delete-"]'));

    // 3) Reveal the SELECTION toolbar: clicking a card body toggles its
    // selection (the card carries a click handler), which swaps the resting
    // filter toolbar for the bulk-action bar (Delete / Edit / Select Page /
    // Unselect All). Hold so the bar reads, then click "Unselect All" to put the
    // grid back to its resting state. Fully reversible — no bulk op is invoked.
    const firstCard = cards.first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstCard.click().catch(() => undefined);
      await pauseForDemo(900);
      const unselect = page.getByRole("button", { name: /unselect all/i }).first();
      if (await unselect.isVisible().catch(() => false)) {
        await unselect.click().catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // 4+5) The headline of the SEARCH slot: drive every interactive list control
    // on camera. exerciseListView's search step targets the page's `fields-search`
    // box by testid (sidebar-proof), derives a selective term from a visible card
    // so the grid visibly narrows, types it character-by-character (delay ~40ms so
    // the query appears), settles on the filtered grid, then clears back. It then
    // opens the Parameter/Persona/Department faceted filters (open -> pick ->
    // Reset), the card View (column-visibility) toggle, pagination (Next -> Prev),
    // and the page-size selector. Each step is independently guarded so a control
    // the page lacks is skipped cleanly. All read-only / reversible.
    await exerciseListView(page);

    // Land the clip back on the populated grid (a settled, full-list frame rather
    // than mid-interaction) so the recording ends substantive.
    await waitOutSkeleton(page);
    await scrollToText(page, /fields grid|search fields/i).catch(() => undefined);
    await pauseForDemo(800);

    // saveDemoVideo closes the page to finalize the recording, so this is the
    // final beat. Saved under the search slot's canonical name.
    await saveDemoVideo(page, "fields-search");
  });
});
