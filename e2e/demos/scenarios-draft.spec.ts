// TOPIC: scenarios-draft
// coverage: a DRAFT-WORKFLOW tour of the new-scenario builder. Open /new, ANCHOR
// a draft by typing the scenario name (the first change autosaves → ?draftId= →
// the SaveToolbar flips to the Drafts picker), then tour the picker now that it
// has a real entry: open it, reveal the saved-drafts list, type+clear the
// in-dropdown search, hover the entry, surface the Autosave toggle, Escape, then
// a brief form scroll. (The prior version toured the picker WITHOUT filling the
// form, so both the form and the drafts list were empty — nothing to show.)
//
// NON-DESTRUCTIVE: the autosave is the product's own behaviour; the picker is
// opened-then-Escaped (no draft switched, nothing submitted). Every beat past
// the single page-ready assertion is guarded; settleLoaded() avoids skeletons.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-draft";
const NEW_PATH = "/training/scenarios/new";
const NAME_PLACEHOLDER = /Customer Support Escalation/i;

async function visibleSoon(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: scenarios draft", () => {
  test("anchor a scenario draft via autosave, then tour the populated drafts picker", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.goto(NEW_PATH);
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // ── Anchor a draft via autosave (type the scenario name) ─────────────────
    const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER).first();
    if (await visibleSoon(nameInput)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft Scenario Demo", { delay: 50 });
      await pauseForDemo(800);
      // Wait for the draft to anchor (draftId in URL) + the Saving/Save-Draft
      // indicator to clear so the toolbar settles on the Drafts picker.
      await page.waitForURL(/[?&]draftId=/, { timeout: 8_000 }).catch(() => undefined);
      await page
        .getByRole("button", { name: /saving|save draft/i })
        .first()
        .waitFor({ state: "detached", timeout: 8_000 })
        .catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── CENTER: the Drafts picker (now has our just-anchored draft) ──────────
    const trigger = page.getByTestId("draft-picker-trigger");
    if (await visibleSoon(trigger, 6_000)) {
      await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await trigger.click().catch(() => undefined);
      await pauseForDemo(1_100);

      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await visibleSoon(firstDraft, 5_000)) await pauseForDemo(900);

      const search = page.getByTestId("draft-search");
      if (await visibleSoon(search, 3_000)) {
        await search.click().catch(() => undefined);
        await search.pressSequentially("Draft", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await search.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }

      await hoverLocatorIfVisible(firstDraft);
      await scrollToText(page, /autosave/i).catch(() => undefined);
      await hoverLocatorIfVisible(page.getByTestId("draft-autosave-toggle"));
      await pauseForDemo(900);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── Brief read-only form scroll: what a scenario draft captures ──────────
    for (const text of [/basic information/i, /description/i, /^personas$/i, /problem/i]) {
      await scrollToText(page, text).catch(() => undefined);
    }
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
