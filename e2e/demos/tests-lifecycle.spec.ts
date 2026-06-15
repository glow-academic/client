import { test } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  hoverFirstVisible,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tests-lifecycle";

// coverage: tour the WHOLE benchmark/test surface — eval cards + run controls
// (hover only, no live run), the eval/run carousel, then the run/score history
// table and EVERY one of its read-only affordances: free-text search, each
// faceted filter (Eval / Model / Profile / Rubric) opened + Escaped, the column
// View dropdown opened + Escaped, and pagination next→prev. Many distinct
// states; all non-mutating (open-then-Escape, type-then-clear, page-then-back).
//
// HARD RULES: live instance, NON-DESTRUCTIVE only. Every beat past the single
// page-ready assertion (expectBenchmarkGridVisible) no-ops if its target is
// absent, via an isVisible().catch(()=>false) guard. settle/waitOutSkeleton
// runs before history beats so no loading-skeleton frame is recorded.

test.describe("demo: tests lifecycle", () => {
  test("tours the benchmark eval grid, run controls, and the run/score history table", async ({
    page,
  }) => {
    // Beat 1 — land on the benchmark surface (the canonical test-lifecycle
    // home) and hold on the populated eval grid, not the skeleton.
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    await waitOutSkeleton(page);
    await pauseForDemo(1200);

    // Beat 2 — bring an eval card into focus so its lifecycle controls read
    // clearly. Hover only; starting a run mutates live data.
    await hoverFirstVisible(page, /^eval-card-/);
    await pauseForDemo(1000);

    // Beat 3 — settle on the run/start control itself (the infinite-mode
    // button) so the viewer sees how a run is kicked off — without committing.
    await hoverFirstVisible(page, /^start-infinite-/);
    await pauseForDemo(1100);

    // Beat 4 — page the eval carousel forward then back (read-only): more eval
    // cards come into view, then we restore the original page. The carousel
    // nav uses bare chevron buttons (no testid), so we target them by their
    // lucide icon. Guarded + only clicked when enabled (more than one page).
    const nextChevron = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-chevron-right") })
      .first();
    if (await nextChevron.isVisible().catch(() => false)) {
      const enabled = await nextChevron.isEnabled().catch(() => false);
      if (enabled) {
        await nextChevron.click().catch(() => undefined);
        await pauseForDemo(1100);
        const prevChevron = page
          .locator("button")
          .filter({ has: page.locator("svg.lucide-chevron-left") })
          .first();
        if (await prevChevron.isVisible().catch(() => false)) {
          await prevChevron.click().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
    }

    // Beat 5 — move down into the run/score history: the table below the grid
    // where each prior run carries its date, name, eval, models and score.
    await scrollToText(page, /search by name|date|score|models|no tests found/i);
    await pauseForDemo(1000);

    // Beat 6 — exercise the history free-text search: type so a viewer sees
    // runs being filtered, let it react, then clear it (fully reversible).
    const historySearch = page
      .getByPlaceholder("Search by name, eval, or models...")
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click().catch(() => undefined);
      await historySearch.pressSequentially("eval", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1100);
      await waitOutSkeleton(page);
      await historySearch.fill("").catch(() => undefined);
      await pauseForDemo(700);
      await waitOutSkeleton(page);
    }

    // Beat 7 — open each faceted filter in turn, reveal its options, Escape.
    // These are read-only view filters; we open-then-dismiss without selecting,
    // so the history is never re-scoped. Each is guarded on its trigger.
    for (const facet of ["Eval", "Model", "Profile", "Rubric"]) {
      const trigger = page.getByRole("button", { name: facet, exact: true }).first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click().catch(() => undefined);
        await pauseForDemo(900);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(400);
      }
    }

    // Beat 8 — open the column View dropdown, reveal the toggleable columns
    // (Eval / Models / Score / Date / Name), hold so they read, Escape. No
    // toggle is committed, so column visibility is left untouched.
    const viewButton = page.getByRole("button", { name: "View" }).first();
    if (await viewButton.isVisible().catch(() => false)) {
      await viewButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewButton.click().catch(() => undefined);
      await pauseForDemo(1100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // Beat 9 — page the history table forward then back (read-only URL nav):
    // a fresh page of runs lands, then we return to page 1. Settle between so
    // no loading skeleton is captured. Guarded on the enabled next button.
    const nextPage = page.getByRole("button", { name: "Go to next page" }).first();
    if (await nextPage.isVisible().catch(() => false)) {
      const canNext = await nextPage.isEnabled().catch(() => false);
      if (canNext) {
        await nextPage.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextPage.click().catch(() => undefined);
        await waitOutSkeleton(page);
        await pauseForDemo(1100);
        const prevPage = page
          .getByRole("button", { name: "Go to previous page" })
          .first();
        if (await prevPage.isVisible().catch(() => false)) {
          await prevPage.click().catch(() => undefined);
          await waitOutSkeleton(page);
          await pauseForDemo(900);
        }
      }
    }

    // Beat 10 — settle on the loaded history table so the clip ends on
    // substantive lifecycle content rather than mid-interaction.
    await settleLoaded(page);
    await hoverLocatorIfVisible(page.getByTestId("benchmark-eval-grid"));
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
