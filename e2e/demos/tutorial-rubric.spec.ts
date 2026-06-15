import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-rubric";

// coverage: tours the rubric build-path tutorial on a SINGLE stage — the
// /platform/rubrics/new artifact form — top to bottom and READ-ONLY. We never
// navigate across other build-path forms (which would flash skeletons). After
// the one page-ready assertion every beat no-ops if its target is absent:
// settle out the skeleton, then tour the toolbar Drafts picker (open + search +
// clear + Escape, no commit), the Basic Information step (type the rubric name
// to show the live-typing field, then clear it back to empty so nothing is
// mutated), hover the department option grid, and scroll through the Standard
// Groups + Standards steps. Nothing is ever submitted and no draft field is
// left changed.
test.describe("demo: tutorial rubric", () => {
  test("tours the rubric build-path stage read-only", async ({ page }) => {
    await page.goto("/platform/rubrics/new");
    await expectAuthenticated(page);
    // Single page-ready assertion: the rubric artifact form is mounted.
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    // Trim the loading shimmer so the populated form fills the opening frames.
    await settleLoaded(page);

    // --- Toolbar Drafts picker (read-only browse) ---
    // Open the [Drafts ▾] dropdown, reveal the searchable draft list, type to
    // show it react, clear, then Escape WITHOUT switching drafts.
    const draftTrigger = page.getByTestId("draft-picker-trigger").first();
    if (await draftTrigger.isVisible().catch(() => false)) {
      await draftTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await draftTrigger.click().catch(() => undefined);
      await pauseForDemo(800);
      const draftSearch = page.getByTestId("draft-search").first();
      if (await draftSearch.isVisible().catch(() => false)) {
        await draftSearch.pressSequentially("office", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(800);
        await draftSearch.fill("").catch(() => undefined);
        await pauseForDemo(400);
      }
      // Dismiss without committing a draft switch.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // --- Basic Information step ---
    const basicStep = page.getByTestId("artifact-form-step-basic").first();
    if (await basicStep.isVisible().catch(() => false)) {
      await basicStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // Live-typing the rubric name into the inline title field, then clearing it
    // back to empty so the draft is left exactly as it started (non-mutating).
    const nameField = page.getByPlaceholder(/sales call rubric/i).first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameField.click().catch(() => undefined);
      await nameField
        .pressSequentially("TA Office Hours Assessment", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await nameField.fill("").catch(() => undefined);
      await page.keyboard.press("Tab").catch(() => undefined);
      await pauseForDemo(400);
    }

    // Hover the department option grid so the selectable departments read on
    // frame — hover only, no click, so no selection is toggled.
    await hoverFirstVisible(page, "selectable-option");

    // --- Standard Groups step ---
    const groupsStep = page.getByTestId("artifact-form-step-standard_groups").first();
    if (await groupsStep.isVisible().catch(() => false)) {
      await groupsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // --- Standards step ---
    const standardsStep = page.getByTestId("artifact-form-step-standards").first();
    if (await standardsStep.isVisible().catch(() => false)) {
      await standardsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
