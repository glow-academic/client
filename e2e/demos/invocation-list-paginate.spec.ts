import { test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "invocation-list-paginate";

// coverage: tour the EvalHistory invocation LOG on /benchmark READ-ONLY and
// focus its PAGINATION. Scroll + hover the invocation rows, then page the list
// Next -> Prev (the rows visibly change and back), peek the rows-per-page select
// and the column View menu, and open-then-Escape each faceted filter
// (Eval/Model/Profile/Rubric) without committing any selection. Deliberately
// distinct from invocation-overview (which toured the eval/invocation grid): no
// row View/Continue clicks (those navigate to /test/{id}), no eval start, no
// archive, no destructive change. Every beat past the one page-ready assertion
// no-ops if its target is absent.

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

/** Hover the first N invocation rows in turn so the log reads as a real list. */
async function hoverInvocationRows(page: Page, count: number): Promise<void> {
  const rows = page.getByRole("row");
  const total = await rows.count().catch(() => 0);
  // Skip the header row (index 0); hover a handful of data rows.
  for (let i = 1; i <= count && i < total; i++) {
    const row = rows.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await row.hover().catch(() => undefined);
    await pauseForDemo(450);
  }
}

/** Click a pagination nav button by its sr-only accessible name, if enabled. */
async function clickPageNav(page: Page, name: RegExp): Promise<boolean> {
  const btn = page.getByRole("button", { name }).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  if (await btn.isDisabled().catch(() => false)) return false;
  await btn.scrollIntoViewIfNeeded().catch(() => undefined);
  await btn.click().catch(() => undefined);
  // The list re-queries server-side on page change; wait out the row skeleton
  // so we record the populated next/prev page, not the shimmer.
  await settleLoaded(page);
  return true;
}

test.describe("demo: invocation list paginate", () => {
  test("records benchmark invocation log row tour and Next/Prev pagination", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expectBenchmarkGridVisible(page);
    // Trim the skeleton lead-in so the populated page fills the opening frames.
    await settleLoaded(page);

    // 1) Scroll down past the eval grid into the EvalHistory invocation log so
    //    the table — the subject of this clip — is on screen.
    await scrollToText(page, /rows per page|page|history|search|date|eval/i);
    await pauseForDemo(800);

    // 2) Tour the invocation rows: hover the first few so the log reads as a
    //    real list of invocations (date / name / eval / models / score). Purely
    //    read-only — no row View/Continue click (those navigate to /test/{id}).
    await hoverInvocationRows(page, 4);

    // 3) PAGINATION — the focus of this demo. Page the invocation list forward
    //    (rows change) then back (rows restore). Each beat waits out the
    //    re-query skeleton so only the populated pages are recorded. Both
    //    no-op cleanly when there is only a single page.
    await scrollToText(page, /rows per page/i);
    const wentNext = await clickPageNav(page, /go to next page/i);
    if (wentNext) {
      // Hold on the second page of invocations so the changed rows read.
      await hoverInvocationRows(page, 3);
      await pauseForDemo(700);
      // Step back to the first page so the list is restored (non-mutating).
      await clickPageNav(page, /go to previous page/i);
      await hoverInvocationRows(page, 2);
      await pauseForDemo(700);
    }

    // 4) Rows-per-page select: open it to reveal the page-size options, then
    //    Escape WITHOUT changing the size (view-only peek).
    await scrollToText(page, /rows per page/i);
    const rowsPerPage = page.getByRole("combobox").last();
    if (await rowsPerPage.isVisible().catch(() => false)) {
      await rowsPerPage.scrollIntoViewIfNeeded().catch(() => undefined);
      await rowsPerPage.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // 5) Column View menu — reveal the toggle-able columns, Escape (no change).
    await peekTrigger(page, /^View$/i);

    // 6) Open each faceted filter (Eval / Model / Profile / Rubric) to reveal
    //    its options, then Escape without selecting (no committed filter).
    for (const facet of [/^Eval$/i, /^Model$/i, /^Profile$/i, /^Rubric$/i]) {
      await peekTrigger(page, facet);
    }

    // Final settle so the clip ends on the populated invocation log.
    await scrollToText(page, /rows per page|page/i);
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
