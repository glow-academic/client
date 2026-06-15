import { expect, test, type Page } from "@playwright/test";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-create";

// coverage: NON-DESTRUCTIVE form-tour of the model create form. Open /new,
// settle the skeleton, then walk the whole multi-step builder top->bottom —
// Basic Information (name + the inline description and value fields), Provider,
// and the capability steps (Modalities, Temperature, Pricing, Reasoning Levels,
// Voices, Qualities). Each capability step's read-only search box is typed into
// (so the filtering shows on camera) then cleared, and the description field is
// demoed then emptied. The optional steps are conditional on the model's flags,
// so every beat past the one page-ready assertion is guarded and no-ops if its
// target is absent. The form is NEVER submitted and nothing is committed.
test.describe("demo: models create", () => {
  test("tours the model builder: fields, provider, and capability sections", async ({
    page,
  }) => {
    await page.goto("/intelligence/models/new");
    await expectAuthenticated(page);

    // Page-ready: the multi-step builder form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({
      timeout: 30_000,
    });
    // Trim the skeleton lead-in so the populated form fills the frame.
    await settleLoaded(page);

    // ── Basic Information ─────────────────────────────────────────────
    // The opening step: name, description, value, departments, and flags.
    // Hold so the section reads, then exercise the inline description field —
    // type so the entry shows, let it react, then clear it (non-mutating).
    await holdStep(page, "basic", /^Basic Information$/i);
    await demoField(
      page,
      "basic",
      "Enter a brief description",
      "A general-purpose chat model for tutoring scenarios.",
    );

    // ── Provider ──────────────────────────────────────────────────────
    // Scroll the provider picker on camera and hover its first option to
    // reveal the choices, without committing a selection.
    await holdStep(page, "provider", /^Provider$/i);
    await revealFirstOption(page, "provider");

    // ── Modalities ────────────────────────────────────────────────────
    // Conditional on the model's modalities flag. Exercise its search box:
    // type so the filtering shows, let it react, then clear it.
    await holdStep(page, "modalities", /^Modalities$/i);
    await demoSearch(page, "modalities", "Search modalities...", "text");

    // ── Temperature ───────────────────────────────────────────────────
    await holdStep(page, "temperature", /^Temperature$/i);
    await demoSearch(page, "temperature", "Search temperature levels...", "low");

    // ── Pricing ───────────────────────────────────────────────────────
    await holdStep(page, "pricing", /^Pricing$/i);
    await demoSearch(page, "pricing", "Search pricing...", "input");

    // ── Reasoning Levels ──────────────────────────────────────────────
    await holdStep(page, "reasoning", /^Reasoning Levels$/i);
    await demoSearch(page, "reasoning", "Search reasoning levels...", "high");

    // ── Voices ────────────────────────────────────────────────────────
    await holdStep(page, "voices", /^Voices$/i);
    await demoSearch(page, "voices", "Search voices...", "alloy");

    // ── Qualities ─────────────────────────────────────────────────────
    await holdStep(page, "qualities", /^Qualities$/i);
    await demoSearch(page, "qualities", "Search qualities...", "fast");

    // ── Submit row ────────────────────────────────────────────────────
    // Scroll the action bar into view to close the tour — never clicked, so
    // nothing is created.
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1000);
    }

    await saveDemoVideo(page, TOPIC);
  });
});

/**
 * Scroll a form step into view and hold the camera there, but only if the step
 * actually rendered. The optional capability steps (Modalities/Temperature/…)
 * can be absent from the DOM depending on the model's flags, so this no-ops
 * cleanly rather than failing.
 */
async function holdStep(
  page: Page,
  stepId: string,
  heading: RegExp,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  await step.scrollIntoViewIfNeeded().catch(() => undefined);
  await scrollToText(page, heading);
  await pauseForDemo(1200);
}

/**
 * Exercise a step's read-only search box: focus it, type a query character by
 * character so the typing is visible, let the list re-filter, then clear it so
 * no state is committed. Guarded on both the step and the input being present.
 */
async function demoSearch(
  page: Page,
  stepId: string,
  placeholder: string,
  query: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const search = step.getByPlaceholder(placeholder).first();
  if (!(await search.isVisible().catch(() => false))) return;
  await search.scrollIntoViewIfNeeded().catch(() => undefined);
  await search.click().catch(() => undefined);
  await search.pressSequentially(query, { delay: 55 }).catch(() => undefined);
  // Let the grid re-filter on the typed query.
  await pauseForDemo(1100);
  // Clear it so the demo leaves the form untouched.
  await search.fill("").catch(() => undefined);
  await pauseForDemo(700);
}

/**
 * Type into a step's inline text field (e.g. the Basic step's description) so
 * the entry is visible, then clear it so nothing is committed. Guarded on the
 * step and the field being present.
 */
async function demoField(
  page: Page,
  stepId: string,
  placeholder: string,
  value: string,
): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const field = step.getByPlaceholder(placeholder).first();
  if (!(await field.isVisible().catch(() => false))) return;
  await field.scrollIntoViewIfNeeded().catch(() => undefined);
  await field.click().catch(() => undefined);
  await field.pressSequentially(value, { delay: 30 }).catch(() => undefined);
  await pauseForDemo(1000);
  await field.fill("").catch(() => undefined);
  await pauseForDemo(600);
}

/**
 * Reveal a picker step's options by hovering its first selectable option,
 * without clicking through to commit a selection. Guarded on the step and an
 * option being present so a picker with no live data no-ops cleanly.
 */
async function revealFirstOption(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  if (!(await step.isVisible().catch(() => false))) return;
  const option = step.getByTestId("selectable-option").first();
  if (!(await option.isVisible().catch(() => false))) return;
  await option.scrollIntoViewIfNeeded().catch(() => undefined);
  await option.hover().catch(() => undefined);
  await pauseForDemo(1000);
}
