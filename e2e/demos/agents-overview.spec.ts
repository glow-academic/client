import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// # coverage: full-page tour of the system-agents library — scroll the loaded
// grid top->bottom, surface a card's per-row affordances (Edit/View/Duplicate),
// then drive every list control on camera (search -> Tool/Model/Department
// faceted filters -> card View toggle -> pagination -> page size). Every beat
// past the page-ready / populated-grid gate (handled inside overviewDemo) is
// self-guarding: a control or card the page lacks is skipped, never failed. All
// non-destructive — links are only hovered (never clicked, so we stay on the
// list), filters open-then-reset, and Duplicate/Delete are never invoked.

test.describe("demo: agents overview", () => {
  test("browse the agents library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "agent", async (p) => {
      // The loaded, populated grid is already on screen + skeleton-settled
      // (overviewDemo -> library.openIfPopulated + browse). Trim any residual
      // shimmer before the first beat so no half-loaded frame is recorded.
      await waitOutSkeleton(p);

      // 1) Tour the grid top->bottom: bring the grid container into frame, then
      // walk the first few cards so the camera reads the library's contents.
      const grid = p.getByTestId("agents-grid").first();
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }

      const cards = p.getByTestId("agent-card");
      const cardCount = await cards.count().catch(() => 0);
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible().catch(() => false))) continue;
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(800);
      }

      // 2) Surface the per-card affordances on the first card so the row's
      // Edit / View / Duplicate controls read on camera — hover only, never
      // click (clicking Edit/View would navigate off the list page, and
      // Duplicate/Delete mutate).
      await hoverLocatorIfVisible(p.getByTestId("btn-edit-agent"));
      await hoverLocatorIfVisible(p.getByTestId("btn-view-agent"));
      await hoverLocatorIfVisible(p.getByTestId("btn-duplicate-agent"));

      // 3) Drive every interactive list control on camera. Each step inside is
      // independently guarded (visible()/count() bail) so a missing control is
      // skipped cleanly: search (type -> settle -> clear), the Tool/Model/
      // Department faceted filters (open -> pick -> Reset), the card View
      // (column-visibility) toggle, pagination (Next -> Prev), and the page-size
      // selector. All read-only / reversible.
      await exerciseListView(p);
    });
  });
});
