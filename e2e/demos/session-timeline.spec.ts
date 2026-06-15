import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-timeline";

// # coverage: focus the session-history TABLE / per-session timeline on the
// activity surface — distinct from session-overview, which leads with the
// header metric cards. We scroll straight to the sessions table, then tour its
// read-only affordances row by row: type into the session search so the table
// visibly re-queries (then clear), open the Profile faceted filter (open +
// Escape), open a sortable column-header menu to reveal Asc/Desc/Hide on the
// Time column then on Tokens (open + Escape, no sort committed), open the
// Rows-per-page Select to reveal page sizes (open + Escape), surface the
// Page X of Y indicator + the next/previous pagination buttons (hover only),
// and finish hovering session rows — the per-session drill-in entry point.
// Every beat past the ONE page-ready assertion no-ops if its target is absent;
// nothing destructive/mutating is ever committed, and no row is navigated.

test.describe("demo: session timeline", () => {
  test("tours the session-history table and its per-session read-only affordances", async ({
    page,
  }) => {
    // ---- Land on the activity surface and settle on the LOADED screen so the
    // clip never opens on the loading skeleton. ----
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    // Single real page-ready assertion: a broken page still surfaces here.
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ---- Beat 1: skip past the metric cards straight to the session-history
    // table — this demo is about the per-session timeline, not the headline
    // numbers. ----
    await scrollToText(page, /Search sessions/i);
    const table = page.getByTestId("activity-sessions-table");
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // ---- Beat 2: type into the session search so the table visibly re-queries
    // (debounced), then clear it so the full history returns — non-destructive. ----
    const search = page.getByTestId("activity-search");
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await search.pressSequentially("session", { delay: 55 });
      await pauseForDemo(1_300);
      await search.fill("");
      await pauseForDemo(900);
    }

    // ---- Beat 3: open the Profile faceted filter to reveal that the timeline
    // can be scoped per profile, then Escape without committing a selection. ----
    const profileFilter = page.getByRole("button", { name: /Profile/i }).first();
    if (await profileFilter.isVisible().catch(() => false)) {
      await profileFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 4: open the Time column-header menu to reveal Asc/Desc/Hide —
    // how a viewer reorders the session timeline chronologically — then Escape
    // (read-only, no sort committed). ----
    const timeHeader = page.getByRole("button", { name: /^Time$/ }).first();
    if (await timeHeader.isVisible().catch(() => false)) {
      await timeHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await timeHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 5: open the Tokens column-header menu the same way, to show the
    // per-session columns are independently sortable, then Escape. ----
    const tokensHeader = page.getByRole("button", { name: /^Tokens$/ }).first();
    if (await tokensHeader.isVisible().catch(() => false)) {
      await tokensHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await tokensHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 6: hover individual session rows so the per-session detail —
    // Time, Profile, Duration, Groups, Runs, Tokens, Cost, Problems — reads
    // clearly. Hover only; no row is clicked (no navigation committed). ----
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
    }
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(1_200);

    // ---- Beat 7: open the Rows-per-page Select to reveal the page-size options
    // for paging through session history, then Escape without changing it. ----
    const pageSize = page.getByRole("combobox").first();
    if (await pageSize.isVisible().catch(() => false)) {
      await pageSize.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSize.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ---- Beat 8: surface the pagination controls — the Page X of Y indicator
    // and the next/previous buttons that walk further back through the session
    // timeline (hover only; no page navigation committed). ----
    await scrollToText(page, /Rows per page|Page \d+ of/i);
    const nextPage = page.getByRole("button", { name: /Go to next page/i }).first();
    if (await nextPage.isVisible().catch(() => false)) {
      await nextPage.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }
    const prevPage = page.getByRole("button", { name: /Go to previous page/i }).first();
    if (await prevPage.isVisible().catch(() => false)) {
      await prevPage.hover().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // ---- Beat 9: end back on the session-history table, hovering a row — the
    // per-session drill-in entry point into the full timeline detail view. ----
    if (await table.isVisible().catch(() => false)) {
      await table.scrollIntoViewIfNeeded().catch(() => undefined);
    }
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
