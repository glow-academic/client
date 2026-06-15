import { test } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-overview";

// # coverage: tour the WHOLE benchmark page top->bottom — the analytics
// toolbar (date-range picker + department picker), the eval catalog carousel
// (cards + prev/next paging), then the results-history table with its search
// box, every faceted filter (Eval / Model / Profile / Rubric), the column
// "View" options dropdown, and the rows-per-page pagination control. Every
// beat past the one page-ready assertion is guarded (no-op if absent) and
// non-destructive (open->Escape any picker, type-then-clear search, reset any
// filter we set). End held on the populated results table.

test.describe("demo: benchmark overview", () => {
  test("tours the eval catalog, analytics toolbar, and results-history table", async ({
    page,
  }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the loaded eval grid is on screen.
    await expectBenchmarkGridVisible(page);

    // Open on the populated grid (skeleton waited out + a settle beat).
    await settleLoaded(page);

    // ---- Beat 1 — the eval catalog cards: draw the eye to the first card,
    // then surface a second so the catalog reads as a SET of evals. -------
    await hoverFirstVisible(page, /^eval-card-/);
    await pauseForDemo(1_100);

    const cards = page.getByTestId(/^eval-card-/);
    const secondCard = cards.nth(1);
    if (await secondCard.isVisible().catch(() => false)) {
      await secondCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await secondCard.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // ---- Beat 2 — page the eval carousel forward (only renders when there
    // are >3 evals). The next/prev are icon buttons with sr-only-free chevrons,
    // so target by the "N of M" indicator's sibling controls via role+name on
    // the chevron buttons. Non-destructive: it only changes which 3 cards show. */
    const carouselIndicator = page.getByText(/^\d+ of \d+$/).first();
    if (await carouselIndicator.isVisible().catch(() => false)) {
      // The two buttons flanking the "1 of N" label are prev / next.
      const navButtons = page
        .locator("button")
        .filter({ has: page.locator("svg.lucide-chevron-right, svg.lucide-chevron-left") });
      const nextBtn = navButtons.nth(1);
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextBtn.click().catch(() => undefined);
        await pauseForDemo(1_200);
        // Page back so we leave the carousel where we found it.
        const prevBtn = navButtons.nth(0);
        await prevBtn.click().catch(() => undefined);
        await pauseForDemo(900);
      }
    }

    // ---- Beat 3 — the analytics toolbar: open the date-range picker (its
    // trigger is `#date`), reveal the calendar, then Escape WITHOUT picking a
    // range (no query mutation). ------------------------------------------
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // ---- Beat 4 — open the Department picker (server-gated; may be absent),
    // reveal its options, then dismiss. -----------------------------------
    const deptPicker = page
      .getByRole("button", { name: /Departments/i })
      .first();
    if (await deptPicker.isVisible().catch(() => false)) {
      await deptPicker.scrollIntoViewIfNeeded().catch(() => undefined);
      await deptPicker.click().catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // ---- Beat 5 — pan down to the results-history table. ------------------
    await scrollToText(page, /^Score$/);
    await scrollToText(page, /No tests found\.|^Models$|^Eval$/i);
    await pauseForDemo(1_000);

    // ---- Beat 6 — type into the results search so the list reacts, then
    // clear it (leaves the view as found). --------------------------------
    const search = page
      .getByPlaceholder("Search by name, eval, or models...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await pauseForDemo(400);
      await search.pressSequentially("eval", { delay: 55 });
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
    }

    // ---- Beat 7 — sweep the faceted filters (Eval / Model / Profile /
    // Rubric). Each is a dashed-outline button; open it to reveal its option
    // list, then Escape WITHOUT toggling an option (no filter committed). --
    for (const facet of ["Eval", "Model", "Profile", "Rubric"]) {
      const facetBtn = page
        .getByRole("button", { name: new RegExp(`^${facet}$`) })
        .first();
      if (await facetBtn.isVisible().catch(() => false)) {
        await facetBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await facetBtn.click().catch(() => undefined);
        await pauseForDemo(950);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // ---- Beat 8 — open the column "View" options dropdown to show the table
    // is configurable, then dismiss (no column toggled). ------------------
    const viewOptions = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewOptions.isVisible().catch(() => false)) {
      await viewOptions.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewOptions.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // ---- Beat 9 — open the rows-per-page selector at the bottom of the
    // table, reveal the page-size options, then dismiss. ------------------
    const rowsLabel = page.getByText(/Rows per page/i).first();
    if (await rowsLabel.isVisible().catch(() => false)) {
      await rowsLabel.scrollIntoViewIfNeeded().catch(() => undefined);
      const pageSizeTrigger = page.getByRole("combobox").last();
      if (await pageSizeTrigger.isVisible().catch(() => false)) {
        await pageSizeTrigger.click().catch(() => undefined);
        await pauseForDemo(1_000);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // ---- Final hold — end on the populated results table. -----------------
    await scrollToText(page, /^Score$/);
    await pauseForDemo(1_200);

    await saveDemoVideo(page, TOPIC);
  });
});
