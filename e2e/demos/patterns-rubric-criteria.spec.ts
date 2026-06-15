import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: full-page tour of a RUBRIC's grading criteria (edit page).
// A rubric is the pass/fail scorecard a simulation is graded against, so this
// clip walks the whole authoring surface top->bottom: the Basic Information
// step (name, description, departments, flags, and the Pass-vs-Total Points
// threshold), then the Standard Groups step (the criteria buckets), then the
// Standards grid (the per-level descriptors). We scroll each StepCard with a
// hold so it reads, hover the selectable option grids (departments / standard
// groups), and open the Pass-Points picker to reveal its suggestion list then
// dismiss it with Escape WITHOUT committing — every beat is read-only.
//
// HARD RULE (live instance): non-destructive only. We never type into the
// autosaving fields (that would patch the live draft), never click Reset /
// Update / Create, and only open-then-Escape the points picker. Every beat past
// the one page-ready assertion (`artifact-form` visible) is guarded by an
// isVisible().catch(()=>false) bail or a guarded helper, so a control the
// rubric lacks is skipped, not failed. settleLoaded() runs before the tour so
// no loading skeleton is captured.

/** Scroll a step card (or any locator) into view and hold so it reads. No-op
 *  when the target is absent on this rubric. */
async function tourSection(locator: Locator, hold = 900): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(hold);
}

/** Hover the first few visible selectable options inside a section so the
 *  criteria chips/cards visibly react. Guarded: bails when the section or its
 *  options are absent. */
async function hoverOptions(scope: Locator, max = 3): Promise<void> {
  if (!(await scope.isVisible().catch(() => false))) return;
  const opts = scope.getByTestId("selectable-option");
  const n = Math.min(max, await opts.count().catch(() => 0));
  for (let i = 0; i < n; i++) {
    const opt = opts.nth(i);
    if (!(await opt.isVisible().catch(() => false))) continue;
    await opt.scrollIntoViewIfNeeded().catch(() => undefined);
    await opt.hover({ timeout: 1_000 }).catch(() => undefined);
    await pauseForDemo(550);
  }
}

/** Open the Pass-Points picker (focus the numeric field so its suggestion list
 *  surfaces), hold so the threshold options read, then dismiss with Escape
 *  WITHOUT committing a value — fully reversible and non-mutating. */
async function revealPassPoints(page: Page): Promise<void> {
  const input = page.getByPlaceholder(/e\.g\. 16/i).first();
  if (!(await input.isVisible().catch(() => false))) return;
  await input.scrollIntoViewIfNeeded().catch(() => undefined);
  await input.click({ timeout: 1_500 }).catch(() => undefined);
  await pauseForDemo(900); // suggestion chips / dropdown surface
  await page.keyboard.press("Escape").catch(() => undefined);
  await input.blur().catch(() => undefined);
  await pauseForDemo(500);
}

test.describe("demo: patterns rubric criteria", () => {
  test("tour a rubric's standards and pass threshold", async ({ page, request }) => {
    test.setTimeout(120_000);

    const id = await resolveAnyId(request, "rubric");
    test.skip(!id, "no seed rubric to open");

    await page.goto(`/platform/rubrics/${id}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the rubric edit form is mounted. Everything
    // after this is guarded so it no-ops when a control is absent.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 45_000 });
    // Trim the loading skeleton so the populated form, not the shimmer, opens.
    await settleLoaded(page);
    await pauseForDemo(1_200);

    // ---- 1. Basic Information: name + description, top of the form ----
    await tourSection(page.getByTestId("artifact-form-step-basic"), 1_000);
    await scrollToText(page, /basic information|rubric name|description/i);
    await pauseForDemo(800);

    // ---- 2. Departments — who owns this rubric (selectable grid) ----
    await scrollToText(page, /department/i);
    await hoverOptions(page.getByTestId("artifact-form-step-basic"));

    // ---- 3. Flags — active / simulation / video toggles ----
    await scrollToText(page, /flags|active|simulation|video/i);
    await pauseForDemo(800);

    // ---- 4. The pass threshold: Pass Points vs computed Total Points ----
    // The headline of a rubric — open the picker, reveal options, Escape.
    await scrollToText(page, /pass points|total points|threshold/i);
    await pauseForDemo(700);
    await revealPassPoints(page);

    // ---- 5. Standard Groups — the criteria buckets ----
    await tourSection(page.getByTestId("artifact-form-step-standard_groups"), 1_000);
    await scrollToText(page, /standard group|choose standard groups/i);
    await hoverOptions(page.getByTestId("artifact-form-step-standard_groups"));

    // ---- 6. Standards — the per-level descriptors grid ----
    await tourSection(page.getByTestId("artifact-form-step-standards"), 1_000);
    await scrollToText(page, /standards|choose standards/i);
    await pauseForDemo(900);

    // ---- 7. Footer: the Back / Update controls are present but untouched ----
    await tourSection(page.getByTestId("artifact-form-submit"), 800);

    // ---- Final beat back at the top so the clip ends on the rubric name ----
    await page.mouse.wheel(0, -4_000);
    await scrollToText(page, /basic information|rubric name|pass points/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, "patterns-rubric-criteria");
  });
});
