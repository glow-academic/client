import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { overviewDemo } from "../helpers/crud-demos";
import { exerciseListView } from "../helpers/exercise-list";
import { hoverLocatorIfVisible, scrollToText, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo } from "../helpers/demo-video";

// coverage: tour the WHOLE cohorts library top->bottom and visibly exercise
// every read-only affordance the page offers — the shared list helper (page
// search → faceted filters → card View toggle → pagination → page size) PLUS
// the cohorts-specific extras the shared helper can't reach: the Simulation /
// Profile faceted pickers (the shared filter step only knows "Department"),
// a card's hover-revealed action rail, and the single-delete confirmation
// dialog opened-then-dismissed WITHOUT confirming (non-destructive). Every
// beat past the one page-ready assertion is guarded so it no-ops when its
// target is absent, and skeletons are settled out before each beat so no
// loading frame is recorded.

test.describe("demo: cohorts overview", () => {
  test("browse the cohorts library", async ({ page, demo, registry, request, runId }) => {
    await overviewDemo(
      { page, demo, registry, request, runId },
      "cohort",
      async (p) => {
        // ---- Page-ready assertion (the ONE hard gate) ----------------
        // The loaded grid is the populated-screen signal; everything below
        // is guarded against its target being absent.
        await expect(p.getByTestId("cohorts-grid")).toBeVisible({ timeout: 30_000 });
        await waitOutSkeleton(p);

        // ---- 1. Tour the page top -> bottom --------------------------
        // Scroll the toolbar, grid, and pagination zone into view, each
        // holding a beat. All guarded — a missing landmark just no-ops.
        await scrollToText(p, /Search cohorts/i);
        await scrollToText(p, /members/i);
        await scrollToText(p, /^Page \d+ of \d+$/);
        await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
        await pauseForDemo(700);

        // ---- 2. Hover a card's action rail ---------------------------
        // The edit/duplicate/delete buttons fade in on card hover — hover
        // the first card so the rail is on camera. Guarded via the helper.
        await hoverLocatorIfVisible(p.getByTestId("cohort-card").first());

        // ---- 3. Shared list affordances ------------------------------
        // search (type + clear), the Department faceted filter (open, pick,
        // reset), the card View column-visibility toggle, pagination
        // next/prev. Skip the page-size step here — this page renders
        // DataTablePagination with no `aria-label="pagination controls"`
        // wrapper, so the shared step would bail; we drive it directly in
        // step 5 instead. Every shared sub-step is independently guarded.
        await exerciseListView(p, { skipPageSize: true });

        // ---- 4. The cohort-specific faceted pickers ------------------
        // The shared filter step only knows the generic titles (Department,
        // …). Cohorts also expose "Simulation" and "Profile" faceted
        // pickers — open each, let its options render, dismiss with Escape
        // WITHOUT selecting (read-only reveal, no filter committed).
        for (const title of ["Simulation", "Profile"] as const) {
          const trigger = p.getByRole("button", { name: title, exact: true }).first();
          if (await trigger.isVisible().catch(() => false)) {
            await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
            await trigger.click({ timeout: 10_000 }).catch(() => undefined);
            await pauseForDemo(900);
            // Let the option list read, then dismiss without committing.
            await p.getByRole("option").first().isVisible().catch(() => false);
            await pauseForDemo(700);
            await p.keyboard.press("Escape").catch(() => undefined);
            await pauseForDemo(500);
          }
        }

        // ---- 5. Page-size selector (driven directly) -----------------
        // The page-size combobox lives in DataTablePagination next to the
        // "Items per page" label. Open it, reveal the size options, and
        // dismiss with Escape WITHOUT changing the size (read-only reveal).
        const sizeTrigger = p.getByRole("combobox").filter({ visible: true }).last();
        if (await sizeTrigger.isVisible().catch(() => false)) {
          await sizeTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
          await sizeTrigger.click({ timeout: 10_000 }).catch(() => undefined);
          await pauseForDemo(900);
          await p.keyboard.press("Escape").catch(() => undefined);
          await pauseForDemo(500);
        }

        // ---- 6. Single-delete confirmation dialog (open -> dismiss) --
        // Open one card's delete confirmation so the dialog's copy reads on
        // camera, then CANCEL — never confirm. This is the LIVE instance:
        // the dialog is opened-then-dismissed, mutating nothing.
        const deleteBtn = p.locator('[data-testid^="delete-"]').filter({ visible: true }).first();
        if (await deleteBtn.isVisible().catch(() => false)) {
          await deleteBtn.scrollIntoViewIfNeeded().catch(() => undefined);
          await deleteBtn.click({ timeout: 10_000 }).catch(() => undefined);
          const dialog = p.getByTestId("dialog-delete-cohort");
          if (await dialog.isVisible().catch(() => false)) {
            await pauseForDemo(1200);
            // Dismiss WITHOUT deleting — Cancel, falling back to Escape.
            const cancel = p.getByTestId("btn-cancel-delete");
            if (await cancel.isVisible().catch(() => false)) {
              await cancel.click({ timeout: 10_000 }).catch(() => undefined);
            } else {
              await p.keyboard.press("Escape").catch(() => undefined);
            }
            await pauseForDemo(600);
          }
        }

        // Settle on the populated grid so the clip ends on loaded content.
        await waitOutSkeleton(p);
        await pauseForDemo(700);
      },
    );
  });
});
