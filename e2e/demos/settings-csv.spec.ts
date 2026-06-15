import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-csv";

// coverage: a READ-ONLY tour of the Settings library (`/settings`) CENTERED on
// the bulk CSV import/export workflow. The Settings page is the artifact-list
// surface for provider / auth / system configuration rows; its toolbar carries
// an "Import CSV" button (gated on the page's `parseCsvAction`/`importFields`)
// that opens the shared `BulkImport` dialog (`dialog-bulk-import`).
//
// The CSV demo focuses the clip on that workflow:
//   1. settle on the loaded settings grid + toolbar context,
//   2. open the "Import CSV" dialog to reveal its Upload stepper, the dashed
//      upload DROPZONE ("Drop a .csv file here, or browse"), and the
//      Required/Optional field hints — REVEAL ONLY,
//   3. hover the dialog's "Download Template" button (the only download/export
//      affordance — a CSV download), NEVER clicking it (a click triggers a file
//      download), then Escape the dialog,
//   4. tour the grid context: hover a setting card, then scroll to the
//      pagination row at the bottom.
//
// HARD non-destructive: never picks a file, never clicks "browse" (that opens
// the OS file picker), never clicks "Download Template" / "Import Settings",
// never confirms an import. Nothing is uploaded, downloaded, created, or
// persisted — the dialog is opened then Escaped.
//
// Every beat past the single page-ready assertion (`settings-grid`) is guarded
// by an isVisible().catch(()=>false) check (or a guarded helper) so any control
// the page or the current role lacks simply no-ops rather than failing the
// recording. settleLoaded() runs right after the page-ready assertion so the
// loading skeletons are gone before the first beat — no half-loaded grid frame
// is recorded.
test.describe("demo: settings csv", () => {
  test("opens the settings CSV import dialog read-only and tours the grid", async ({ page }) => {
    await page.goto("/settings");
    await expectAuthenticated(page);
    // Single page-ready assertion: the populated settings grid is on screen.
    await expect(page.getByTestId("settings-grid")).toBeVisible({ timeout: 30_000 });
    // Wait out the loading skeleton so the opening frames are the loaded grid.
    await settleLoaded(page);

    // Beat 1: settle on the toolbar so the "Import CSV" button is in frame —
    // this is the entry point for the bulk CSV workflow the demo centers on.
    const toolbar = page.getByTestId("settings-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // Beat 2: open the "Import CSV" dialog. This is the heart of the clip —
    // it reveals the bulk-import affordance without committing anything.
    const importBtn = page.getByRole("button", { name: /import csv/i }).first();
    const importBtnVisible = await importBtn.isVisible().catch(() => false);
    if (importBtnVisible) {
      await importBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await importBtn.click().catch(() => undefined);

      // The dialog mounts the Upload stage: a stepper (Upload / Review) and the
      // dashed dropzone. Wait for it so the opening dialog frame is the loaded
      // content, then hold so its title + dropzone read on camera.
      const dialog = page.getByTestId("dialog-bulk-import").first();
      if (await dialog.isVisible().catch(() => false)) {
        await pauseForDemo(1_500);

        // Beat 3: settle on the dropzone copy so the "Drop a .csv file here,
        // or browse" upload target reads. REVEAL ONLY — we never click
        // "browse" (it would open the OS file picker) and never drop a file.
        await scrollToText(page, /drop a \.csv file here/i);
        await pauseForDemo(1_100);

        // Beat 4: settle on the Required / Optional field hints so the CSV
        // schema the importer expects is visible.
        await scrollToText(page, /required:/i);
        await pauseForDemo(900);

        // Beat 5: hover the "Download Template" button — the dialog's
        // download/export affordance (it emits a CSV template). HOVER ONLY:
        // a real click triggers a browser file download, so we never click it.
        const templateBtn = dialog.getByRole("button", { name: /download template/i }).first();
        if (await templateBtn.isVisible().catch(() => false)) {
          await templateBtn.scrollIntoViewIfNeeded().catch(() => undefined);
          await templateBtn.hover().catch(() => undefined);
          await pauseForDemo(1_300);
        }

        // Dismiss the dialog — nothing chosen, nothing imported, nothing saved.
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // Beat 6: back on the grid, type into the search box so the typing reads on
    // camera, let the grid re-filter, then clear it back to the full list.
    // Read-only — scopes which rows you'd select for a CSV-driven workflow.
    const search = page.getByTestId("settings-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("key", { delay: 55 });
      await pauseForDemo(1_200);
      await search.fill("");
      await settleLoaded(page);
    }

    // Beat 7: hover the first setting card so its row-level affordances
    // (Edit / View) surface — read-only hover, the grid context the import
    // lands rows into.
    await hoverFirstVisible(page, "setting-card");
    await pauseForDemo(1_000);

    // Beat 8: scroll to the pagination row so the bottom of the page is toured.
    // Pure scroll (no Next/size click) keeps the clip focused on the CSV story.
    await scrollToText(page, /rows? per page|page \d+ of \d+|of \d+ row/i);
    await pauseForDemo(1_000);

    await saveDemoVideo(page, TOPIC);
  });
});
