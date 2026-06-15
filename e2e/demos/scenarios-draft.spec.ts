import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "scenarios-draft";

/**
 * NON-DESTRUCTIVE draft-WORKFLOW tour of the new-scenario builder
 * (/training/scenarios/new), centred on the SaveToolbar drafts picker —
 * the read-only "Drafts" dropdown in the toolbar's left slot.
 *
 * This is deliberately DISTINCT from scenarios-create (which tours the form
 * STEPS). Here the star is the draft-management UX: the `draft-picker-trigger`
 * dropdown and everything it reveals — the URL-backed `draft-search` box, the
 * saved-drafts list, and the Autosave toggle in the footer.
 *
 * WHY THE ORDER MATTERS — the toolbar's left slot is a single mode-switching
 * control: SaveToolbar renders the "Drafts" picker ONLY while there are no
 * unsaved changes; the instant the form is touched (`hasUnsavedChanges`) it
 * swaps to a "Save Draft" button and the picker disappears. So this tour opens
 * and fully exercises the picker FIRST — before any form interaction — and only
 * AFTER closing it does a brief, read-only form scroll. Nothing is typed into
 * the form, no draft is switched (clicking a `draft-menu-item-*` navigates), no
 * draft is created, and Save is never pressed.
 *
 * The draft-search input lives INSIDE the open dropdown (a portal), so typing
 * into it filters the in-memory drafts list without dirtying the form or
 * navigating; we type with pressSequentially so the keystrokes show, let the
 * list react, then clear it. The autosave Switch is only revealed/hovered, not
 * toggled.
 *
 * Every beat past the single page-ready assertion (the artifact-form root) is
 * guarded by isVisible().catch(() => false) (directly or via the guarded
 * helpers), so a control the toolbar lacks is skipped rather than failing the
 * recording. settleLoaded() runs after navigation so no loading skeleton is
 * captured.
 */
test.describe("demo: scenarios draft", () => {
  test("tours the scenario draft picker — search, saved list, autosave — without switching or saving", async ({
    page,
  }) => {
    // coverage: open the SaveToolbar drafts picker on a fresh scenario /new,
    // reveal the saved-drafts list, type+clear the draft search, hover a draft
    // entry, surface the autosave toggle, dismiss with Escape, then a brief
    // read-only form scroll. Never switches draft, never saves, never submits.
    await page.goto("/training/scenarios/new");
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    // Beat 1: surface the draft toolbar — hold so the "New draft" picker reads.
    const toolbar = page.getByTestId("draft-toolbar");
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // Beat 2: open the drafts picker. This is the centrepiece — the dropdown
    // portals the search box, the saved-drafts list, and the autosave footer.
    const trigger = page.getByTestId("draft-picker-trigger");
    let pickerOpened = false;
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click().catch(() => undefined);
      // Hold so the opened menu — search row + list + autosave — reads on frame.
      await pauseForDemo(1_300);
      pickerOpened = await page.getByTestId("draft-search").isVisible().catch(() => false);
    }

    if (pickerOpened) {
      // Beat 3: type into the URL-backed draft search so the keystrokes show,
      // let the in-memory list filter, then clear it back to the full list.
      // This filters the drafts list only — it does NOT dirty the form.
      const search = page.getByTestId("draft-search");
      if (await search.isVisible().catch(() => false)) {
        await search.click().catch(() => undefined);
        await search.pressSequentially("draft", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(1_100);
        // Clear it — fill("") removes the filter; hold so the list repopulates.
        await search.fill("").catch(() => undefined);
        await pauseForDemo(900);
      }

      // Beat 4: hover the first saved-draft entry so the list reads as a real,
      // browsable picker. Hover only — clicking would switch drafts (navigate).
      await hoverLocatorIfVisible(
        page.locator('[data-testid^="draft-menu-item-"]').first(),
      );
      await pauseForDemo(800);

      // Beat 5: surface the Autosave toggle in the dropdown footer — reveal it
      // by hovering; never flip it (it is a persisted preference).
      await scrollToText(page, /autosave/i).catch(() => undefined);
      await hoverLocatorIfVisible(page.getByTestId("draft-autosave-toggle"));
      await pauseForDemo(1_000);

      // Beat 6: dismiss the picker WITHOUT switching a draft or creating one.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // Beat 7: a brief read-only scroll through the form body so the clip shows
    // WHAT a draft captures. Done LAST and via scroll only — no field is
    // touched, so the toolbar stays in picker mode and nothing is dirtied.
    await scrollToText(page, /basic information/i).catch(() => undefined);
    await hoverLocatorIfVisible(
      page.getByTestId("artifact-form-step-basic").getByTestId("selectable-option").first(),
    );
    await scrollToText(page, /^personas$/i).catch(() => undefined);
    await pauseForDemo(1_200);

    await saveDemoVideo(page, TOPIC);
  });
});
