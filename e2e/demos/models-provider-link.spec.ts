import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { resolveAnyId } from "../support/factories";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "models-provider-link";

// # coverage: focused tour of a REAL model's PROVIDER link — the step that
// binds a model to the upstream provider it is served from. A model (e.g.
// "GPT-4") names a `value` the provider understands, but it is the Provider
// selection that wires it to a configured provider artifact (the credentials +
// endpoint that requests actually route through). We resolve a real seeded
// model, open its pre-populated edit page, and walk that link top->bottom: a
// short anchor on Basic Information (name / value identifier), then the focus —
// the Provider StepCard — where we scroll the selectable provider grid, hover
// the model's CONFIGURED (selected) provider card so its name + endpoint detail
// reads, and hover the other provider options so the full picker is on frame.
//
// HARD RULE (live instance): non-destructive only. We never CLICK a provider
// card (clicking toggles selection → autosaves the live draft), never hit Reset
// / Update / Back, never type into any autosaving field. Every beat past the one
// page-ready assertion (`artifact-form` visible) is guarded by an
// isVisible().catch(()=>false) bail or a guarded helper, so a control this model
// lacks is skipped, not failed. settleLoaded() trims the loading skeleton before
// the tour so the populated form — not the shimmer — fills the clip.

/** Scroll a locator into view and hold so it reads. No-op when absent. */
async function tourSection(locator: Locator, hold = 900): Promise<void> {
  if (!(await locator.isVisible().catch(() => false))) return;
  await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  await pauseForDemo(hold);
}

/** Hover the first few visible matches of a locator so each visibly reacts.
 *  Guarded: bails when the set is empty / a match is hidden. Read-only — hover
 *  never mutates (a CLICK would toggle the provider selection + autosave). */
async function hoverEach(locator: Locator, max = 4, hold = 700): Promise<void> {
  const n = Math.min(max, await locator.count().catch(() => 0));
  for (let i = 0; i < n; i++) {
    const el = locator.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    await el.scrollIntoViewIfNeeded().catch(() => undefined);
    await el.hover({ timeout: 1_000 }).catch(() => undefined);
    await pauseForDemo(hold);
  }
}

test.describe("demo: models provider link", () => {
  test("tour a model's configured provider link", async ({ page, request }) => {
    test.setTimeout(120_000);

    const id = await resolveAnyId(request, "model");
    test.skip(!id, "no seed model to open");

    await page.goto(`/intelligence/models/${id}`, { waitUntil: "domcontentloaded" });
    await expectAuthenticated(page);

    // ONE hard page-ready assertion: the model edit form is mounted. Everything
    // after this is guarded so it no-ops when a control is absent on this model.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 45_000 });
    // Trim the loading skeleton so the populated form, not the shimmer, opens.
    await settleLoaded(page);
    await pauseForDemo(1_000);

    // ---- 1. Brief anchor at the top so the clip opens on the model identity ----
    await tourSection(page.getByTestId("artifact-form-step-basic"), 800);
    await scrollToText(page, /basic information|model value identifier|value/i);

    // ---- 2. PROVIDER — the focus. The step that links this model to the
    // upstream provider it is served from. Scroll the StepCard into frame. ----
    const providerStep = page.getByTestId("artifact-form-step-provider");
    await tourSection(providerStep, 1_100);
    await scrollToText(page, /provider|select the provider for this model/i);
    await pauseForDemo(900);

    // 2a. The configured (SELECTED) provider card — the one carrying the primary
    // ring + check badge. This is the model's actual provider link. Hover it so
    // its name + endpoint/description detail reads. Scoped to the provider step
    // so it never matches a selectable elsewhere on the form.
    const selectedProvider = providerStep
      .locator('[data-testid="selectable-option"]')
      .filter({ has: page.locator(".lucide-check") })
      .first();
    if (await selectedProvider.isVisible().catch(() => false)) {
      await selectedProvider.scrollIntoViewIfNeeded().catch(() => undefined);
      await selectedProvider.hover({ timeout: 1_000 }).catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // 2b. The provider name + any endpoint/key detail on the selected card.
    await scrollToText(page, /endpoint|key|OpenAI|Anthropic|Azure|Google|provider/i);
    await pauseForDemo(800);

    // 2c. The full provider grid — hover each option so the available providers
    // this model COULD link to read. Read-only: hover only, never click (a click
    // toggles selection and autosaves the live draft).
    await hoverEach(providerStep.getByTestId("selectable-option"), 5, 700);

    // 2d. A slow scroll through the provider step so any cards below the fold read.
    await providerStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.mouse.wheel(0, 400);
    await pauseForDemo(800);

    // ---- 3. Footer: the Back / Update controls are present but untouched. ----
    await tourSection(page.getByTestId("artifact-form-submit"), 800);

    // ---- Final beat back on the Provider step so the clip ends on its focus. ----
    await providerStep.scrollIntoViewIfNeeded().catch(() => undefined);
    await scrollToText(page, /provider/i);
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
