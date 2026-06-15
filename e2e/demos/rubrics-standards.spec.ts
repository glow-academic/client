import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "rubrics-standards";

// # coverage: focused tour of a REAL rubric's STANDARDS section — the per-level
// descriptor matrix. A rubric grades a simulation against named criteria; the
// Standards step is the heart of it: a grid where each ROW is a standard group
// (the criterion being measured) and each COLUMN is a performance level (with a
// point value), and every CELL holds the descriptor text that defines what that
// level looks like. We resolve a real seeded rubric, open its pre-populated edit
// page, and walk that matrix top->bottom: scroll the standards StepCard, hover
// the group rows so the real criteria names read, hover the level header columns
// and their point chips, and hover several descriptor cells so the authored
// prose is on frame. The Standard Groups step (the buckets feeding the rows) is
// a short supporting beat above it.
//
// HARD RULE (live instance): non-destructive only. We never type into a cell
// Textarea, level-name Input, or any autosaving field (that would patch the live
// draft), never click Add level / Reset / Update / Back. Every beat past the one
// page-ready assertion (`artifact-form` visible) is guarded by an
// isVisible().catch(()=>false) bail or a guarded helper, so a control this
// rubric lacks is skipped, not failed. settleLoaded() trims the loading skeleton
// before the tour so the populated matrix — not the shimmer — fills the clip.

/** Scroll a locator into view and hold so it reads. No-op when absent. */
async function tourSection(locator: Locator, hold = 900): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(hold);
}

/** Hover the first few visible matches of a locator so each visibly reacts.
 *  Guarded: bails when the set is empty / a match is hidden. Read-only — hover
 *  never mutates. */
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

test.describe("demo: rubrics standards", () => {
  test("tour a rubric's per-level standards descriptor matrix", async ({ page, request }) => {
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

    // ---- 1. Brief anchor at the top so the clip opens on the rubric name ----
    await tourSection(page.getByTestId("artifact-form-step-basic"), 800);
    await scrollToText(page, /rubric name|basic information/i);

    // ---- 2. Standard Groups — the criteria buckets that become the matrix rows.
    // A short supporting beat: scroll the step and hover its selectable options. --
    const groupsStep = page.getByTestId("artifact-form-step-standard_groups");
    await tourSection(groupsStep, 900);
    await scrollToText(page, /standard group|choose standard groups|communication/i);
    await hoverEach(groupsStep.getByTestId("selectable-option"), 3);

    // ---- 3. STANDARDS — the focus. The per-level descriptor matrix. ----
    const standardsStep = page.getByTestId("artifact-form-step-standards");
    await tourSection(standardsStep, 1_100);
    await scrollToText(page, /standards|choose standards|descriptor|level/i);
    await pauseForDemo(900);

    // 3a. The level header columns + their point chips (the "X pt" tier labels)
    // that define the scoring scale across the top of the matrix.
    await hoverEach(standardsStep.locator("thead th"), 4, 600);
    await scrollToText(page, /\bpt\b/i);
    await pauseForDemo(700);

    // 3b. The group-name rows down the left edge — the real criteria each row
    // measures. Hovering walks the matrix top->bottom so the criteria read.
    await hoverEach(standardsStep.locator("tbody tr td:first-child"), 5, 650);

    // 3c. The descriptor CELLS — the authored prose defining each level for each
    // criterion (the substance of a rubric). Hover several so the text is on
    // frame. Read-only: we hover, never focus/type, so no autosave fires.
    await hoverEach(standardsStep.locator("tbody tr td:not(:first-child)"), 4, 700);

    // 3d. A slow scroll through the full matrix so any rows below the fold read.
    await standardsStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.mouse.wheel(0, 600);
    await pauseForDemo(900);
    await page.mouse.wheel(0, 600);
    await pauseForDemo(900);

    // ---- 4. Footer: the Back / Update controls are present but untouched. ----
    await tourSection(page.getByTestId("artifact-form-submit"), 800);

    // ---- Final beat back on the standards matrix so the clip ends on its focus.
    await standardsStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await scrollToText(page, /standards|descriptor|level/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
