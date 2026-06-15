// # coverage: full-page tour of /leaderboard — accolade grid + hover, accolade
// detail modal (Challengers list, open+Escape), ranking table scroll, name
// search (type/clear), the Name + Simulation faceted filter popovers
// (open/reveal/CommandInput/Escape), the View column-toggle dropdown
// (open/reveal/Escape), and a sortable column-header sort menu (open/reveal/
// Escape). Every beat past the one page-ready assertion is guarded + non-
// destructive (filters/search/sort are read-only view state; modals/popovers
// are open-then-Escape; nothing is committed or mutated).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-overview";

test.describe("demo: leaderboard overview", () => {
  test("tours leaderboard accolades, detail modal, ranking table, filters, search, and view options", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    // The loaded container carries `leaderboard-container`; the loading state
    // is `leaderboard-skeleton`, so this resolves uniquely to the loaded view.
    // This is the single real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated board.
    await settleLoaded(page);

    // BEAT 1 — tour the accolade (trophy) grid so the cards register on frame,
    // hovering a couple so the cursor visibly moves across the grid.
    await hoverFirstVisible(page, /^accolade-/);
    const accoladeCards = page.getByTestId(/^accolade-/);
    const cardCount = await accoladeCards.count().catch(() => 0);
    if (cardCount > 1) {
      const second = accoladeCards.nth(1);
      if (await second.isVisible().catch(() => false)) {
        await second.scrollIntoViewIfNeeded().catch(() => undefined);
        await second.hover().catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }
    await pauseForDemo(1_000);

    // BEAT 2 — open one accolade to reveal its detail modal (winner avatar +
    // "Challengers closing in" list). Read-only: open + hold + close, never
    // submitting anything. Guarded so a holder-less board is a clean no-op.
    const accolade = accoladeCards.first();
    if (await accolade.isVisible().catch(() => false)) {
      await accolade.click().catch(() => undefined);
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible().catch(() => false)) {
        await pauseForDemo(1_400);
        // Tour the challengers list inside the modal before closing.
        await scrollToText(page, /challengers/i);
        await pauseForDemo(1_200);
        // Close the modal again (Escape is wired in the component).
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }

    // BEAT 3 — bring the ranking table into view and let the toolbar + rows
    // settle on frame.
    await expect(page.getByTestId("leaderboard-table")).toBeVisible();
    await scrollToText(page, /search users|rank|highest score|attempts/i);
    await pauseForDemo(1_200);

    // BEAT 4 — type into the name search so the table visibly filters live,
    // let the rows react, then clear it so the board returns to full ranking.
    const search = page.getByPlaceholder("Search users by name...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 5 — open the "Name" faceted filter popover to reveal its searchable
    // option list, type into the popover's CommandInput so the option list
    // narrows, then dismiss with Escape WITHOUT selecting (reversible, no
    // committed filter). Guarded so a board without this filter is a no-op.
    const nameFilter = page.getByRole("button", { name: /^Name$/ }).first();
    if (await nameFilter.isVisible().catch(() => false)) {
      await nameFilter.click().catch(() => undefined);
      await pauseForDemo(1_100);
      const nameSearch = page.getByPlaceholder("Name").first();
      if (await nameSearch.isVisible().catch(() => false)) {
        await nameSearch.pressSequentially("a", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 6 — open the "Simulation" faceted filter popover, reveal its scoping
    // options, and dismiss with Escape. Open + Escape only — a non-destructive
    // reveal of the available scenarios/simulations to scope the board by.
    const simFilter = page.getByRole("button", { name: /^Simulation$/ }).first();
    if (await simFilter.isVisible().catch(() => false)) {
      await simFilter.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 7 — open the "View" column-visibility dropdown to reveal the
    // toggle-columns list (which metrics show in the table), then dismiss.
    // Read-only reveal: opened + Escape, no column actually toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 8 — open a sortable column-header sort menu (e.g. "Highest Score")
    // to reveal the Asc/Desc/Hide options, then dismiss with Escape without
    // committing a sort change. Reversible + non-destructive.
    const sortHeader = page
      .getByRole("button", { name: /highest score|time spent|attempts/i })
      .first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // End held on the populated ranking table — substantive content on frame.
    await scrollToText(page, /highest score|rank|attempts/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
