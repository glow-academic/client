import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-leaderboard-section";

// # coverage: tour the WHOLE /analytics/reports leaderboard table and drive REAL
// visual progression on camera (motion upgrade — the prior clip was a static
// table). After landing on the loaded table we: (1) COMMIT a sort on the Avg
// Score header (open menu -> Desc) and watch the rows reorder, then COMMIT a
// second sort on Highest so they reorder again — both server-driven via URL
// params, read-only + reversible, no mutation; (2) paginate Next then Prev so
// the visible rows change and return; (3) type a real profile term into the
// search so rows narrow, hold, then clear so the full set returns; plus open a
// faceted filter + the column-View menu + the Rows-per-page Select (open ->
// Escape, nothing committed) and keep the scroll/hover tour. Every beat past the
// ONE page-ready assertion no-ops if its target is absent; each commit settles
// the skeleton before the next beat so no loading frame is captured. Nothing
// destructive/irreversible is ever confirmed.

test.describe("demo: reports leaderboard section", () => {
  test("tours the reports leaderboard and drives sort/paginate/search progression", async ({
    page,
  }) => {
    // ---- Land on the reports surface and settle on the LOADED table so the clip
    // opens on populated rows, not the loading skeleton. ----
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    // Single real page-ready assertion: a broken page still surfaces here.
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ---- Beat 1: take in the leaderboard — scroll across the metric columns
    // and hover the top-ranked profile row (the drill-in entry point; hover
    // only, no click — clicking a row navigates away). ----
    await hoverFirstVisible(page, /^reports-profile-row-/);
    await scrollToText(page, /Avg Score|Highest|Completion|Msgs\/Sess|Attempts/i);
    await pauseForDemo(1_000);

    // ---- Beat 2: COMMIT a sort on the Avg Score column — open the header menu,
    // pick Desc, and let the rows REORDER on camera. Server-driven via the
    // reportsSortBy/reportsSortOrder URL params; read-only and reversible. ----
    const avgScoreHeader = page.getByRole("button", { name: /^Avg Score$/ }).first();
    if (await avgScoreHeader.isVisible().catch(() => false)) {
      await avgScoreHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await avgScoreHeader.click().catch(() => undefined);
      await pauseForDemo(900);
      const desc = page.getByRole("menuitem", { name: /^Desc$/ }).first();
      if (await desc.isVisible().catch(() => false)) {
        await desc.click().catch(() => undefined);
        // The sort re-queries the server — wait the skeleton out, then hold on
        // the freshly reordered rows so the change reads.
        await waitOutSkeleton(page);
        await hoverFirstVisible(page, /^reports-profile-row-/);
        await pauseForDemo(1_200);
      } else {
        await page.keyboard.press("Escape");
        await pauseForDemo(600);
      }
    }

    // ---- Beat 3: sort AGAIN on a different column (Highest) so the rows reorder
    // a second time — visibly different frames, still read-only. ----
    const highestHeader = page.getByRole("button", { name: /^Highest$/ }).first();
    if (await highestHeader.isVisible().catch(() => false)) {
      await highestHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await highestHeader.click().catch(() => undefined);
      await pauseForDemo(900);
      const desc = page.getByRole("menuitem", { name: /^Desc$/ }).first();
      if (await desc.isVisible().catch(() => false)) {
        await desc.click().catch(() => undefined);
        await waitOutSkeleton(page);
        await hoverFirstVisible(page, /^reports-profile-row-/);
        await pauseForDemo(1_200);
      } else {
        await page.keyboard.press("Escape");
        await pauseForDemo(600);
      }
    }

    // ---- Beat 4: paginate — go to the NEXT page so the visible rows change,
    // hold, then go BACK to the first page (reversible; no mutation). The
    // buttons disable at the ends, so only act when enabled. ----
    await scrollToText(page, /Rows per page|Page \d+ of/i);
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    if (
      (await nextPage.isVisible().catch(() => false)) &&
      (await nextPage.isEnabled().catch(() => false))
    ) {
      await nextPage.scrollIntoViewIfNeeded().catch(() => undefined);
      await nextPage.click().catch(() => undefined);
      await waitOutSkeleton(page);
      await scrollToText(page, /Page \d+ of/i);
      await hoverFirstVisible(page, /^reports-profile-row-/);
      await pauseForDemo(1_100);

      const prevPage = page.getByRole("button", { name: /Go to previous page/i }).first();
      if (
        (await prevPage.isVisible().catch(() => false)) &&
        (await prevPage.isEnabled().catch(() => false))
      ) {
        await prevPage.click().catch(() => undefined);
        await waitOutSkeleton(page);
        await pauseForDemo(900);
      }
    }

    // ---- Beat 5: type a real profile term into the search so the rows NARROW
    // (pressSequentially so the keystrokes show; debounced server query), hold,
    // then clear so the full leaderboard returns — non-destructive. ----
    const search = page.getByPlaceholder("Search profiles by name or email...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      // Debounce is 500ms before the URL commits + re-query — hold past it so
      // the narrowed result set lands on frame, then settle any skeleton.
      await pauseForDemo(1_400);
      await waitOutSkeleton(page);
      await hoverFirstVisible(page, /^reports-profile-row-/);
      await pauseForDemo(900);
      await search.fill("");
      await pauseForDemo(1_200);
      await waitOutSkeleton(page);
    }

    // ---- Beat 6: open a faceted filter (Name / Scenario / Simulation) to reveal
    // that the leaderboard can be scoped, then Escape without committing. The
    // filters only render when their options exist, so this no-ops otherwise. ----
    const facetedFilter = page
      .getByRole("button", { name: /^(Name|Scenario|Simulation)$/ })
      .first();
    if (await facetedFilter.isVisible().catch(() => false)) {
      await facetedFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 7: open the column-View menu to reveal the toggleable metric
    // columns, then Escape — read-only, no column toggled. ----
    const viewOptions = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewOptions.isVisible().catch(() => false)) {
      await viewOptions.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 8: open the Rows-per-page Select to reveal the page-size options,
    // then Escape without changing the size. ----
    const pageSize = page.getByRole("combobox").first();
    if (await pageSize.isVisible().catch(() => false)) {
      await pageSize.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSize.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 9: end on a hovered top profile row — the drill-in entry point
    // into the per-profile detailed report. Hover only, no click. ----
    await hoverFirstVisible(page, /^reports-profile-row-/);
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
