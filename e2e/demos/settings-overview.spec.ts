import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "settings-overview";

// coverage: a READ-ONLY top-to-bottom tour of the Settings library page
// (`/settings`). The Settings page is the artifact-list surface for provider /
// auth / system configuration rows, composed of the standard list widgets: the
// `settings-search` box, the three faceted pickers (Providers / Auth / Systems
// via `ThreePickerFilters`), the `DataTableViewOptions` "View" column menu, the
// `settings-grid` of `setting-card`s, the pagination controls, and the
// "Import CSV" dialog.
//
// The demo scrolls through every section, types into the search box (and clears
// it), opens EACH faceted picker to reveal its options then Escapes, opens the
// View column menu then Escapes, hovers a setting card, and opens the Import CSV
// dialog then Escapes — never selecting a facet value, never toggling a column,
// never editing/saving a setting, never typing a key, never confirming an
// import/export/refresh. Nothing is committed or persisted.
//
// Every beat past the single page-ready assertion (`settings-grid`) is guarded
// by an isVisible().catch(()=>false) check (or routes through a guarded helper),
// so any control the page or the current role lacks simply no-ops rather than
// failing the recording. settleLoaded() runs right after the page-ready
// assertion so the loading skeletons are gone before the first beat — no
// half-loaded grid frame is recorded.
test.describe("demo: settings overview", () => {
  test("tours the settings library and opens each filter read-only", async ({ page }) => {
    await page.goto("/settings");
    await expectAuthenticated(page);
    // Single page-ready assertion: the populated settings grid is on screen.
    await expect(page.getByTestId("settings-grid")).toBeVisible({ timeout: 30_000 });
    // Wait out the loading skeleton so the opening frames are the loaded grid.
    await settleLoaded(page);

    // Beat 1: settle on the toolbar / search row at the top of the page.
    const toolbar = page.getByTestId("settings-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // Beat 2: type a term into the search box so the typing reads on camera,
    // let the grid react, then clear it back to the full list. Read-only.
    const search = page.getByTestId("settings-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("key", { delay: 55 });
      await pauseForDemo(1_200);
      await search.fill("");
      await search.press("Enter").catch(() => undefined);
      await settleLoaded(page);
    }

    // Beats 3-5: open EACH faceted picker (Providers / Auth / Systems) to reveal
    // its options, hold so they read, then Escape — no facet value selected.
    for (const facet of [/^Providers$/, /^Auth$/, /^Systems$/]) {
      const trigger = page.getByRole("button", { name: facet }).first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.click().catch(() => undefined);
        await pauseForDemo(1_300);
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(600);
      }
    }

    // Beat 6: open the "View" column-visibility menu to reveal which card
    // features can be shown/hidden, hold, then Escape — nothing toggled.
    const viewBtn = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewBtn.click().catch(() => undefined);
      await pauseForDemo(1_300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(600);
    }

    // Beat 7: scroll into the grid and hover the first setting card so its
    // hover affordances (edit / view actions) surface — read-only hover.
    await hoverFirstVisible(page, "setting-card");
    await pauseForDemo(1_000);

    // Beat 8: scroll down to the pagination controls so the bottom of the page
    // is toured. (We do NOT click Next/size here — a pure scroll keeps the clip
    // focused; the sibling search demo drives pagination.)
    await scrollToText(page, /rows? per page|page \d+ of \d+|of \d+ row/i);
    await pauseForDemo(1_000);

    // Beat 9: open the "Import CSV" dialog to reveal the bulk-import affordance,
    // hold so its content reads, then Escape — no file chosen, nothing imported.
    const importBtn = page.getByRole("button", { name: /import csv/i }).first();
    if (await importBtn.isVisible().catch(() => false)) {
      await importBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await importBtn.click().catch(() => undefined);
      await pauseForDemo(1_400);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
