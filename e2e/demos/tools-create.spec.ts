import { expect } from "@playwright/test";

import { test } from "../fixtures";

import {
  expectAuthenticated,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: tools-create — NON-DESTRUCTIVE form-tour of the tool create form.
//
// The tool "new" form (`/intelligence/tools/new`) renders all four steps
// vertically at once — Basic Information, Arguments, Permissions, Instructions
// (see GenericForm: every step is a sibling `artifact-form-step-{id}` div) with
// the create/submit row (`artifact-form-submit`) pinned at the bottom. So a
// top->bottom scroll genuinely tours the whole page.
//
// This recording is strictly READ-ONLY against the LIVE instance: it types into
// the name field and the permissions search (then CLEARS both), opens the
// "Show selected" permissions filter (then closes it), and scrolls the submit
// row into view — but it NEVER clicks submit, never clicks "Add Argument"
// (which would seed local draft rows), and never toggles a persisted control.
// Nothing is committed. Every beat past the single page-ready assertion is
// guarded (isVisible().catch(() => false)) so a missing affordance no-ops
// rather than fails.

test.describe("demo: tools create", () => {
  test("instructor tours the tool create form", async ({ page }) => {
    test.setTimeout(180_000);

    // --- Page ready (the ONE hard assertion) ---
    await page.goto("/intelligence/tools/new");
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    // Trim the loading skeleton so the opening frame is the populated form.
    await settleLoaded(page);

    // --- Step 1: Basic Information ---
    const basicStep = page.getByTestId("artifact-form-step-basic");
    if (await basicStep.isVisible().catch(() => false)) {
      await basicStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();

      // Type a tool name so the field visibly reacts, then CLEAR it (the form
      // autosaves a draft on input — clearing leaves nothing persisted to reap).
      const nameInput = page.getByPlaceholder(/e\.g\., Calculator/i).first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.click().catch(() => undefined);
        await nameInput.pressSequentially("Calculator", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await nameInput.fill("").catch(() => undefined);
        await pauseForDemo();
      }

      // The description field reads next in the Basic card.
      const descInput = page.getByPlaceholder(/enter description/i).first();
      if (await descInput.isVisible().catch(() => false)) {
        await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
        await descInput.hover().catch(() => undefined);
        await pauseForDemo();
      }
    }

    // Departments + Flags read inside the Basic card — surface them by label.
    await scrollToText(page, /departments/i);
    await scrollToText(page, /flags/i);

    // --- Step 2: Arguments (read-only — never click "Add Argument") ---
    const argsStep = page.getByTestId("artifact-form-step-arguments");
    if (await argsStep.isVisible().catch(() => false)) {
      await argsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
      // Reveal the "Add Argument" affordance + empty-state copy without
      // clicking (a click seeds a local draft row — out of scope for a tour).
      await scrollToText(page, /add argument/i);
    }

    // --- Step 3: Permissions (search re-query + "Show selected" filter) ---
    const permsStep = page.getByTestId("artifact-form-step-permissions");
    if (await permsStep.isVisible().catch(() => false)) {
      await permsStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();

      // Type into the in-step search so the permission grid re-filters live,
      // hold for the reaction, then CLEAR it back to the full list.
      const permSearch = permsStep.getByPlaceholder(/search permissions/i).first();
      if (await permSearch.isVisible().catch(() => false)) {
        await permSearch.click().catch(() => undefined);
        await permSearch.pressSequentially("read", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await permSearch.fill("").catch(() => undefined);
        await pauseForDemo();
      }

      // Open the "Show selected" filter to reveal its effect, then turn it OFF
      // again so the step is left exactly as found (non-destructive toggle).
      const showSelected = permsStep
        .getByRole("checkbox", { name: /show selected/i })
        .first()
        .or(permsStep.getByText(/show selected/i).first());
      if (await showSelected.isVisible().catch(() => false)) {
        await showSelected.click().catch(() => undefined);
        await pauseForDemo(900);
        await showSelected.click().catch(() => undefined);
        await pauseForDemo();
      }
    }

    // --- Step 4: Instructions ---
    const instrStep = page.getByTestId("artifact-form-step-instructions");
    if (await instrStep.isVisible().catch(() => false)) {
      await instrStep.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
      await scrollToText(page, /response template|instructions/i);
    }

    // --- Submit row: scroll into view, hold — but NEVER click it ---
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await submit.hover().catch(() => undefined);
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, "tools-create");
  });
});
