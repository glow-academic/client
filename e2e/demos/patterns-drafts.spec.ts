// TOPIC: patterns-drafts
// coverage: a DRAFT-WORKFLOW tour of the common SaveToolbar draft pattern, modeled
// on the personas-draft surface (the patterns library's draft surface IS the
// personas/new artifact form). Open /training/personas/new, settleLoaded, anchor a
// draft via autosave, then CENTER on the SaveToolbar Drafts picker: open the
// draft-picker-trigger, reveal the saved-drafts list, type+clear the in-dropdown
// draft-search so the debounced filter visibly re-queries, hover the first
// draft-menu-item, reveal the draft-autosave-toggle, then Escape — never switching
// or committing a draft. A brief guarded form-step scroll closes the tour.
//
// HARD RULES honored: NON-DESTRUCTIVE only — the picker is opened-then-Escaped, no
// draft is switched and nothing is submitted. Every beat past the single
// page-ready assertion (artifact-form) is guarded (visibleSoon / isVisible().catch
// / bounded waitFor) so an absent affordance no-ops instead of failing.
// settleLoaded() runs before any tour beat so no loading skeleton is captured.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import {
  expectAuthenticated,
  settleLoaded,
  hoverLocatorIfVisible,
  scrollToText,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "patterns-drafts";
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

test.describe("demo: patterns drafts", () => {
  test("records the common draft toolbar and staged-edit pattern", async ({ page }) => {
    test.setTimeout(180_000);

    // ── Open the draft surface (the patterns/personas artifact form) ──────────
    await page.goto(NEW_PATH);
    await expectAuthenticated(page);

    // SINGLE page-ready assertion: the GenericForm root for the new artifact page.
    const form = page.getByTestId("artifact-form");
    await expect(form).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton so the LOADED form (not the shimmer) opens the clip.
    await settleLoaded(page);

    // ── Anchor a draft via autosave ──────────────────────────────────────────
    // Typing a name triggers the draft autosave, which writes ``?draftId=…`` to
    // the URL and (once the save flushes) flips the SaveToolbar to expose the
    // Drafts picker. Guarded: if the input isn't present we skip ahead.
    const nameInput = page.getByPlaceholder(NAME_PLACEHOLDER).first();
    if (await visibleSoon(nameInput)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Draft Pattern Persona", { delay: 55 });
      await pauseForDemo(800);

      // Wait (bounded) for the draft to anchor — draftId in the URL — then for
      // the "Saving…/Save Draft" indicator to clear so the toolbar settles on
      // the Drafts picker. Both bounded so a non-anchoring form gives up fast.
      await page.waitForURL(/[?&]draftId=/, { timeout: 8_000 }).catch(() => undefined);
      await page
        .getByRole("button", { name: /saving|save draft/i })
        .first()
        .waitFor({ state: "detached", timeout: 8_000 })
        .catch(() => undefined);
      await pauseForDemo(700);
    }

    // ── CENTER: the Drafts picker (open → list → search → hover → autosave) ───
    // The draft-toolbar hosts the picker trigger; it only renders once there are
    // no unsaved changes, so it's guarded.
    await hoverLocatorIfVisible(page.getByTestId("draft-toolbar"));

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
        await pauseForDemo(900); // let the debounced loadDrafts react
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

    // ── Brief form-step scroll: tour the artifact form sections ──────────────
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

    await saveDemoVideo(page, TOPIC);
  });
});
