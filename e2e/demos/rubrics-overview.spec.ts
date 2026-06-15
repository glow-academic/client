// # coverage: full-page tour of /platform/rubrics — the populated rubric-card
// grid (hover cards so the inner standards/criteria table reads), the name
// search (type/clear), the three faceted-filter popovers Eval + Simulation +
// Department (open/reveal/CommandInput-type/Escape), the View column-visibility
// dropdown (open/reveal/Escape), the card-selection bulk toolbar (select one
// card → reveal Delete/Edit bulk actions → Unselect All, never confirming),
// pagination Next/Prev, and the page-size selector (open/reveal/Escape). Every
// beat past the one page-ready assertion is guarded + non-destructive: search/
// filters/view/page-size are read-only view state, popovers/menus are open-then-
// Escape, the selection is reverted with Unselect All, and nothing is committed
// (no rubric deleted, duplicated, edited, or created; no filter applied; no row
// mutated).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-overview";

test.describe("demo: rubrics overview", () => {
  test("tours the rubric library grid, search, faceted filters, view options, selection toolbar, and pagination", async ({
    page,
  }) => {
    await page.goto("/platform/rubrics");
    await expectAuthenticated(page);
    // The loaded list renders `rubrics-grid` (the card container); the loading
    // state renders skeletons (detached once data lands). This is the single
    // real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("rubrics-grid")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated library.
    await settleLoaded(page);

    // BEAT 1 — tour the rubric-card grid so the cards (and the inner
    // standards/criteria TableRubric each card carries) register on frame,
    // hovering the first two so the cursor visibly tracks across the library.
    await hoverFirstVisible(page, "rubric-card");
    const cards = page.getByTestId("rubric-card");
    const cardCount = await cards.count().catch(() => 0);
    if (cardCount > 1) {
      const second = cards.nth(1);
      if (await second.isVisible().catch(() => false)) {
        await second.scrollIntoViewIfNeeded().catch(() => undefined);
        await second.hover().catch(() => undefined);
        await pauseForDemo(1_100);
      }
    }
    // Scroll a card's points / pass summary into frame so the metric row reads.
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(1_000);

    // BEAT 2 — type into the rubric name search so the grid visibly filters
    // live (debounced re-query), let the cards react, then clear it so the
    // library returns to the full set. Reversible view state.
    const search = page.getByTestId("rubrics-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await search.press("Enter").catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 3 — open the "Eval" faceted-filter popover to reveal the evals the
    // library can be scoped by, type into its CommandInput so the option list
    // narrows, then dismiss with Escape WITHOUT selecting (no committed filter).
    // Guarded so a library without this filter is a clean no-op.
    const evalFilter = page.getByRole("button", { name: /^Eval$/ }).first();
    if (await evalFilter.isVisible().catch(() => false)) {
      await evalFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const evalSearch = page.getByPlaceholder("Eval").first();
      if (await evalSearch.isVisible().catch(() => false)) {
        await evalSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 4 — open the "Simulation" faceted-filter popover (server-driven) to
    // reveal the activities the library can be narrowed to, type into its
    // CommandInput so the option list re-queries, then dismiss with Escape
    // without applying. Open + reveal + Escape only.
    const simFilter = page.getByRole("button", { name: /^Simulation$/ }).first();
    if (await simFilter.isVisible().catch(() => false)) {
      await simFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const simSearch = page.getByPlaceholder("Simulation").first();
      if (await simSearch.isVisible().catch(() => false)) {
        await simSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 5 — open the "Department" faceted-filter popover (server-driven) to
    // reveal the departments the library can be scoped by, type into its
    // CommandInput, then dismiss with Escape without committing. Non-destructive
    // reveal of the available scoping options, nothing applied.
    const deptFilter = page.getByRole("button", { name: /^Department$/ }).first();
    if (await deptFilter.isVisible().catch(() => false)) {
      await deptFilter.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const deptSearch = page.getByPlaceholder("Department").first();
      if (await deptSearch.isVisible().catch(() => false)) {
        await deptSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — open the "View" column-visibility dropdown to reveal the
    // toggle-features list (which card sections show: points/pass summary,
    // description, the standards table), then dismiss. Read-only reveal: opened
    // + Escape, no feature actually toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 7 — click a rubric card to select it, revealing the selection bulk
    // toolbar (Delete / Edit bulk actions + the cross-page "Select all matching"
    // affordance). This is reversible view state (URL-backed selection), NOT a
    // mutation — we never click Delete or Edit, only reveal them, then click
    // "Unselect All" to return the toolbar to its default filter bar. Guarded so
    // a card-less library is a clean no-op.
    const firstCard = cards.first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstCard.click().catch(() => undefined);
      await pauseForDemo(1_300);
      // Reveal the selection action bar (Delete N of M / Edit N of M) on frame.
      await scrollToText(page, /delete \d+|edit \d+|unselect all/i);
      await pauseForDemo(1_000);
      // Revert: clear the selection so nothing is left staged.
      const unselect = page.getByRole("button", { name: /unselect all/i }).first();
      if (await unselect.isVisible().catch(() => false)) {
        await unselect.click().catch(() => undefined);
        await pauseForDemo(1_000);
      } else {
        // Fallback — re-click the card to toggle the selection back off.
        await firstCard.click().catch(() => undefined);
        await pauseForDemo(800);
      }
    }

    // BEAT 8 — page through the library: click Next (only if a next page exists)
    // so a fresh page of rubric cards loads, hold, then return with Prev so the
    // clip ends on the original page. Guarded — a single-page library disables
    // Next, so the whole beat no-ops cleanly.
    const next = page
      .getByRole("button", { name: /next page/i })
      .filter({ visible: true })
      .first();
    if (
      (await next.isVisible().catch(() => false)) &&
      (await next.isEnabled().catch(() => false))
    ) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click().catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(1_000);
      const prev = page
        .getByRole("button", { name: /previous page/i })
        .filter({ visible: true })
        .first();
      if (
        (await prev.isVisible().catch(() => false)) &&
        (await prev.isEnabled().catch(() => false))
      ) {
        await prev.click().catch(() => undefined);
        await settleLoaded(page);
        await pauseForDemo(900);
      }
    }

    // BEAT 9 — open the page-size selector (the pagination combobox) to reveal
    // the per-page options, then dismiss with Escape WITHOUT choosing a new size
    // (changing it would re-query) — an open-then-close reveal only, leaving the
    // page size unchanged. Guarded so a library with no selector no-ops.
    const pageSizeTrigger = page
      .getByRole("combobox")
      .filter({ visible: true })
      .first();
    if (await pageSizeTrigger.isVisible().catch(() => false)) {
      await pageSizeTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSizeTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // End held on the populated rubric grid — substantive content on frame.
    await scrollToText(page, /total points|pass:/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
