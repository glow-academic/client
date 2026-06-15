import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-header";

// coverage: tours the analytics dashboard's TOP KPI/metrics header row and the
// analytics filter toolbar — the scope pickers (Attempts / Roles / Cohorts /
// Departments) and the date-range picker. Each KPI card is paged through via
// the real header carousel control (a .click on `dashboard-header-carousel-*`),
// then every toolbar filter is opened to reveal its options and dismissed with
// Escape WITHOUT committing a change. The lower charts (rubric/history) are
// deliberately left to the sibling demos.
//
// Every beat past the single page-ready assertion (`dashboard-overview`) is
// guarded by an isVisible().catch(()=>false) check, so a control that the
// server marks hidden (or that has no options) simply no-ops and never fails
// the recording. All interactions are read-only and reversible: opening a
// dropdown and pressing Escape commits nothing, and paging the carousel only
// changes which cards are on screen — nothing is persisted or destroyed.
test.describe("demo: dashboard header", () => {
  test("tours the KPI header row and opens each analytics filter", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    // Wait out the loading skeleton so the opening frames are the populated KPIs.
    await settleLoaded(page);

    // Beat 1: settle on the top KPI strip — name a few of the headline metrics
    // so the eye lands on the header row before anything moves.
    await scrollToText(page, /average score|completion|pass rate|total attempts/i);
    await pauseForDemo(1_100);

    // Beat 2: page the KPI carousel forward to reveal the next set of metric
    // cards (a real click drives the header carousel), hold, then page back so
    // the strip returns to its opening state.
    const nextCard = page.getByTestId("dashboard-header-carousel-next").first();
    if (await nextCard.isVisible().catch(() => false)) {
      await nextCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await nextCard.click();
      await pauseForDemo(1_400);
      await nextCard.click();
      await pauseForDemo(1_400);

      const prevCard = page.getByTestId("dashboard-header-carousel-prev").first();
      if (await prevCard.isVisible().catch(() => false)) {
        await prevCard.click();
        await pauseForDemo(1_200);
        await prevCard.click();
        await pauseForDemo(1_200);
      }
    }

    // Beat 3: open the Attempts scope picker (General / Practice / Archived) to
    // reveal its options, then Escape — no selection committed.
    const attemptsTrigger = page.getByRole("combobox", { name: /select content type/i }).first();
    if (await attemptsTrigger.isVisible().catch(() => false)) {
      await attemptsTrigger.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 4: open the Roles scope picker to show the role facet, then Escape.
    const rolesTrigger = page.getByRole("combobox", { name: /select roles/i }).first();
    if (await rolesTrigger.isVisible().catch(() => false)) {
      await rolesTrigger.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 5: open the Cohorts scope picker to reveal cohort options, then Escape.
    const cohortsTrigger = page.getByRole("combobox", { name: /select cohorts/i }).first();
    if (await cohortsTrigger.isVisible().catch(() => false)) {
      await cohortsTrigger.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 6: open the Departments scope picker to reveal department options,
    // then Escape.
    const departmentsTrigger = page
      .getByRole("combobox", { name: /select departments/i })
      .first();
    if (await departmentsTrigger.isVisible().catch(() => false)) {
      await departmentsTrigger.click();
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 7: open the date-range picker to reveal the calendar, then Escape —
    // the range is left untouched.
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.click();
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
