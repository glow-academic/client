// TOPIC: personas-draft
// coverage: a DRAFT-WORKFLOW tour of the new-persona page — open /new, anchor a
// draft via autosave, then CENTER on the Drafts picker in the SaveToolbar:
// open the trigger, reveal the saved-drafts list, type+clear the in-dropdown
// search so the filter shows, hover the first entry, reveal the Autosave toggle,
// then Escape (never switching/committing a draft). A brief form-step scroll
// closes the tour. Distinct from tutorial-persona / personas-create: this is the
// save/draft surface, not the create-and-submit flow.
//
// HARD RULES honored: NON-DESTRUCTIVE only — the picker is opened-then-Escaped,
// no draft is switched and nothing is submitted. Every beat past the single
// page-ready assertion is guarded (isVisible().catch / bounded waitFor) so an
// absent affordance no-ops instead of failing. settleLoaded() runs before any
// tour beat so no loading skeleton is captured.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  settleLoaded,
  hoverLocatorIfVisible,
  scrollToText,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const NEW_PATH = "/training/personas/new";
const NAME_PLACEHOLDER = /enthusiastic student/i;

/** True if the locator becomes visible within a short, bounded window. */
async function visibleSoon(locator: Locator, timeout = 4_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: personas draft", () => {
  test("save a persona as a draft", async ({ page }) => {
    test.setTimeout(180_000);

    // ── Open the new-persona page ────────────────────────────────────────────
    await page.goto(NEW_PATH);
    await expectAuthenticated(page);

    // SINGLE page-ready assertion: the GenericForm root for the new-persona page.
    const form = page.getByTestId("artifact-form");
    await expect(form).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton so the LOADED form (not the shimmer) opens the clip.
    await settleLoaded(page);

    // ── Anchor a draft via autosave ──────────────────────────────────────────
    // Type a name into the Basic step's name input — the first change triggers
    // the draft autosave, which writes ``?draftId=…`` to the URL and (once the
    // save flushes) flips the SaveToolbar from "Save Draft" to the Drafts
    // picker. Guarded: if the input isn't present we simply skip ahead.
    const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER).first();
    if (await visibleSoon(nameInput)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft Persona Demo", { delay: 55 });
      await pauseForDemo(800);

      // Wait (deterministically) for the draft to anchor — draftId in the URL —
      // then for the "Saving…/Save Draft" indicator to clear so the toolbar
      // settles on the Drafts dropdown. Both bounded so a non-anchoring form
      // gives up fast instead of hanging the clip.
      await page.waitForURL(/[?&]draftId=/, { timeout: 8_000 }).catch(() => undefined);
      await page
        .getByRole("button", { name: /saving|save draft/i })
        .first()
        .waitFor({ state: "detached", timeout: 8_000 })
        .catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── CENTER: the Drafts picker (open → list → search → hover → autosave) ───
    // The picker trigger only renders once there are no unsaved changes (the
    // SaveToolbar shows the Save button otherwise), so it's guarded.
    const pickerTrigger = page.getByTestId("draft-picker-trigger");
    if (await visibleSoon(pickerTrigger, 6_000)) {
      await pickerTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await pickerTrigger.click().catch(() => undefined);
      await pauseForDemo(900); // let the dropdown open + lazy-load the drafts list

      // Reveal the saved-drafts list (each entry: draft-menu-item-{id}).
      const firstDraft = page.locator('[data-testid^="draft-menu-item-"]').first();
      if (await visibleSoon(firstDraft, 5_000)) {
        await pauseForDemo(900); // hold so the list reads
      }

      // Type into the in-dropdown search so the debounced filter visibly
      // re-queries, then CLEAR it (read-only — never commits anything).
      const search = page.getByTestId("draft-search");
      if (await visibleSoon(search, 3_000)) {
        await search.click().catch(() => undefined);
        await search.pressSequentially("Draft", { delay: 55 });
        await pauseForDemo(900); // let the 250ms-debounced loadDrafts react
        await search.fill("");
        await pauseForDemo(700); // list re-expands to the unfiltered set
      }

      // Hover the first draft entry so the row reads (NO click — clicking would
      // switch drafts, which we must not do).
      await hoverLocatorIfVisible(firstDraft);

      // Reveal the Autosave toggle in the dropdown footer (hover only — do not
      // flip it; toggling would mutate the autosave preference).
      const autosaveToggle = page.getByTestId("draft-autosave-toggle");
      if (await visibleSoon(autosaveToggle, 3_000)) {
        await autosaveToggle.scrollIntoViewIfNeeded().catch(() => undefined);
        await hoverLocatorIfVisible(autosaveToggle);
        await pauseForDemo(800);
      }

      // Dismiss the picker WITHOUT committing anything.
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // ── Brief form-step scroll: tour the new-persona form sections ───────────
    // Each beat is a guarded scrollToText (no-ops when the text isn't present),
    // so this stays robust to the form's section ordering / availability.
    for (const text of [
      /name/i,
      /description/i,
      /parameter/i,
      /color/i,
      /icon/i,
      /instruction/i,
    ]) {
      await scrollToText(page, text).catch(() => undefined);
    }
    await pauseForDemo(800);

    await saveDemoVideo(page, "personas-draft");
  });
});
