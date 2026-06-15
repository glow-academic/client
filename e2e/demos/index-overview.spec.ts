import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "index-overview";

// coverage: a top-level ORIENTATION tour of the app index (/home) — the welcome
// header, the overall page layout, and the primary navigation. Reads the page
// top->bottom: rest on "Welcome back", hover the left-nav primary entries so
// the sidebar mapping reads, scroll the assigned-progress strip, hover
// successive simulation cards so each card's title / duration / status badge
// reads, then page the launch deck via the CAROUSEL DOT indicators (a distinct
// affordance from home-assigned's chevrons) and back. Opens one card's
// "View Rubrics" dialog read-only (hold, Escape). Strictly non-destructive:
// never clicks a start-simulation control, never confirms a mutation. Distinct
// from home-overview/home-assigned (deck/progress depth), home-history (table)
// and index-sidebar (nav internals) — this is the whole-page welcome + layout.
// Every beat past the single page-ready assertion no-ops if its target is absent.

test.describe("demo: index overview", () => {
  test("a top-level orientation tour of the app index", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);

    // ONE page-ready assertion. Everything past here is guarded / no-ops when absent.
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // Trim the skeleton lead-in so the captured frames are the loaded page.
    await settleLoaded(page);

    // 1) Welcome header — rest a beat so the personalized greeting + the
    //    overall layout read as the opening orientation frame.
    await scrollToText(page, /welcome back/i);
    await pauseForDemo(900);

    // 2) Primary navigation — hover successive left-nav entries so the sidebar
    //    mapping reads. Read-only hover; never navigates away. Each guarded.
    const navItems = page.locator('[data-sidebar="menu-button"]');
    const navCount = await navItems.count().catch(() => 0);
    for (let i = 0; i < Math.min(navCount, 5); i++) {
      const item = navItems.nth(i);
      if (await item.isVisible().catch(() => false)) {
        await item.hover().catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // 3) Assigned-progress strip — scroll to the live status copy so the
    //    progress section's meaning lands on frame.
    await scrollToText(page, /passed|in progress|not started/i);
    await pauseForDemo(700);

    // 4) Launch deck — hover successive simulation cards so each card's title /
    //    duration / status badge reads. Hover only, no start click.
    const cards = page.getByTestId(/^simulation-card-/);
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(650);
      }
    }
    // Rest on a card's title / duration so the per-card detail reads.
    await hoverFirstVisible(page, "simulation-title");
    await hoverFirstVisible(page, "simulation-duration");

    // 5) Carousel DOT indicators — page the launch deck forward through every
    //    dot then back to the first. The dots are the small rounded-full
    //    buttons under the card grid; cards change on each click. Anchor on the
    //    "{n} of {N}" pager label to learn the page count, then click each dot.
    //    Distinct from home-assigned, which drives the chevron prev/next.
    const pager = page.getByText(/^\d+\s+of\s+\d+$/).first();
    if (await pager.isVisible().catch(() => false)) {
      await pager.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(500);

      const label = (await pager.textContent().catch(() => "")) ?? "";
      const totalPages = Number(label.split(/\s+of\s+/i)[1] ?? "1") || 1;

      // The dot indicators are the trailing small square/round buttons under
      // the grid — the row that holds exactly `totalPages` tiny buttons.
      const dots = page.locator("button.rounded-full");
      const dotCount = await dots.count().catch(() => 0);
      if (dotCount >= totalPages && totalPages > 1) {
        // Forward through each page via its dot.
        for (let i = 1; i < totalPages; i++) {
          const dot = dots.nth(i);
          if (await dot.isVisible().catch(() => false)) {
            await dot.scrollIntoViewIfNeeded().catch(() => undefined);
            await dot.click().catch(() => undefined);
            await pauseForDemo(850);
          }
        }
        // ...back to the first page.
        const firstDot = dots.nth(0);
        if (await firstDot.isVisible().catch(() => false)) {
          await firstDot.click().catch(() => undefined);
          await pauseForDemo(850);
        }
      }
    }

    // 6) One card's "View Rubrics" dialog — open read-only, hold so the rubric
    //    content reads, then Escape. The trigger is the card's icon-only
    //    outline button that is NOT the start-simulation control. Guarded:
    //    no-op if a card lacks rubrics.
    const firstCard = cards.first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      const rubricTrigger = firstCard
        .getByRole("button")
        .filter({ hasNot: page.getByTestId(/^start-/) })
        .first();
      if (await rubricTrigger.isVisible().catch(() => false)) {
        await rubricTrigger.click().catch(() => undefined);
        const rubricDialog = page.getByText(/^Rubrics:/i).first();
        if (await rubricDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await pauseForDemo(1_500);
          await page.keyboard.press("Escape").catch(() => undefined);
          await pauseForDemo(700);
        }
      }
    }

    // 7) Close by returning to the top — rest on the welcome header so the clip
    //    ends on the orienting overview frame. Hover (never click) a start
    //    button on the way to confirm the deck without mutating.
    await hoverFirstVisible(page, /^start-simulation-/);
    await scrollToText(page, /welcome back/i);
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
