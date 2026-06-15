import { test } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  hoverFirstVisible,
  hoverLocatorIfVisible,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tests-overview";

// # coverage: CENTER the TESTS/evals catalog list on /benchmark — the eval
// cards rendered AS TESTS by BenchmarkZone. Distinct from benchmark-overview
// (which toured the analytics toolbar + results-history table) and from
// invocation-overview/list (the invocation log). Here we tour the eval-card
// grid top->bottom: read each card's config/status (the "∞ min" runtime +
// "N models" stat row + rubric), hover several cards so the catalog reads as a
// SET of tests, settle on each card's run controls (Start Eval + the
// infinite-mode button) WITHOUT firing a run, page the eval carousel
// forward->back, then a brief guarded glance at the run-history table below so
// the surface reads end-to-end — all held on the tests grid.
//
// HARD RULES: live instance, NON-DESTRUCTIVE only — no eval is ever started
// (hover/tooltip only), the carousel is paged then restored, and any history
// search is typed-then-cleared. Every beat past the single page-ready assertion
// (expectBenchmarkGridVisible) no-ops if its target is absent via an
// isVisible().catch(()=>false) guard. waitOutSkeleton/settleLoaded run after
// the route lands and between paging so no loading-skeleton frame is recorded.

test.describe("demo: tests overview", () => {
  test("tours the eval-card catalog as the test surface — config, status, and run controls", async ({
    page,
  }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the loaded eval/tests grid is on screen.
    await expectBenchmarkGridVisible(page);

    // Open on the populated tests grid (skeleton waited out + a settle beat).
    await settleLoaded(page);

    // ---- Beat 1 — the first test card: draw the eye to it and let its config
    // read — the eval name/description plus the stat row (∞ runtime + N models).
    await hoverFirstVisible(page, /^eval-card-/);
    await pauseForDemo(1_100);

    // Surface the config stats explicitly so the card reads as a TEST: the
    // unbounded-runtime "∞ min" duration and the "N models" benchmarked count.
    await hoverFirstVisible(page, "eval-duration");
    await hoverFirstVisible(page, "eval-models");
    await pauseForDemo(900);

    // ---- Beat 2 — walk across the catalog so it reads as a SET of tests:
    // bring the 2nd and 3rd cards into focus in turn (guarded — a thin catalog
    // may have only one). -------------------------------------------------
    const cards = page.getByTestId(/^eval-card-/);
    for (const idx of [1, 2]) {
      const card = cards.nth(idx);
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }

    // ---- Beat 3 — settle on a test's RUN CONTROLS so the viewer sees how a
    // test is launched, without committing. The infinite-mode button carries a
    // testid; hovering it also reveals its "Infinite Mode" tooltip. Hover only —
    // a real click would start a live eval. -------------------------------
    await hoverFirstVisible(page, /^start-infinite-/);
    await pauseForDemo(1_100);

    // The primary "Start Eval" button is the other half of the run controls —
    // bring it into focus (no click) so the launch affordance reads clearly.
    const startEval = page.getByRole("button", { name: /^Start Eval$/ }).first();
    if (await startEval.isVisible().catch(() => false)) {
      await startEval.scrollIntoViewIfNeeded().catch(() => undefined);
      await startEval.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // ---- Beat 4 — page the eval carousel forward then back (read-only): a
    // fresh page of test cards comes into view, then we restore the original
    // page so the catalog is left as found. The carousel nav uses bare chevron
    // buttons (no testid), so we target them by their lucide icon and only
    // click when enabled (renders only with more than one page of evals). --
    const nextChevron = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-chevron-right") })
      .first();
    if (await nextChevron.isVisible().catch(() => false)) {
      if (await nextChevron.isEnabled().catch(() => false)) {
        await nextChevron.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextChevron.click().catch(() => undefined);
        await pauseForDemo(1_200);
        // Hover a card on the new page so the fresh tests read.
        await hoverFirstVisible(page, /^eval-card-/);
        await pauseForDemo(900);
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

    // ---- Beat 5 — re-center the tests grid so the catalog dominates the clip
    // before the brief history glance below. -----------------------------
    await hoverLocatorIfVisible(page.getByTestId("benchmark-eval-grid"));
    await pauseForDemo(900);

    // ---- Beat 6 — a brief, guarded glance at the run-history table that sits
    // below the catalog, so the surface reads end-to-end. We type into its
    // search so a viewer sees prior test runs filter, then clear it (fully
    // reversible). This stays a glance — the catalog is the focus. --------
    const historySearch = page
      .getByPlaceholder("Search by name, eval, or models...")
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click().catch(() => undefined);
      await pauseForDemo(400);
      await historySearch.pressSequentially("eval", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_200);
      await waitOutSkeleton(page);
      await historySearch.fill("").catch(() => undefined);
      await pauseForDemo(700);
      await waitOutSkeleton(page);
    }

    // ---- Final hold — return to and settle on the populated tests grid so the
    // clip ends on the eval/test catalog, not mid-interaction. ------------
    await hoverLocatorIfVisible(page.getByTestId("benchmark-eval-grid"));
    await hoverFirstVisible(page, /^eval-card-/);
    await settleLoaded(page);

    await saveDemoVideo(page, TOPIC);
  });
});
