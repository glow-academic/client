import { type Locator, type Page, test } from "@playwright/test";

import { openArtifactForm } from "../helpers/artifact-demo";
import { settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-provider-keys";

// coverage: read-only tour of /settings/new — single page-ready assertion
// (artifact-form), then scroll top->bottom through all 8 step sections
// (basic/color/logins/systems/mcp/thresholds/provider/auth) with ~1s holds,
// dwelling on the Providers step (provider cards + masked key field + Reveal
// button HOVER only, never click/decrypt). No name typing, no submit, no
// mutation. Every beat past the page-ready assertion no-ops if its target is
// absent.

const STEP_IDS = [
  "basic",
  "color",
  "logins",
  "systems",
  "mcp",
  "thresholds",
  "provider",
  "auth",
] as const;

/** Scroll a step section into view and hold ~1s, no-op if the section is absent. */
async function dwellOnStep(page: Page, stepId: string, hold = 1_000): Promise<void> {
  const section = page.getByTestId(`artifact-form-step-${stepId}`).first();
  if (await section.isVisible().catch(() => false)) {
    await section.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(hold);
  }
}

/** Hover a locator and hold, fully guarded — never clicks. */
async function hoverIfVisible(locator: Locator, hold = 900): Promise<void> {
  const target = locator.first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
    await target.hover({ timeout: 1_000, force: true }).catch(() => undefined);
    await pauseForDemo(hold);
  }
}

test.describe("demo: settings provider keys", () => {
  test("tours the settings form and the encrypted provider-key step read-only", async ({
    page,
  }) => {
    // Single page-ready assertion: the settings artifact form is mounted.
    await openArtifactForm(page, "/settings/new");
    await settleLoaded(page);

    // Tour all eight step sections top -> bottom, ~1s hold on each.
    for (const stepId of STEP_IDS) {
      await dwellOnStep(page, stepId);
    }

    // Dwell on the Providers step: it carries the provider cards + the masked
    // API-key rows. Re-anchor on it before exploring its affordances.
    await dwellOnStep(page, "provider", 1_200);

    // Provider cards / selected-provider names within the step (guarded).
    const providerStep = page.getByTestId("artifact-form-step-provider").first();
    await hoverIfVisible(providerStep.getByText(/provider keys|providers and their api keys/i));

    // The masked key field — show that saved keys surface as bullets, never
    // plaintext. Hover only; no reveal/decrypt.
    await hoverIfVisible(providerStep.getByText(/•+/));

    // The Reveal (eye) button — HOVER only so its affordance reads, but we
    // never click it (clicking would call the audited decrypt endpoint).
    await hoverIfVisible(providerStep.getByRole("button", { name: /reveal/i }));
    await hoverIfVisible(providerStep.locator('button[title="Reveal"]'));

    // Final beat back on the provider step so the clip ends on the key UI.
    await dwellOnStep(page, "provider", 1_000);

    await saveDemoVideo(page, TOPIC);
  });
});
