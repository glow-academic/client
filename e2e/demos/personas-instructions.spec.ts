import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "../fixtures";
import { DOMAINS } from "../actions/domains";
import { resolveAnyId } from "../support/factories";
import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: personas-instructions — FOCUS a real persona's INSTRUCTIONS/content.
//
// Resolve a real, already-configured seed persona and open its EDIT page (the
// pre-populated GenericForm renders the persona's saved name/description/
// parameters/color/icon and — the star of this clip — the Personality step:
// the instructions prose that drives behavior, the example dialogue, and the
// configured voices. We tour every step top->bottom for context, then linger
// richly on the content step so the REAL configured instructions read on
// camera.
//
// Strictly NON-DESTRUCTIVE against the LIVE instance: every beat past the one
// page-ready assertion no-ops if its target is absent (visibleSoon guards), we
// NEVER type into the autosaving instructions/example fields, and Save/Delete
// is never clicked. The clip ends framed on the instructions.

const TOPIC = "personas-instructions";

// Form vertical order (per the persona domain config): Basic → Parameters →
// Color → Icon → Personality (instructions, example, voices).
const PERSONA_STEPS = ["basic", "parameters", "color", "icon", "content"];

/** True if a locator becomes visible within a short window. Bounded so an
 *  absent affordance is skipped, not waited out to the test timeout. */
async function visibleSoon(locator: Locator, timeout = 2_500): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

/** Scroll a step card into view and hold a beat so its real content reads. */
async function tourStep(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await visibleSoon(step))) return; // a step the seed persona lacks is skipped
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(1_000);
}

/** Guarded scroll-and-hold on a heading/label so its section reads. No-ops if
 *  absent. */
async function holdOnText(page: Page, text: string | RegExp, ms = 1_000): Promise<void> {
  const target = page.getByText(text).first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(ms);
  }
}

/** Scroll a populated field's value into view and hold so the saved prose
 *  reads. Read-only — we focus to surface it but never type. */
async function revealField(page: Page, testId: string, ms = 1_400): Promise<void> {
  const field = page.getByTestId(testId).first();
  if (!(await visibleSoon(field))) return;
  await field.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(ms);
}

test.describe("demo: personas instructions", () => {
  test("tour a persona's instructions and content", async ({ page, request, runId: _runId }) => {
    test.setTimeout(180_000);

    const spec = DOMAINS["persona"]!;

    // Resolve a real, already-configured seed persona and open its edit page —
    // the [personaId] route renders the same GenericForm in edit mode,
    // pre-populated with the persona's saved instructions/example/voices.
    const id = await resolveAnyId(request, "persona");
    test.skip(!id, "no seed persona to open for the instructions tour");

    await page.goto(`${spec.listPath}/${id}`);
    await expectAuthenticated(page);

    // ── The ONE page-ready assertion ───────────────────────────────────────
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });

    // Settle past the loading skeleton so no shimmer frame is recorded, then
    // hold on the loaded, populated form.
    await waitOutSkeleton(page);
    await settleLoaded(page);

    // ── Tour every step top -> bottom for context (~1s hold each) ───────────
    // Basic (name/description/departments/flags) → Parameters → Color → Icon →
    // Personality. Each guarded — a step the persona lacks is skipped.
    for (const stepId of PERSONA_STEPS) {
      await tourStep(page, stepId);
    }

    // ── FOCUS: the Personality / content step ───────────────────────────────
    // Linger on the prose that defines the persona's voice — first the
    // instructions that drive behavior, then the example dialogue, then the
    // configured voices. These carry the REAL saved text.
    await holdOnText(page, /personality|instructions/i);
    await revealField(page, spec.fields["instructions"]!.testId!, 1_800);

    // The example dialogue (Message 1, …) shows how the persona actually
    // speaks — scroll its first message into view and hold so it reads.
    const exampleMsg = page.getByPlaceholder(/message 1/i).first();
    if (await visibleSoon(exampleMsg)) {
      await exampleMsg.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    // The configured voices that color the persona's delivery.
    await holdOnText(page, /voice/i);

    // ── Save row ────────────────────────────────────────────────────────────
    // Scroll the action row into view so it reads, but NEVER click it — this is
    // a read-only tour, no update is committed.
    const submit = page.locator('[data-testid="artifact-form-submit"]:visible').first();
    if (await visibleSoon(submit)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    // End framed on the instructions so the clip closes on the substantive
    // content this demo is about.
    await scrollToText(page, /instructions/i).catch(() => undefined);
    await revealField(page, spec.fields["instructions"]!.testId!, 1_400);

    await saveDemoVideo(page, TOPIC);
  });
});
