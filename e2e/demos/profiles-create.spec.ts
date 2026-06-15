import { expect, test } from "@playwright/test";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: NON-DESTRUCTIVE create-form tour of the "new profile" form
// (/management/profiles/new). Tour the three steps top->bottom
// (Basic Information -> Contact Information -> Roles), exercise each step's
// read-only affordances WITHOUT mutating: hover the department option grid,
// type into the contact ghost-autocomplete inputs and clear them, then on the
// Roles step drive the role search box, the "Show selected" filter popover, and
// the per-role edit popover that reveals the per-artifact PERMISSION CATALOG.
// Finally scroll the "Create Profile" submit row into view to frame it as a
// create flow — but NEVER submit. Every beat past the single page-ready
// assertion (openArtifactForm/showFormStep) is guarded so it no-ops if its
// target is absent, and nothing is committed (open-then-Escape / type-then-clear).
test.describe("demo: profiles create", () => {
  test("tour the new-profile create form without submitting", async ({ page }) => {
    test.setTimeout(120_000);

    // --- page ready (settles after navigation; no skeleton frame) ---
    await openArtifactForm(page, "/management/profiles/new");

    // --- STEP 1: Basic Information ---
    await showFormStep(page, "basic");

    // The name header input + department option grid live on the basic step.
    // Hover a department option card so the selectable affordance reads (no click).
    const deptOption = page.getByTestId("selectable-option").first();
    if (await deptOption.isVisible().catch(() => false)) {
      await deptOption.scrollIntoViewIfNeeded().catch(() => undefined);
      await deptOption.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // --- STEP 2: Contact Information ---
    await showFormStep(page, "contact");

    // The contact step has ghost-autocomplete email inputs. Type into the
    // primary-email field so typing shows, let it react, then CLEAR it
    // (non-destructive: never press the Add button that commits the email).
    const primaryEmail = page.getByPlaceholder(/type primary email/i).first();
    if (await primaryEmail.isVisible().catch(() => false)) {
      await primaryEmail.scrollIntoViewIfNeeded().catch(() => undefined);
      await primaryEmail.click().catch(() => undefined);
      await primaryEmail.pressSequentially("jordan@example.edu", { delay: 55 });
      await pauseForDemo(900);
      await primaryEmail.fill("");
      await pauseForDemo(600);
    }

    // --- STEP 3: Roles ---
    await showFormStep(page, "roles");

    // Role search box: type so it shows, let it react, clear it.
    const roleSearch = page.getByPlaceholder(/search roles/i).first();
    if (await roleSearch.isVisible().catch(() => false)) {
      await roleSearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await roleSearch.click().catch(() => undefined);
      await roleSearch.pressSequentially("admin", { delay: 55 });
      await pauseForDemo(900);
      await roleSearch.fill("");
      await pauseForDemo(700);
    }

    // "Show selected" filter popover: open, reveal the option, dismiss without
    // applying (the only ghost icon-button next to the search row).
    const filterTrigger = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-filter") })
      .first();
    if (await filterTrigger.isVisible().catch(() => false)) {
      await filterTrigger.click().catch(() => undefined);
      await scrollToText(page, /show selected/i);
      await pauseForDemo(900);
      await page.keyboard.press("Escape");
      await pauseForDemo(600);
    }

    // Reveal the PERMISSION CATALOG via a role card's edit (pencil) popover.
    // Opening the RoleEditor is read-only; we Escape without saving.
    const editPencil = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-pencil") })
      .first();
    if (await editPencil.isVisible().catch(() => false)) {
      await editPencil.scrollIntoViewIfNeeded().catch(() => undefined);
      await editPencil.click().catch(() => undefined);
      await pauseForDemo(900);

      // Tour the editor: the Permissions catalog header, expand the first
      // collapsible permission group, then Level + Request Limits.
      await scrollToText(page, /permissions/i);
      await pauseForDemo(700);

      const permGroup = page.locator("details summary").first();
      if (await permGroup.isVisible().catch(() => false)) {
        await permGroup.click().catch(() => undefined);
        await pauseForDemo(900);
      }
      await scrollToText(page, /level/i);
      await scrollToText(page, /request limits/i);
      await pauseForDemo(700);

      // Close the editor popover WITHOUT saving (non-destructive).
      await page.keyboard.press("Escape");
      await pauseForDemo(600);
    }

    // --- frame the create flow: scroll the submit row into view, NEVER submit ---
    const submit = page.getByTestId("artifact-form-submit");
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }
    await scrollToText(page, /create profile|role|permission|access|limit/i);

    // --- still on the create form (no mutation occurred) ---
    await expect(page.getByTestId("artifact-form")).toBeVisible();
    await pauseForDemo(800);

    await saveDemoVideo(page, "profiles-create");
  });
});
