import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "parameters-create";

/**
 * NON-DESTRUCTIVE form-tour of the parameter create form (/management/parameters/new).
 *
 * The new-parameter page is one scrollable GenericForm with two step cards:
 *   - "Basic Information" — name (creatable text), description, Departments
 *     (selectable-option grid), and Flags (switches);
 *   - "Fields" — a "Search fields..." box, a Filters popover ("Show selected"
 *     checkbox + Apply), and a fields selectable grid.
 * It ends with the Back / Create Parameter action row.
 *
 * This demo TOURS those affordances without ever creating anything: it types
 * into the name input then CLEARS it (so no creatable name resolves and no
 * draft is anchored), reveals the Departments + Fields option grids by
 * hovering (no commit), exercises the Fields search (type → react → clear)
 * and opens-then-dismisses the Filters popover, and scrolls the submit row
 * into view WITHOUT clicking it. Nothing is submitted or persisted.
 *
 * Every beat past the single page-ready assertion (the artifact-form root) is
 * guarded by an isVisible().catch(() => false) check, so a control the form
 * lacks is skipped rather than failing the recording. settleLoaded() runs
 * after navigation so no loading skeleton is captured.
 */
test.describe("demo: parameters create", () => {
  test("tours the new-parameter form fields and pickers without submitting", async ({
    page,
  }) => {
    await page.goto("/management/parameters/new");
    await expectAuthenticated(page);
    await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page);

    const basic = page.getByTestId("artifact-form-step-basic");
    const fields = page.getByTestId("artifact-form-step-fields");

    // Beat 1: the Basic Information card — show the section heading.
    await scrollToText(page, /basic information/i).catch(() => undefined);

    // Beat 2: type into the name field so the typing reads on camera, then
    // CLEAR it — leaving it empty means no creatable name resolves, so nothing
    // is drafted or created. Read-only by construction.
    const nameInput = basic.getByPlaceholder(/student age/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await nameInput.click().catch(() => undefined);
      await nameInput.pressSequentially("Student Age Band", { delay: 55 });
      await pauseForDemo(1_100);
      await nameInput.fill("");
      await pauseForDemo(600);
    }

    // Beat 3: type into the description, let it read, then clear it too.
    const descInput = basic.getByPlaceholder(/brief description/i).first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.scrollIntoViewIfNeeded().catch(() => undefined);
      await descInput.click().catch(() => undefined);
      await descInput.pressSequentially("The learner's age band.", { delay: 55 });
      await pauseForDemo(1_100);
      await descInput.fill("");
      await pauseForDemo(600);
    }

    // Beat 4: reveal the Departments option grid (hover the first option, no
    // commit) so the picker's choices are on screen.
    const firstDept = basic.getByTestId("selectable-option").first();
    if (await firstDept.isVisible().catch(() => false)) {
      await firstDept.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstDept.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // Beat 5: surface the Flags row (the active/scope switches) without flipping.
    await scrollToText(page, /flags/i).catch(() => undefined);

    // Beat 6: the Fields card — scroll its heading into view.
    await scrollToText(page, /^fields$/i).catch(() => undefined);
    if (await fields.isVisible().catch(() => false)) {
      await fields.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
    }

    // Beat 7: exercise the Fields search — type a token so the grid reacts,
    // hold, then clear it back to the unfiltered list (reversible).
    const fieldSearch = page.getByPlaceholder(/search fields/i).first();
    if (await fieldSearch.isVisible().catch(() => false)) {
      await fieldSearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await fieldSearch.click().catch(() => undefined);
      await fieldSearch.pressSequentially("learning", { delay: 55 });
      await pauseForDemo(1_200);
      await fieldSearch.fill("");
      await pauseForDemo(700);
    }

    // Beat 8: open the Fields filter popover ("Show selected"), reveal the
    // option, then dismiss with Escape WITHOUT applying — read-only.
    const filterBtn = fields.getByRole("button").filter({ has: page.locator("svg") });
    const filterTrigger = filterBtn.last();
    if (await filterTrigger.isVisible().catch(() => false)) {
      await filterTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await filterTrigger.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Beat 9: reveal the Fields option grid (hover the first field, no commit).
    const firstField = fields.getByTestId("selectable-option").first();
    if (await firstField.isVisible().catch(() => false)) {
      await firstField.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstField.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // Beat 10: scroll the submit action row into view — show "Create Parameter"
    // — but NEVER click it. The tour ends without creating anything.
    const submit = page.locator('[data-testid="artifact-form-submit"]:visible').first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
