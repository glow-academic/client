import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-assigned";

// coverage: tour the /home assigned/required simulations page top->bottom with
// visibly changing frames — page the launch-card carousel forward through ALL
// pages then back (cards change each page), open one card's "View Rubrics"
// dialog (hold, Escape), hover successive progress rows so the highlight moves.
// Strictly non-destructive: never click a start-simulation button, never
// confirm a mutation. Every beat past the page-ready assertion no-ops if its
// target is absent.

test.describe("demo: home assigned simulations", () => {
  test("records assigned simulation progress and launch cards", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    // Settle past the loading skeleton so no shimmer frame is recorded.
    await settleLoaded(page);
    await pauseForDemo();

    // --- Progress section: hover successive rows so the highlight moves. ---
    const progressRows = page.getByTestId(/^simulation-progress-/);
    const rowCount = await progressRows.count().catch(() => 0);
    for (let i = 0; i < Math.min(rowCount, 4); i++) {
      const row = progressRows.nth(i);
      if (await row.isVisible().catch(() => false)) {
        await row.scrollIntoViewIfNeeded().catch(() => undefined);
        await row.hover().catch(() => undefined);
        await pauseForDemo(750);
      }
    }
    // Read the live status copy so the section's meaning lands.
    await scrollToText(page, /passed|in progress|not started/i);

    // --- Launch-card carousel: page forward through ALL pages, then back. ---
    // The pager renders an "{n} of {N}" label flanked by Chevron prev/next
    // buttons (no testid). Anchor on that label, then drive its sibling
    // buttons. All guarded: a single-page (or empty) carousel no-ops.
    const pager = page.getByText(/^\d+\s+of\s+\d+$/).first();
    const hasPager = await pager.isVisible().catch(() => false);

    if (hasPager) {
      await pager.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();

      // Parse the total page count from the "{n} of {N}" label.
      const label = (await pager.textContent().catch(() => "")) ?? "";
      const totalPages = Number(label.split(/\s+of\s+/i)[1] ?? "1") || 1;

      // The pager row is "prev | label | next" — the two buttons that flank
      // the label are the carousel controls.
      const pagerRow = pager.locator("xpath=..");
      const prevBtn = pagerRow.getByRole("button").first();
      const nextBtn = pagerRow.getByRole("button").last();

      // Forward through every page — cards change on each click.
      for (let i = 1; i < totalPages; i++) {
        if (await nextBtn.isEnabled().catch(() => false)) {
          await nextBtn.click().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
      // ...and back to the first page.
      for (let i = totalPages - 1; i >= 1; i--) {
        if (await prevBtn.isEnabled().catch(() => false)) {
          await prevBtn.click().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
    } else {
      // No pager: still rest a beat on whatever cards are present.
      await hoverFirstVisible(page, /^simulation-card-/);
    }

    // --- One card's "View Rubrics" dialog: open, hold so it reads, Escape. ---
    // The rubric trigger is an outline icon button carrying the "View Rubrics"
    // tooltip; the resulting dialog titles "Rubrics: {name}". Open the first
    // available one. Guarded: no-op if a card lacks rubrics.
    const firstCard = page.getByTestId(/^simulation-card-/).first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
      // The Table-icon outline button at the card's top-right opens rubrics.
      // It is the first non-start button on the card; target by its tooltip
      // text is unreliable (tooltip is hover-only), so we click the icon-only
      // outline button that is NOT the start-simulation control.
      const rubricTrigger = firstCard
        .getByRole("button")
        .filter({ hasNot: page.getByTestId(/^start-/) })
        .first();
      if (await rubricTrigger.isVisible().catch(() => false)) {
        await rubricTrigger.click().catch(() => undefined);
        const rubricDialog = page.getByText(/^Rubrics:/i).first();
        if (await rubricDialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
          // Hold so the rubric table content reads on frame.
          await pauseForDemo(1_600);
          await page.keyboard.press("Escape");
          await pauseForDemo(700);
        }
      }
    }

    // --- Scroll the whole section top->bottom to close, hovering a start
    //     button WITHOUT clicking it (non-destructive). ---
    await page.getByTestId("home-overview").scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo();
    await hoverFirstVisible(page, /^start-simulation-/);
    await page.mouse.wheel(0, 600);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
