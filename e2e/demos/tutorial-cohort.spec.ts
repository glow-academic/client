import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "tutorial-cohort";

// coverage: tours the cohort build-path tutorial on a SINGLE stage — the
// /training/cohorts/new artifact form — top to bottom and READ-ONLY. We never
// navigate across other build-path forms (which would flash skeletons). After
// the one page-ready assertion every beat no-ops if its target is absent:
// settle out the skeleton, then tour the toolbar Drafts picker (open + search +
// clear + Escape, no commit), the Basic Information step (type the cohort name
// into the live-typing field then clear it back to empty so nothing mutates,
// type the description then clear it, hover the department option grid), then
// the Simulations step (open + type + clear its "Search simulations" box, open
// the Filters popover to reveal the "Show selected" toggle and Escape WITHOUT
// applying) and the Profiles step (same search + filter open/clear/Escape).
// Nothing is ever submitted, no Apply/confirm is clicked, and no draft field is
// left changed.
test.describe("demo: tutorial cohort", () => {
  test("tours the cohort build-path stage read-only", async ({ page }) => {
    await page.goto("/training/cohorts/new");
    await expectAuthenticated(page);
    // Single page-ready assertion: the cohort artifact form is mounted.
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
        await draftSearch.pressSequentially("cohort", { delay: 55 }).catch(() => undefined);
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

    // Live-typing the cohort name into the inline title field, then clearing it
    // back to empty so the draft is left exactly as it started (non-mutating).
    const nameField = page.getByPlaceholder(/spring 2024 cohort/i).first();
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameField.click().catch(() => undefined);
      await nameField
        .pressSequentially("Fall 2025 CS TAs", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await nameField.fill("").catch(() => undefined);
      await page.keyboard.press("Tab").catch(() => undefined);
      await pauseForDemo(400);
    }

    // Live-typing the description, then clearing it back to empty (non-mutating).
    const descriptionField = page.getByTestId("input-cohort-description").first();
    if (await descriptionField.isVisible().catch(() => false)) {
      await descriptionField.scrollIntoViewIfNeeded().catch(() => undefined);
      await descriptionField.click().catch(() => undefined);
      await descriptionField
        .pressSequentially("Teaching assistants for the fall CS sequence.", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(900);
      await descriptionField.fill("").catch(() => undefined);
      await page.keyboard.press("Tab").catch(() => undefined);
      await pauseForDemo(400);
    }

    // Hover the department option grid so the selectable departments read on
    // frame — hover only, no click, so no selection is toggled.
    await hoverFirstVisible(page, "selectable-option");

    // --- Simulations step ---
    const simulationsStep = page.getByTestId("artifact-form-step-simulations").first();
    if (await simulationsStep.isVisible().catch(() => false)) {
      await simulationsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);

      // Type into the "Search simulations" box so the live re-query shows, then
      // clear it back to empty (read-only view filter, nothing committed).
      const simSearch = simulationsStep
        .getByPlaceholder(/search simulations/i)
        .first();
      if (await simSearch.isVisible().catch(() => false)) {
        await simSearch.click().catch(() => undefined);
        await simSearch.pressSequentially("intro", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await simSearch.fill("").catch(() => undefined);
        await pauseForDemo(400);
      }

      // Open the Filters popover to reveal the "Show selected" toggle, hold so
      // it reads, then Escape WITHOUT clicking Apply (no filter committed).
      const simFilterTrigger = simulationsStep
        .locator("button:has(svg.lucide-filter)")
        .first();
      if (await simFilterTrigger.isVisible().catch(() => false)) {
        await simFilterTrigger.click().catch(() => undefined);
        await pauseForDemo(800);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(400);
      }
    }

    // --- Profiles step ---
    const profilesStep = page.getByTestId("artifact-form-step-profiles").first();
    if (await profilesStep.isVisible().catch(() => false)) {
      await profilesStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);

      // Type into the "Search profiles" box, let it react, then clear it.
      const profileSearch = profilesStep
        .getByPlaceholder(/search profiles/i)
        .first();
      if (await profileSearch.isVisible().catch(() => false)) {
        await profileSearch.click().catch(() => undefined);
        await profileSearch
          .pressSequentially("student", { delay: 55 })
          .catch(() => undefined);
        await pauseForDemo(900);
        await profileSearch.fill("").catch(() => undefined);
        await pauseForDemo(400);
      }

      // Open the Filters popover, reveal the "Show selected" toggle, Escape
      // WITHOUT applying.
      const profileFilterTrigger = profilesStep
        .locator("button:has(svg.lucide-filter)")
        .first();
      if (await profileFilterTrigger.isVisible().catch(() => false)) {
        await profileFilterTrigger.click().catch(() => undefined);
        await pauseForDemo(800);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    await saveDemoVideo(page, TOPIC);
  });
});
