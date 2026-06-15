import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { settleLoaded, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: tour the profile-setup form top->bottom (Basic -> Contact -> Roles)
// then drill into how the server's per-artifact permission model is MIRRORED in
// the client. The Roles step's per-role edit popover renders the permission
// catalog GROUPED BY ARTIFACT (one collapsible <details> per artifact, each
// summarising a selected/total count + a select-all link, expanding to the
// individual operation checkboxes). We expand several artifact groups so the
// mirrored operation rows read, tour the Level + Request-Limits sections that
// round out the role's authority, and exercise the role search + "Show selected"
// filter popover. Strictly read-only: we only open/Escape pickers and
// expand/collapse the presentational <details> groups — never toggle a
// permission checkbox, never click select-all, never save. Every beat past the
// one page-ready assertion (openArtifactForm) is guarded so it no-ops if its
// target is absent, and skeletons are settled before the tour so no shimmer
// frame is recorded.
test.describe("demo: permissions client-mirror", () => {
  test("per-artifact permission catalog mirrored on profile setup", async ({ page }) => {
    test.setTimeout(120_000);

    // --- page ready (single hard assertion) ---
    await openArtifactForm(page, "/management/profiles/new");
    // Settle the form skeleton so the populated steps, not the shimmer, lead
    // the clip before we begin the tour.
    await settleLoaded(page);

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

    // --- "Show selected" filter popover: open, reveal the option, Escape ---
    // The filter trigger is the ghost icon-button next to the search row.
    const filterTrigger = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-filter") })
      .first();
    if (await filterTrigger.isVisible().catch(() => false)) {
      await filterTrigger.click().catch(() => undefined);
      await scrollToText(page, /show selected/i);
      await pauseForDemo(900);
      // Dismiss WITHOUT applying (non-destructive: never commit the filter).
      await page.keyboard.press("Escape");
      await pauseForDemo(600);
    }

    // --- reveal the PER-ARTIFACT PERMISSION MIRROR via a role edit popover ---
    // The pencil button on each role card opens the RoleEditor, which renders
    // the catalog grouped by artifact. Opening it is read-only; we Escape
    // without saving.
    const editPencil = page
      .getByRole("button")
      .filter({ has: page.locator("svg.lucide-pencil") })
      .first();
    if (await editPencil.isVisible().catch(() => false)) {
      await editPencil.scrollIntoViewIfNeeded().catch(() => undefined);
      await editPencil.click().catch(() => undefined);
      await pauseForDemo(900);

      // The "Permissions (N)" header announces how many ops this role mirrors.
      await scrollToText(page, /permissions/i);
      await pauseForDemo(700);

      // Expand the FIRST FEW artifact groups so the per-artifact operation rows
      // (the mirror of the server permission model) read on frame. Toggling a
      // <details> open/closed is purely presentational — no permission state is
      // changed. We deliberately do NOT click the "select all" link.
      const groups = page.locator("details summary");
      const groupCount = await groups.count().catch(() => 0);
      for (let i = 0; i < Math.min(groupCount, 3); i++) {
        const summary = groups.nth(i);
        if (await summary.isVisible().catch(() => false)) {
          await summary.scrollIntoViewIfNeeded().catch(() => undefined);
          await summary.click().catch(() => undefined); // expand: reveal operation checkboxes
          await pauseForDemo(850);
          await summary.click().catch(() => undefined); // collapse back to the grouped view
          await pauseForDemo(400);
        }
      }

      // Tour the rest of the role's authority surface: privilege Level and the
      // Request-Limits section, so each labelled area reads.
      await scrollToText(page, /level/i);
      await pauseForDemo(600);
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

    await saveDemoVideo(page, "permissions-client-mirror");
  });
});
