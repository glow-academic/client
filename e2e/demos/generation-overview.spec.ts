// TOPIC: generation-overview
// coverage: tours the AI GENERATION panel on the new-persona page — the panel
// where you instruct the model to draft an artifact. Opens /training/personas/new,
// settles the loaded form, opens the right-hand generation panel, types a real
// instruction into the "Instructions..." box (the generation prompt), then tours
// the generation affordances (prompt suggestions, generation settings, safe mode).
// NON-DESTRUCTIVE — nothing is generated/submitted; every beat past the single
// page-ready assertion is guarded so an absent affordance no-ops, and
// settleLoaded() runs first so no loading skeleton opens the clip.
//
// (The prior version opened on the personas LIST page, where no generation panel
// exists — it recorded a static list. Generation lives in the create flow.)

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  openGenerationPanel,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const NEW_PATH = "/training/personas/new";
const TOPIC = "generation-overview";

async function visibleSoon(locator: Locator, timeout = 4_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: generation overview", () => {
  test("tour the AI generation panel: instructions, prompt suggestions, settings", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto(NEW_PATH);
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);
    await pauseForDemo();

    // Open the right-hand AI generation panel (no-ops if already open).
    await openGenerationPanel(page).catch(() => undefined);
    await pauseForDemo();

    // Type a real generation instruction. Guard the click (the panel input can
    // animate in): scroll it into view, then type with visible keystrokes.
    const instructions = page.getByPlaceholder("Instructions...").first();
    if (await visibleSoon(instructions, 8_000)) {
      await instructions.scrollIntoViewIfNeeded().catch(() => undefined);
      await instructions.click({ timeout: 8_000 }).catch(() => undefined);
      await instructions
        .pressSequentially(
          "Draft a clear, friendly onboarding persona for new students.",
          { delay: 30 },
        )
        .catch(() => undefined);
      await pauseForDemo(900);
    }

    // Tour the generation affordances (each beat guarded / no-ops if absent).
    for (const section of [
      /prompt|suggestion/i,
      /generation settings/i,
      /safe mode/i,
      /model/i,
      /instruction/i,
    ]) {
      await scrollToText(page, section).catch(() => undefined);
    }
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
