import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-overview";

// # coverage: tour the WHOLE session activity overview top->bottom — the four
// header metric cards (Sessions / Active Profiles / Logins / Emulations), the
// Profile Summary panel + the Problems panel, then the session-history table
// and every read-only affordance that scopes it: the session search box (type
// + clear), the Profile faceted filter (open + Escape), a sortable column-header
// menu (open + Escape, no sort committed), the Rows-per-page Select (open +
// Escape) and the pagination controls, finishing on a hovered session row — the
// drill-in entry point. Every beat past the ONE page-ready assertion no-ops if
// its target is absent; nothing destructive/mutating is ever committed.

test.describe("demo: session overview", () => {
  test("tours the whole session activity overview and its read-only affordances", async ({
    page,
  }) => {
    // ---- Land on the activity surface and settle on the LOADED screen so the
    // clip opens on populated content, not the loading skeleton. ----
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    // Single real page-ready assertion: a broken page still surfaces here.
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ---- Beat 1: the header metric cards — Sessions / Active Profiles /
    // Logins / Emulations at-a-glance. ----
    const metrics = page.getByTestId("activity-metrics");
    if (await metrics.isVisible().catch(() => false)) {
      await metrics.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);
    }
    await scrollToText(page, /sessions|active profiles|logins|emulations/i);

    // ---- Beat 2: the Profile Summary panel — per-profile engagement. ----
    await hoverFirstVisible(page, "activity-profile-summary");
    await scrollToText(page, /profile/i);
    await pauseForDemo(1_000);

    // ---- Beat 3: the Problems panel — recent issues and warnings. ----
    await scrollToText(page, /^Problems$/);
    await hoverFirstVisible(page, "activity-problems");
    await pauseForDemo(1_100);

    // ---- Beat 4: scroll to the session-history table — the feature itself. ----
    await scrollToText(page, /Search sessions/i);
    const table = page.getByTestId("activity-sessions-table");
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // ---- Beat 5: type into the session search so the table visibly re-queries,
    // then clear it (debounced search; clearing resets — non-destructive). ----
    const search = page.getByTestId("activity-search");
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await search.pressSequentially("session", { delay: 55 });
      await pauseForDemo(1_300);
      await search.fill("");
      await pauseForDemo(900);
    }

    // ---- Beat 6: open the Profile faceted filter to reveal that history can be
    // scoped per profile, then Escape without committing a selection. ----
    const profileFilter = page.getByRole("button", { name: /Profile/i }).first();
    if (await profileFilter.isVisible().catch(() => false)) {
      await profileFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 7: open a sortable column-header menu (Tokens) to reveal the
    // Asc/Desc/Hide options, then Escape — read-only, no sort committed. ----
    const sortHeader = page.getByRole("button", { name: /^Tokens$/ }).first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 8: open the Rows-per-page Select to reveal the page-size options,
    // then Escape without changing the page size. ----
    const pageSize = page.getByRole("combobox").first();
    if (await pageSize.isVisible().catch(() => false)) {
      await pageSize.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSize.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 9: surface the pagination controls — the Page X of Y indicator
    // and the next-page button (hover only; no navigation committed). ----
    await scrollToText(page, /Rows per page|Page \d+ of/i);
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    await hoverFirstVisible(page, "activity-sessions-table");
    if (await nextPage.isVisible().catch(() => false)) {
      await nextPage.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // ---- Beat 10: end on a hovered session row — the drill-in entry point into
    // the full session detail / timeline view. Hover only, no click. ----
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
    }
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
