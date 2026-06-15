import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "attempts-lifecycle";

// coverage: full-page tour of the learner home deck — the attempt lifecycle
// surface. We dwell on the SimulationProgress status badges (passed /
// in-progress / not-started), tour the assignment cards (title, duration,
// highest score), open + Escape the read-only Rubrics dialog, page the
// assignment carousel, then exercise the attempt-history table's search box
// and a faceted filter popover. Every beat past the ONE page-ready assertion
// no-ops if its target is absent, and nothing mutating is committed
// (open-then-Escape only; we never press a Start-Simulation button).

test.describe("demo: attempts lifecycle", () => {
  test("tours attempt status states, cards, rubrics, and history on the home deck", async ({
    page,
  }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then dwell on the lifecycle status rows so
    // the LOADED badges (passed / in-progress / not-started), not the shimmer,
    // fill the opening of the clip.
    await settleLoaded(page, {
      scrollTexts: [/passed|in progress|not started|completed|attempt/i],
      hoverTestIds: [/^simulation-progress-/],
    });

    // Tour the progress rows: hover the first, then scroll the status legend
    // (passed / in progress / not started counts) into view.
    await hoverFirstVisible(page, /^simulation-progress-/);
    await scrollToText(page, /passed|in progress|not started|to pass/i);

    // Tour the assignment cards — title, duration, and the highest-score chip.
    await hoverFirstVisible(page, /^simulation-card-/);
    await hoverFirstVisible(page, "simulation-title");
    await hoverFirstVisible(page, "simulation-duration");
    await scrollToText(page, /scenario|min|highest score/i);

    // Open the read-only Rubrics dialog (the outline icon button carrying the
    // table glyph in a card header) so its rubric grid reads, then Escape.
    // Guarded: no-op if no card exposes the trigger.
    const rubricTrigger = page
      .locator('[data-testid^="simulation-card-"] button:has(svg.lucide-table)')
      .first();
    if (await rubricTrigger.isVisible().catch(() => false)) {
      await rubricTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await rubricTrigger.click().catch(() => undefined);
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible().catch(() => false)) {
        await pauseForDemo(1_200);
        // Page the rubric pagination forward if multiple rubrics exist.
        const nextRubric = dialog.getByRole("button", { name: /go to next rubric/i });
        if (await nextRubric.isEnabled().catch(() => false)) {
          await nextRubric.click().catch(() => undefined);
          await pauseForDemo(900);
        }
        await page.keyboard.press("Escape");
        await pauseForDemo();
      }
    }

    // Page the assignment carousel forward (read-only paging) if a second page
    // exists, then page back so the deck is restored. The pager renders an
    // enabled chevron only when there is somewhere to scroll.
    const carouselNext = page
      .locator('button:has(svg.lucide-chevron-right)')
      .first();
    if (await carouselNext.isVisible().catch(() => false)) {
      if (await carouselNext.isEnabled().catch(() => false)) {
        await carouselNext.click().catch(() => undefined);
        await waitOutSkeleton(page);
        await hoverFirstVisible(page, /^simulation-card-/);
        const carouselPrev = page
          .locator('button:has(svg.lucide-chevron-left)')
          .first();
        if (await carouselPrev.isEnabled().catch(() => false)) {
          await carouselPrev.click().catch(() => undefined);
          await pauseForDemo();
        }
      }
    }

    // Attempt-history table: type into the search box so the typing shows, let
    // it re-query, then clear it. Guarded on visibility.
    const historySearch = page
      .getByPlaceholder(/search by name, simulation, or scenarios/i)
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click();
      await historySearch.pressSequentially("office", { delay: 55 });
      await pauseForDemo(1_000);
      await waitOutSkeleton(page);
      await historySearch.fill("");
      await historySearch.press("Enter");
      await pauseForDemo(900);
      await waitOutSkeleton(page);
    }

    // Open a read-only faceted filter popover (Simulation / Scenarios / Mode)
    // to reveal its options, then dismiss with Escape WITHOUT committing a
    // filter. Guarded: tries the first filter trigger that is present.
    for (const title of [/^Simulation$/, /^Scenarios$/, /^Mode$/, /^Name$/]) {
      const trigger = page.getByRole("button", { name: title }).first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click().catch(() => undefined);
        await pauseForDemo(1_000);
        await page.keyboard.press("Escape");
        await pauseForDemo();
        break;
      }
    }

    await saveDemoVideo(page, TOPIC);
  });
});
