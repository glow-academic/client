import { test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "invocation-overview";

// coverage: tour the whole /benchmark page — the eval/invocation grid (with its
// queued/running/completed invocation stats + carousel paging), the analytics
// toolbar's date-range picker, and the EvalHistory table's search box, faceted
// filters (Eval/Model/Profile/Rubric), column View menu, and pagination — all
// non-destructively (open-then-Escape; no eval start, no archive, no commit).

/** Open a Popover/Dropdown trigger by accessible name, hold so its panel reads, Escape. */
async function peekTrigger(page: Page, name: RegExp): Promise<void> {
  const trigger = page.getByRole("button", { name }).first();
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click().catch(() => undefined);
  await pauseForDemo(1_100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(400);
}

test.describe("demo: invocation overview", () => {
  test("records benchmark invocation status and drill-in context", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    // Trim the skeleton lead-in so the populated grid fills the opening frames.
    await settleLoaded(page);

    // 1) The eval/invocation cards — each shows total / completed / pending
    //    invocation counts and a status badge. Hold so the fan-out reads.
    await scrollToText(page, /invocation|status|queued|running|completed|models|runs/i);
    await pauseForDemo(900);

    // 2) Carousel paging across the eval grid (guarded — only present when
    //    there is more than one page of evals). Page forward, then back.
    const nextPage = page.getByRole("button", { name: /next|chevron/i });
    // The carousel nav buttons carry no text; target the lucide chevrons by
    // their position in the grid header. Both no-op if absent.
    const chevrons = page.locator(".lucide-chevron-right, .lucide-chevron-left");
    if (await chevrons.first().isVisible().catch(() => false)) {
      const right = page.locator(".lucide-chevron-right").first();
      const left = page.locator(".lucide-chevron-left").first();
      if (await right.isVisible().catch(() => false)) {
        await right.click({ force: true }).catch(() => undefined);
        await pauseForDemo(900);
      }
      if (await left.isVisible().catch(() => false)) {
        await left.click({ force: true }).catch(() => undefined);
        await pauseForDemo(800);
      }
    }
    // Keep `nextPage` referenced without committing anything destructive.
    void nextPage;

    // 3) Analytics toolbar: open the date-range picker, reveal the calendar,
    //    Escape WITHOUT picking a range (read-only peek).
    await peekTrigger(page, /filter by date|^\w+ \d+.*-.*\d+$/i);

    // 4) Scroll down into the EvalHistory invocation log.
    await scrollToText(page, /rows per page|page|history|search/i);
    await pauseForDemo(700);

    // 5) Type into the history search so the filtering shows, let it react,
    //    then clear it back to the full list (non-mutating view filter).
    const search = page.getByPlaceholder("Search by name, eval, or models...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("eval", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_000);
      // Wait out any re-query skeleton before the next beat.
      await settleLoaded(page);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
      await settleLoaded(page);
    }

    // 6) Open each faceted filter (Eval / Model / Profile / Rubric) to reveal
    //    its options, then Escape without selecting (no committed filter).
    for (const facet of [/^Eval$/i, /^Model$/i, /^Profile$/i, /^Rubric$/i]) {
      await peekTrigger(page, facet);
    }

    // 7) Column View menu — reveal the toggle-able columns, Escape.
    await peekTrigger(page, /^View$/i);

    // 8) Pagination footer: open the rows-per-page select, reveal the options,
    //    Escape without changing the page size (view-only).
    await scrollToText(page, /rows per page/i);
    const rowsPerPage = page.getByRole("combobox").last();
    if (await rowsPerPage.isVisible().catch(() => false)) {
      await rowsPerPage.scrollIntoViewIfNeeded().catch(() => undefined);
      await rowsPerPage.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // Final settle so the clip ends on the populated invocation log.
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
