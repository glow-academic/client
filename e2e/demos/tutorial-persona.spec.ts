import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-persona";

// coverage: tours the persona build-path tutorial on a SINGLE stage — the
// /training/personas/new artifact form — top to bottom and READ-ONLY. We never
// navigate across other build-path forms (which would flash skeletons). After
// the one page-ready assertion every beat no-ops if its target is absent:
// settle out the skeleton, then tour the toolbar Drafts picker (open + search +
// clear + Escape, no commit), the Basic Information step (type the persona name
// into the live-typing field then clear it back to empty so nothing mutates,
// type the description then clear it, hover the department option grid), and
// scroll through the Parameters, Color, Icon, and Instructions steps. Nothing
// is ever submitted and no draft field is left changed.
test.describe("demo: tutorial persona", () => {
  test("tours the persona build-path stage read-only", async ({ page }) => {
    await page.goto("/training/personas/new");
    await expectAuthenticated(page);
    // Single page-ready assertion: the persona artifact form is mounted.
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
        await draftSearch.pressSequentially("student", { delay: 55 }).catch(() => undefined);
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

    // Live-typing the persona name into the inline title field, then clearing it
    // back to empty so the draft is left exactly as it started (non-mutating).
    const nameField = page.getByPlaceholder(/enthusiastic student/i).first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameField.click().catch(() => undefined);
      await nameField
        .pressSequentially("Confused Student", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await nameField.fill("").catch(() => undefined);
      await page.keyboard.press("Tab").catch(() => undefined);
      await pauseForDemo(400);
    }

    // Live-typing the description, then clearing it back to empty (non-mutating).
    const descriptionField = page.getByTestId("input-persona-description").first();
    if (await descriptionField.isVisible().catch(() => false)) {
      await descriptionField.scrollIntoViewIfNeeded().catch(() => undefined);
      await descriptionField.click().catch(() => undefined);
      await descriptionField
        .pressSequentially("Seeks to understand by asking questions.", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await descriptionField.fill("").catch(() => undefined);
      await page.keyboard.press("Tab").catch(() => undefined);
      await pauseForDemo(400);
    }

    // Hover the department option grid so the selectable departments read on
    // frame — hover only, no click, so no selection is toggled.
    await hoverFirstVisible(page, "selectable-option");

    // --- Parameters step ---
    const parametersStep = page.getByTestId("artifact-form-step-parameters").first();
    if (await parametersStep.isVisible().catch(() => false)) {
      await parametersStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // --- Color step ---
    const colorStep = page.getByTestId("artifact-form-step-color").first();
    if (await colorStep.isVisible().catch(() => false)) {
      await colorStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // --- Icon step ---
    const iconStep = page.getByTestId("artifact-form-step-icon").first();
    if (await iconStep.isVisible().catch(() => false)) {
      await iconStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // --- Instructions (content) step ---
    const contentStep = page.getByTestId("artifact-form-step-content").first();
    if (await contentStep.isVisible().catch(() => false)) {
      await contentStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
