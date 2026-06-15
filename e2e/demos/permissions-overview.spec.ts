import { expect, test } from "@playwright/test";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: tour the profile-setup form top->bottom (Basic -> Contact -> Roles),
// then exercise the Roles step's read-only affordances WITHOUT mutating:
// the role search box, the "Show selected" filter popover, and the per-role
// edit popover that reveals the per-artifact PERMISSION CATALOG (collapsible
// groups + select-all + Level + Request Limits). Every beat past the one
// page-ready assertion (openArtifactForm/showFormStep) is guarded so it no-ops
// if its target is absent, and nothing is committed (open-then-Escape only).
test.describe("demo: permissions overview", () => {
  test("the role + permission catalog on profile setup", async ({ page }) => {
    test.setTimeout(120_000);

    // --- page ready ---
    await openArtifactForm(page, "/management/profiles/new");

    // --- tour the form top->bottom: each step holds ~1s ---
    await showFormStep(page, "basic");
    await showFormStep(page, "contact");
    await showFormStep(page, "roles");

    // --- Roles step search box: type so it shows, let it react, clear it ---
    const roleSearch = page.getByPlaceholder(/search roles/i).first();
    if (await roleSearch.isVisible().catch(() => false)) {
      await roleSearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await roleSearch.click().catch(() => undefined);
      await roleSearch.pressSequentially("admin", { delay: 55 });
      await pauseForDemo(900);
      await roleSearch.fill("");
      await pauseForDemo(700);
    }

    // --- "Show selected" filter popover: open, reveal the option, dismiss ---
    // The filter trigger is the only ghost icon-button next to the search row.
    const filterTrigger = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-filter") })
      .first();
    if (await filterTrigger.isVisible().catch(() => false)) {
      await filterTrigger.click().catch(() => undefined);
      // Reveal the "Show selected" checkbox option, hold so it reads.
      await scrollToText(page, /show selected/i);
      await pauseForDemo(900);
      // Dismiss WITHOUT applying (non-destructive: never commit the filter).
      await page.keyboard.press("Escape");
      await pauseForDemo(600);
    }

    // --- reveal the PERMISSION CATALOG via a role card's edit popover ---
    // The pencil button on each role card opens the RoleEditor, which renders
    // the per-artifact permission catalog, Level, and Request Limits. Opening
    // it is read-only; we Escape without saving.
    const editPencil = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-pencil") })
      .first();
    if (await editPencil.isVisible().catch(() => false)) {
      await editPencil.scrollIntoViewIfNeeded().catch(() => undefined);
      await editPencil.click().catch(() => undefined);
      await pauseForDemo(900);

      // Tour the editor: name/description, the Permissions catalog header,
      // and the Request Limits section so each labelled area reads on frame.
      await scrollToText(page, /permissions/i);
      await pauseForDemo(700);

      // Expand the first collapsible permission group (a <details> summary)
      // to reveal the individual operation checkboxes + "select all".
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

    // --- final scroll over the role catalog so the clip ends substantive ---
    await scrollToText(page, /role|permission|access|limit|artifact/i);
    await expect(page.getByTestId("artifact-form")).toBeVisible();
    await pauseForDemo(800);

    await saveDemoVideo(page, "permissions-overview");
  });
});
