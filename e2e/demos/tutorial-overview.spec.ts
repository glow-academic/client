// # coverage: tutorial-overview — a single-stage, full-page NON-DESTRUCTIVE
// tour of the richest build-path artifact form, the new-rubric authoring
// surface (/platform/rubrics/new). The rubric is the pass/fail scorecard a
// simulation is graded against, so this is the most affordance-dense form in
// the build path and the right one to showcase as the overview. We stay on
// this ONE page for the whole clip (the prior recording filmed loading
// skeletons while hopping across multiple build-path forms — fixed here by
// touring a single stage and settling the skeleton before any hold).
//
// The tour walks top->bottom: the Basic Information step (name, description,
// the Departments selectable grid, the Flags toggles, the Pass-vs-Total
// Points threshold), the Standard Groups step (criteria buckets), the
// Standards grid (per-level descriptors), and the footer Back / Create
// controls (revealed, never clicked). It also exercises the two cross-cutting
// surfaces that frame every build-path form: the Drafts picker (open → type
// into its search → Escape, nothing committed) and the AI Generation panel
// (toggle open to reveal the instructions composer, then toggle closed).
//
// HARD RULE (live instance): strictly non-destructive. We never type into the
// autosaving name/description fields (that would patch the live draft), never
// click Reset / Create / Submit / Generate, and only open-then-Escape pickers
// and panels. Every beat past the one page-ready assertion (`artifact-form`
// visible) is guarded by an isVisible().catch(()=>false) bail or a guarded
// helper, so a control this form lacks is skipped, not failed. settleLoaded()
// runs immediately after the single goto so no loading skeleton is captured.
import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-overview";

// The step sections the rubric form renders, top->bottom.
const STEP_SECTIONS: Array<{ stepId: string; heading: RegExp }> = [
  { stepId: "basic", heading: /basic information|rubric name|description/i },
  { stepId: "standard_groups", heading: /standard group|choose standard groups/i },
  { stepId: "standards", heading: /^standards$|choose standards/i },
];

/** Scroll a section/locator into frame and hold so it reads. No-op when the
 *  target is absent on this form. */
async function tourSection(locator: Locator, hold = 1_000): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(hold);
}

/** Hover the first few visible selectable options inside a section so the
 *  criteria chips/cards visibly react. Guarded; hover only — never clicks, so
 *  no selection is mutated. */
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

test.describe("demo: tutorial overview", () => {
  test("tour the new-rubric build-path form, its drafts picker, and the generation panel", async ({ page }) => {
    test.setTimeout(120_000);

    // ONE stage only — the richest build-path form. No cross-form navigation.
    await page.goto("/platform/rubrics/new", { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // Single hard page-ready assertion: the GenericForm root is mounted.
    // Everything after this is guarded so it no-ops when a control is absent.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 45_000 });
    // Trim the loading skeleton so the populated form — not the shimmer —
    // opens the clip, BEFORE any hold.
    await settleLoaded(page);

    const basicStep = page.getByTestId("artifact-form-step-basic").first();

    // ---- 1. Basic Information: name + description, top of the form ----
    await tourSection(basicStep, 1_000);
    await scrollToText(page, /basic information|rubric name|description/i);
    await pauseForDemo(800);

    // ---- 2. Departments — who owns this rubric (selectable grid). Hover only,
    // never click — no selection mutated. ----
    await scrollToText(page, /department/i);
    await hoverOptions(basicStep);

    // ---- 3. Flags — active / simulation / video toggles ----
    await scrollToText(page, /flags|active|simulation|video/i);
    await pauseForDemo(800);

    // ---- 4. The pass threshold: Pass Points vs computed Total Points. Open the
    // picker, reveal options, Escape — nothing committed. ----
    await scrollToText(page, /pass points|total points|threshold/i);
    await pauseForDemo(700);
    await revealPassPoints(page);

    // ---- 5. Walk the remaining step sections top->bottom, holding on each. ----
    for (const { stepId, heading } of STEP_SECTIONS) {
      const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
      if (await section.isVisible().catch(() => false)) {
        await section.scrollIntoViewIfNeeded().catch(() => undefined);
        await scrollToText(page, heading);
        await pauseForDemo(1_000);
      }
    }

    // ---- 6. Standard Groups options — hover the criteria buckets (no click). ----
    await hoverOptions(page.getByTestId("artifact-form-step-standard_groups").first());

    // ---- 7. Footer: the Back / Create controls are present but UNTOUCHED. ----
    await tourSection(page.getByTestId("artifact-form-submit").first(), 900);

    // ---- 8. The Drafts picker (SaveToolbar) — open the dropdown to reveal the
    // saved-draft list + its search, type so the list visibly narrows, then
    // Escape WITHOUT selecting a draft. Reversible, nothing committed. ----
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      const draftSearch = page.getByPlaceholder(/search drafts/i).first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("rubric", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // ---- 9. The AI Generation panel — toggle it open to reveal the
    // instructions composer (the AI side of authoring), hold so it reads, then
    // toggle it closed. Open/close only — never Generate (no live mutation). ----
    const panelToggle = page.getByTestId("toggle-right-panel").first();
    if (await panelToggle.isVisible().catch(() => false)) {
      await panelToggle.click().catch(() => undefined);
      const instructions = page.getByPlaceholder("Instructions...").first();
      await instructions.waitFor({ state: "visible", timeout: 8_000 }).catch(() => undefined);
      await pauseForDemo(1_300);
      // Close it again so the form is left exactly as found.
      await panelToggle.click().catch(() => undefined);
      await pauseForDemo(700);
    }

    // End held on the top of the form (Basic Information) so the clip closes on
    // substantive, in-progress authoring content.
    await page.mouse.wheel(0, -4_000);
    await scrollToText(page, /basic information|rubric name|pass points/i);
    await pauseForDemo(1_000);

    await saveDemoVideo(page, TOPIC);
  });
});
