// # coverage: full-page tour of /leaderboard focused on the TRENDS / accolade
// story — the improvement-oriented achievement cards and the per-accolade
// "Challengers (closing in)" detail modal, the part of the board that frames
// momentum rather than raw standing. We settle out the skeleton, glance across
// the accolade (trophy) grid top-to-bottom (Perfect Score / Rapid Riser /
// Marathon Runner / Highest Scorer ...), hover the cards so each metric reads,
// then CLICK one accolade card to open its detail dialog and hold so the holder
// + the ranked challengers closing the gap read, dismissing with Escape WITHOUT
// navigating to any report. Then we drop to the table toolbar, type/clear the
// name search (reversible view state), and open the "View" column dropdown to
// reveal the hidden trend column ("Improvement/Day") the board can surface,
// dismissing with Escape WITHOUT toggling it. Every beat past the one
// page-ready assertion is guarded (isVisible().catch) + non-destructive
// (open-then-Escape; the card click opens a read-only modal, never a report).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-trends";

test.describe("demo: leaderboard trends", () => {
  test("tours the accolade cards and the challengers detail modal, plus the improvement trend column", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    // The loaded board carries `leaderboard-container`; the loading state is
    // `leaderboard-skeleton`, so this resolves uniquely to the populated view.
    // This is the single real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in so no shimmer frame is captured, then hold
    // a beat on the populated board.
    await settleLoaded(page);

    // BEAT 1 — glance across the accolade (trophy) grid at the top so the
    // achievement framing reads: each card names a behavioral trend (Rapid
    // Riser, Marathon Runner, The Persistent ...) and its current holder.
    await hoverFirstVisible(page, /^accolade-/);
    await pauseForDemo(900);

    // BEAT 2 — track the cursor across the first row of accolade cards so the
    // distinct metrics register one by one. Guarded so a thin board (few cards)
    // is a clean no-op. Hover only — clicking is the next, deliberate beat.
    const cards = page.getByTestId(/^accolade-/);
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      const card = cards.nth(i);
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.hover().catch(() => undefined);
        await pauseForDemo(750);
      }
    }

    // BEAT 3 — let the improvement-oriented titles read across the grid so the
    // "trends" framing lands (rising scores, time invested, persistence).
    await scrollToText(page, /rapid riser|marathon|persistent|highest scorer|perfect/i);
    await pauseForDemo(1_100);

    // BEAT 4 — CLICK one accolade card to open its detail dialog. This is the
    // centerpiece of the trends clip: the card expands to a modal showing the
    // current holder and the "Challengers (closing in)" — the ranked field
    // closing the gap, the momentum story. Read-only: opening the modal never
    // navigates (the "View report" links inside are not clicked). Guarded so a
    // holderless board (no clickable card) is a clean no-op.
    const firstCard = cards.first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click().catch(() => undefined);
      // Hold while the modal springs in and its challenger list settles, so the
      // holder + "Challengers (closing in)" rows read on frame.
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible().catch(() => false)) {
        await pauseForDemo(1_200);
        await scrollToText(page, /challengers \(closing in\)/i);
        await pauseForDemo(1_400);
      }
      // Dismiss with Escape — a global keydown listener closes the modal. No
      // navigation, no mutation.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // BEAT 5 — drop to the ranked table and type into the name search so the
    // board visibly narrows, then clear it so the full field returns.
    // Reversible view state — nothing committed.
    await expect(page.getByTestId("leaderboard-table")).toBeVisible();
    await scrollToText(page, /search users|improvement|highest score|attempts/i);
    const search = page.getByPlaceholder("Search users by name...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_300);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // BEAT 6 — open the "View" column-visibility dropdown to reveal the hidden
    // trend column the board can surface — "Improvement/Day" (the per-day score
    // gain that powers the Rapid Riser accolade) — then dismiss with Escape
    // WITHOUT toggling it. Read-only reveal: opened + Escape, no column committed.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_400);
      await scrollToText(page, /improvement|quickest pass|response times/i);
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(900);
    }

    // End held on the accolade grid — the trends framing back on frame.
    await scrollToText(page, /rapid riser|highest scorer|perfect|marathon/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
