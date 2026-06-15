import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-points";

// # coverage: focused tour of a REAL rubric's SCORING THRESHOLD — the Pass
// Points picker, the read-only Total Points display, and the point values that
// run across the standards matrix. A rubric grades a simulation; "pass points"
// is the score a learner must clear, "total points" is the computed ceiling
// (server-side, read-only), and the standards matrix spreads those points
// across performance levels. We resolve a real seeded rubric, open its
// pre-populated edit page (same entry as the good rubrics-standards demo), and
// walk: the Pass Points field + its suggestion chips (the canonical thresholds),
// the Total Points read-only readout beside it, then the per-level point chips
// across the standards matrix that those totals roll up from.
//
// HARD RULE (live instance): non-destructive only. Pass Points is a writeable
// numeric Input and its suggestions are real onClick buttons — committing either
// would PATCH the live draft, so we only HOVER them (hover never mutates), never
// type, focus-to-commit, or click a chip. Total Points is read-only by nature.
// We never click Reset / Update / Back. Every beat past the one page-ready
// assertion (`artifact-form` visible) is guarded by an isVisible().catch bail or
// a guarded helper, so any control this rubric lacks is skipped, not failed.
// settleLoaded() trims the loading skeleton so the populated form — not the
// shimmer — fills the clip.

/** Scroll a locator into view and hold so it reads. No-op when absent. */
async function tourSection(locator: Locator, hold = 900): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(hold);
}

/** Hover the first few visible matches so each visibly reacts. Guarded: bails
 *  when empty / hidden. Read-only — hover never commits a value. */
async function hoverEach(locator: Locator, max = 4, hold = 650): Promise<void> {
  const n = Math.min(max, await locator.count().catch(() => 0));
  for (let i = 0; i < n; i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.hover({ timeout: 1_000 }).catch(() => undefined);
    await pauseForDemo(hold);
  }
}

test.describe("demo: rubrics points", () => {
  test("tour a rubric's pass-points threshold and points scoring", async ({ page, request }) => {
    test.setTimeout(120_000);

    const id = await resolveAnyId(request, "rubric");
    test.skip(!id, "no seed rubric to open");

    await page.goto(`/platform/rubrics/${id}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the rubric edit form is mounted. Everything
    // after this is guarded so it no-ops when a control is absent on this rubric.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 45_000 });
    // Trim the loading skeleton so the populated form, not the shimmer, opens.
    await settleLoaded(page);
    await pauseForDemo(1_000);

    // ---- 1. Anchor on the basic step where the points scoring lives ----
    const basicStep = page.getByTestId("artifact-form-step-basic");
    await tourSection(basicStep, 800);
    await scrollToText(page, /rubric name|basic information/i);
    await pauseForDemo(600);

    // ---- 2. PASS POINTS — the focus. The threshold a learner must clear. ----
    // Scroll the Pass Points label into frame, hold so the number reads.
    await scrollToText(page, /pass points/i);
    await pauseForDemo(1_000);

    // 2a. Hover the Pass Points numeric input so the active threshold reads.
    // Read-only: we hover, never focus/type, so no autosave fires.
    const passLabel = page.getByText(/^pass points/i).first();
    if (await passLabel.isVisible().catch(() => false)) {
      await passLabel.hover({ timeout: 1_000 }).catch(() => undefined);
      await pauseForDemo(700);
    }
    const passInput = page.locator('input[type="number"]').first();
    await hoverEach(passInput, 1, 800);

    // 2b. The suggestion chips beside the input — the canonical pass thresholds
    // surfaced from the pass-typed Points resources. Hovering reveals each
    // option WITHOUT clicking (a click would commit a new threshold).
    const suggestionChips = basicStep.locator('button[type="button"]').filter({
      hasText: /^\d+$/,
    });
    await hoverEach(suggestionChips, 4, 600);

    // ---- 3. TOTAL POINTS — the read-only computed ceiling beside Pass Points.
    await scrollToText(page, /total points/i);
    await pauseForDemo(1_000);
    const totalLabel = page.getByText(/^total points/i).first();
    if (await totalLabel.isVisible().catch(() => false)) {
      await totalLabel.hover({ timeout: 1_000 }).catch(() => undefined);
      await pauseForDemo(800);
    }

    // ---- 4. The standards matrix — where the points spread across levels.
    // The per-level point chips ("X pt") are what Total Points rolls up from.
    const standardsStep = page.getByTestId("artifact-form-step-standards");
    await tourSection(standardsStep, 1_000);
    await scrollToText(page, /standards|level|descriptor/i);
    await pauseForDemo(800);

    // 4a. The level header columns + their point values across the top.
    await hoverEach(standardsStep.locator("thead th"), 4, 600);
    await scrollToText(page, /\bpt\b/i);
    await pauseForDemo(800);

    // 4b. A slow scroll through the matrix so the point columns below read.
    await standardsStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.mouse.wheel(0, 600);
    await pauseForDemo(900);

    // ---- 5. Footer: Back / Update controls present but untouched. ----
    await tourSection(page.getByTestId("artifact-form-submit"), 700);

    // ---- Final beat back on the Pass Points threshold so the clip ends on its
    // focus (the scoring threshold this demo is about).
    await scrollToText(page, /pass points/i);
    await pauseForDemo(1_000);

    await saveDemoVideo(page, TOPIC);
  });
});
