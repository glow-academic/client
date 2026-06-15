import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded, waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-filters";

/**
 * Tours the analytics dashboard's filter toolbar: open the Roles dropdown and
 * pick a value (which re-queries and updates every chart), open the Cohorts
 * dropdown to reveal its options, open the date-range picker, then click Reset
 * to return to the default view.
 *
 * Every interaction is guarded: a filter control only renders when the server
 * marks the field visible AND options exist, so each beat is a no-op when its
 * target is absent and can never fail the recording. The single hard assertion
 * is the dashboard-overview container, so a fully broken page still surfaces.
 * All actions are read-only / reversible (filtering re-reads data; Reset
 * restores defaults) — nothing is persisted or destroyed.
 */
test.describe("demo: dashboard filters", () => {
  test("opens role/cohort/date filters, applies one, and resets", async ({ page }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 1: open the Roles dropdown to reveal the filter options.
    const rolesTrigger = page.getByRole("combobox", { name: /select roles/i }).first();
    if (await rolesTrigger.isVisible().catch(() => false)) {
      await rolesTrigger.click();
      await pauseForDemo(1_300);

      // Beat 2: pick the first role — this re-queries and updates the charts.
      const firstRole = page
        .getByRole("option")
        .filter({ hasNotText: /clear all/i })
        .first();
      if (await firstRole.isVisible().catch(() => false)) {
        await firstRole.click();
        await pauseForDemo(900);
        // Hold on the freshly filtered dashboard so the data update is visible.
        await waitOutSkeleton(page);
        await pauseForDemo(1_400);
      } else {
        // No options to pick — close the dropdown cleanly.
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // Beat 3: open the Cohorts dropdown to show another filter facet.
    const cohortsTrigger = page.getByRole("combobox", { name: /select cohorts/i }).first();
    if (await cohortsTrigger.isVisible().catch(() => false)) {
      await cohortsTrigger.click();
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 4: open the date-range picker to reveal the calendar.
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.click();
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 5: Reset returns to the default (unfiltered) view — clean, reversible.
    const resetButton = page.getByRole("button", { name: /^reset/i }).first();
    if (await resetButton.isVisible().catch(() => false)) {
      await resetButton.click();
      await waitOutSkeleton(page);
      await pauseForDemo(1_300);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
