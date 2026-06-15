import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-trends";

// coverage: tour the reports analytics page through its TIME-WINDOW / TRENDS lens —
// open the date-range picker calendar (the time-window selector), surface a metric's
// per-profile trend Details hover-card (mean/median/mode), open a metric column's
// sort/re-query dropdown, and exercise the profile search. All beats are read-only
// and non-destructive: every picker/dropdown is opened then dismissed with Escape
// without committing, and the search is cleared back out. Each beat no-ops if its
// target is absent, and we settle past the loading skeleton before touring.
test.describe("demo: reports trends", () => {
  test("records trend and time-window controls for report analytics", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    // Settle past the loading skeleton so the populated metrics fill the frame.
    await settleLoaded(page);

    // Tour the metric columns top-to-bottom so the trend surface reads.
    await scrollToText(page, /avg score|highest|completion|first pass|attempts/i);

    // The date-range picker is the time-window selector that drives every trend
    // metric. Open it to reveal the calendar, hold so the months read, then
    // Escape WITHOUT committing a new range (read-only reveal).
    const dateTrigger = page.locator("#date");
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateTrigger.click().catch(() => undefined);
      // The day-picker grid surfaces once the popover opens.
      const calendar = page.locator(".rdp, [role='grid']").first();
      if (await calendar.isVisible().catch(() => false)) {
        await pauseForDemo(1_100);
      } else {
        await pauseForDemo(700);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Open a metric column's sort dropdown — the read-only re-query control that
    // re-orders the trend table. Reveal the Asc/Desc options, then Escape so no
    // sort is committed.
    const avgScoreHeader = page.getByRole("button", { name: /avg score/i }).first();
    if (await avgScoreHeader.isVisible().catch(() => false)) {
      await avgScoreHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await avgScoreHeader.click().catch(() => undefined);
      const sortAsc = page.getByRole("menuitem", { name: /asc/i }).first();
      if (await sortAsc.isVisible().catch(() => false)) {
        await pauseForDemo(900);
      } else {
        await pauseForDemo(600);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo();
    }

    // Hover the first metric cell to surface its trend Details card
    // (mean / median / mode — the distributional trend behind the headline number).
    const metricCell = page
      .getByText(/^\d+(\.\d+)?%$/)
      .first();
    if (await metricCell.isVisible().catch(() => false)) {
      await metricCell.scrollIntoViewIfNeeded().catch(() => undefined);
      await metricCell.hover().catch(() => undefined);
      // Let the hover-card open and its bullets read.
      await pauseForDemo(1_200);
      // Move the pointer away so the card dismisses cleanly.
      await page.mouse.move(0, 0).catch(() => undefined);
      await pauseForDemo();
    }

    // Exercise the profile search so typing shows, let the table react, then clear it.
    const search = page.getByPlaceholder(/search profiles by name or email/i);
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("ta", { delay: 55 });
      await pauseForDemo(1_100);
      await search.fill("");
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
