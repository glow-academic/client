import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// # coverage: full-page tour of the simulations library — scroll the loaded
// grid top->bottom, surface a card's per-row affordances (Edit/View/Duplicate/
// Delete), open the simulation-specific "Scenario" faceted filter to reveal its
// options (then dismiss), then drive every shared list control on camera
// (search -> Scenario/Cohort/Department faceted filters -> card View toggle ->
// pagination -> page size). Every beat past the page-ready / populated-grid gate
// (handled inside overviewDemo) is self-guarding: a control or card the page
// lacks is skipped, never failed. All NON-DESTRUCTIVE — per-card links are only
// hovered (never clicked, so we stay on the list), filters open-then-reset, and
// Duplicate/Delete buttons are only hovered, never invoked. After any re-query
// the loading shimmer is settled out before the next beat so no skeleton frame
// is recorded.

test.describe("demo: simulations overview", () => {
  test("browse the simulations library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo({ page, demo, registry, request, runId }, "simulation", async (p) => {
      // The loaded, populated grid is already on screen + skeleton-settled
      // (overviewDemo -> library.openIfPopulated + browse). Trim any residual
      // shimmer before the first beat so no half-loaded frame is recorded.
      await waitOutSkeleton(p);

      // 1) Tour the grid top->bottom: bring the grid container into frame, then
      // walk the first few simulation cards so the camera reads the library's
      // contents (names, AI/Practice/Inactive badges, cohort counts, scenario
      // dots).
      const grid = p.getByTestId("simulations-grid").first();
      if (await grid.isVisible().catch(() => false)) {
        await grid.scrollIntoViewIfNeeded().catch(() => undefined);
        await pauseForDemo(900);
      }

      const cards = p.getByTestId("simulation-card");
      const cardCount = await cards.count().catch(() => 0);
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = cards.nth(i);
        if (!(await card.isVisible().catch(() => false))) continue;
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(800);
      }

      // 2) Surface the per-card affordances on the first card so the row's
      // Edit / View / Duplicate / Delete controls read on camera — hover only,
      // never click (clicking Edit/View would navigate off the list page, and
      // Duplicate/Delete mutate). can_edit rows show Edit, can_edit==false rows
      // show View instead, so both testids are hovered (each guarded).
      await hoverLocatorIfVisible(p.getByTestId("btn-edit-simulation"));
      await hoverLocatorIfVisible(p.getByTestId("btn-view-simulation"));
      await hoverLocatorIfVisible(p.getByTestId("btn-duplicate-simulation"));
      await hoverLocatorIfVisible(p.getByTestId("btn-delete-simulation"));

      // 3) Open the simulation-specific "Scenario" faceted filter to reveal its
      // options on camera, then dismiss with Escape WITHOUT committing — the
      // shared exerciseListView below only opens the generic "Department" filter,
      // so this surfaces the distinctive Scenario picker the simulations page
      // composes. Fully guarded: skipped cleanly if the trigger / options aren't
      // present, and Escape leaves the grid unchanged (no re-query, no mutation).
      const scenarioFilter = p.getByRole("button", { name: /^Scenario$/ }).first();
      if (await scenarioFilter.isVisible().catch(() => false)) {
        await scenarioFilter.scrollIntoViewIfNeeded().catch(() => undefined);
        await scenarioFilter.click({ timeout: 10_000 }).catch(() => undefined);
        await pauseForDemo(900);
        // Hold on the revealed option list (CommandItems, role "option") so the
        // facet values read on camera, then dismiss without selecting anything.
        if (await p.getByRole("option").first().isVisible().catch(() => false)) {
          await pauseForDemo(700);
        }
        await p.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(600);
      }

      // 4) Drive every interactive list control on camera. Each step inside is
      // independently guarded (visible()/count() bail) so a missing control is
      // skipped cleanly: search (type -> settle -> clear), the Scenario/Cohort/
      // Department faceted filters (open -> pick -> Reset), the card View
      // (column-visibility) toggle, pagination (Next -> Prev), and the page-size
      // selector. All read-only / reversible — the filter step picks an option
      // then clicks the toolbar Reset, restoring the full unfiltered grid.
      await exerciseListView(p);
    });
  });
});
