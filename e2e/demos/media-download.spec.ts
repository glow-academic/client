// TOPIC: media-download
// coverage: opens a document from the library and tours its detail — the file
// rows + export/download affordances (the named feature). The prior version
// only hovered a row on the list and scrolled (a static ~2.8s clip that never
// showed a download action). Documents exist on-instance (files=8), so this is a
// navigation/richness fix, not a data gap.
//
// NON-DESTRUCTIVE: open + hover the export/download controls (never click a
// destructive action); every beat past openLibrary is guarded so it no-ops when
// the affordance is absent. settleLoaded after navigation avoids skeleton frames.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { openLibrary } from "../helpers/artifact-demo";
import {
  hoverFirstVisible,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "media-download";

async function visibleSoon(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: media download", () => {
  test("open a document and tour its files + export/download affordances", async ({ page }) => {
    test.setTimeout(120_000);

    await openLibrary(page, "/management/documents", "documents-toolbar", "documents-table");
    await settleLoaded(page);

    // Read the list, then OPEN the first document into its detail (where the
    // file rows + export/download controls live).
    await hoverFirstVisible(page, "documents-row");
    await pauseForDemo(700);

    const firstRow = page.locator('[data-testid^="documents-row"]').first();
    if (await visibleSoon(firstRow)) {
      await firstRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstRow.click({ timeout: 8_000 }).catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(900);
    }

    // Tour the document detail — file rows + export/download/preview affordances.
    for (const text of [/file|attachment/i, /download|export/i, /preview|view/i, /text|content/i]) {
      await scrollToText(page, text).catch(() => undefined);
    }
    // Hover the download/export control so it reads (NO click — avoid triggering
    // a file download mid-clip; the affordance is the point).
    for (const name of [/download/i, /export/i]) {
      const ctrl = page.getByRole("button", { name }).first();
      if (await visibleSoon(ctrl, 2_500)) await hoverLocatorIfVisible(ctrl);
    }
    await pauseForDemo(900);

    await saveDemoVideo(page, TOPIC);
  });
});
