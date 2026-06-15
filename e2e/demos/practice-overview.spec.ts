import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-overview";

// coverage: practice landing /practice — tour the simulation LAUNCH cards
// (the carousel of available practice simulations) top-to-bottom: scroll the
// grid, hover the cards, open the toolbar Attempts content-type picker and
// Escape, open a card's "View Rubrics" dialog and Escape, and page the
// carousel forward/back. STRICTLY non-destructive: never clicks
// start-simulation / start-infinite (no attempt is ever launched), and every
// picker/dialog is opened then dismissed without committing. This is the
// launch-overview cut; score badges + practice history live in practice-scores.

/** True when the first match is attached AND visible. Never throws. */
async function visible(locator: Locator): Promise<boolean> {
  return locator
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * Open the toolbar "Attempts" content-type picker (a combobox PopoverTrigger,
 * aria-label "Select content type"), let its option list + search read on
 * camera, then dismiss with Escape WITHOUT selecting anything (read-only — the
 * grid is never re-scoped). Guarded: no-op if the toolbar picker is absent.
 */
async function peekAttemptsPicker(page: Page): Promise<void> {
  const trigger = page.getByRole("combobox", { name: /select content type/i }).first();
  if (!(await visible(trigger))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);
  await pauseForDemo(1_100);
  await page.keyboard.press("Escape").catch(() => undefined);
  await pauseForDemo(600);
}

/**
 * Open the first card's "View Rubrics" dialog (the Table-icon outline button in
 * the card header opens a Radix Dialog showing the rubric table), hold so its
 * content reads, then Escape. Guarded: no-op if no card / no dialog opens.
 * Non-destructive — a dialog read only.
 */
async function peekRubricDialog(page: Page): Promise<void> {
  // The rubric trigger is the outline icon button in the card header. Scope to
  // the first simulation card so we hit a real card's dialog, not some other
  // outline button on the page.
  const card = page.getByTestId("permanent-simulation-card").first();
  if (!(await visible(card))) return;
  // The rubric trigger is the first button in the card — the Table-icon outline
  // button in the header. The start CTA(s) live in the footer (last in DOM
  // order), so .first() reliably picks the rubric dialog trigger, never a start
  // button. Guarded: no-op if the card has no button.
  const trigger = card.getByRole("button").first();
  if (!(await visible(trigger))) return;
  await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
  await trigger.click({ timeout: 10_000 }).catch(() => undefined);

  // Only treat it as a dialog beat if a dialog actually opened.
  const dialog = page.getByRole("dialog").first();
  if (await dialog.isVisible().catch(() => false)) {
    await pauseForDemo(1_400);
    await page.keyboard.press("Escape").catch(() => undefined);
    await pauseForDemo(600);
  }
}

/**
 * Page the simulation carousel forward then back. The carousel only renders its
 * prev/next chevrons when there is more than one page of cards, so this is fully
 * guarded: it locates the chevron buttons by their lucide icons inside the
 * carousel header and no-ops cleanly on a single-page grid. Non-destructive —
 * carousel paging is local state only.
 */
async function exerciseCarousel(page: Page): Promise<void> {
  // The "N of M" pager indicator (e.g. "1 of 3") sits between the two chevron
  // buttons; its presence means there is more than one page to move through.
  const pager = page.getByText(/^\d+ of \d+$/).first();
  if (!(await visible(pager))) return;

  // The two icon buttons flanking the pager are prev (left) / next (right).
  // Scope to the pager's parent row so we don't grab unrelated icon buttons.
  const row = pager.locator("xpath=ancestor::div[1]");
  const buttons = row.getByRole("button");
  const count = await buttons.count().catch(() => 0);
  if (count < 2) return;
  const next = buttons.nth(count - 1);
  const prev = buttons.nth(0);

  if ((await next.isEnabled().catch(() => false)) && (await visible(next))) {
    await next.click({ timeout: 10_000 }).catch(() => undefined);
    await waitOutSkeleton(page);
    await pauseForDemo(1_000);
    // Step back so the clip returns to the opening page of cards.
    if ((await prev.isEnabled().catch(() => false)) && (await visible(prev))) {
      await prev.click({ timeout: 10_000 }).catch(() => undefined);
      await waitOutSkeleton(page);
      await pauseForDemo(900);
    }
  }
}

test.describe("demo: practice overview", () => {
  test("records the practice landing page", async ({ page }) => {
    await page.goto("/practice");
    // Don't `waitForLoadState("networkidle")` — the page keeps an SSE /
    // socket open, so networkidle never fires. Wait for the grid itself (its
    // visibility is the real "page ready" signal — the grid renders only on the
    // loaded, populated state, never the skeleton).
    await expectAuthenticated(page);

    const grid = page.getByTestId("practice-simulation-grid");
    await expect(grid).toBeVisible({ timeout: 30_000 });

    // Let the loading skeleton detach + hold a beat so the LOADED grid (not the
    // shimmer) opens the clip, then tour the launch cards.
    await settleLoaded(page, {
      scrollTexts: [/practice|simulation|start|scenario/i],
      hoverTestIds: ["permanent-simulation-card", "simulation-title"],
    });

    // Toolbar content-type picker: open, reveal options, Escape (read-only).
    await peekAttemptsPicker(page);

    // First card's "View Rubrics" dialog: open, hold, Escape (non-destructive).
    await peekRubricDialog(page);

    // Page the carousel of available simulations forward then back.
    await exerciseCarousel(page);

    // Re-hover a launch card so the clip lands back on the simulation overview.
    await hoverFirstVisible(page, "permanent-simulation-card");

    // Tour to the foot of the page so the full landing reads top-to-bottom
    // (history detail itself is the practice-scores cut, so we only scroll to
    // its heading here — not exercising it).
    await scrollToText(page, /history|recent|scenario|attempt/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
