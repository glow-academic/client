// TOPIC: media-upload
// coverage: tours the document upload surface — the create-document form's
// "uploads" step, which carries the drag-&-drop dropzone (with the supported
// file types) and the picker for attaching existing files. The prior version
// landed on the uploads step but sat on a static, empty dropzone with no
// interaction, so the clip never demonstrated the attachment controls.
//
// NON-DESTRUCTIVE: we hover the dropzone (never click it — clicking opens the OS
// file chooser, which hangs the recorder) and open/close the existing-files
// picker without selecting anything. No file is uploaded and nothing is saved.
// Every beat past the page-ready assertion is guarded.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { openArtifactForm, showFormStep } from "../helpers/artifact-demo";
import { scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "media-upload";

async function visibleSoon(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: media upload", () => {
  test("tour the document upload step — dropzone + attach-existing controls", async ({ page }) => {
    test.setTimeout(120_000);

    await openArtifactForm(page, "/management/documents/new");
    await settleLoaded(page);

    // ---- Beat 1: brief tour of what a document captures before the upload. ────
    for (const text of [/description/i, /department/i, /flag/i]) {
      await scrollToText(page, text).catch(() => undefined);
      await pauseForDemo(500);
    }

    // ---- Beat 2: the uploads step — the named feature. ───────────────────────
    await showFormStep(page, "uploads");
    await pauseForDemo(900);

    // ---- Beat 3: the drag-&-drop dropzone. Hover it (border highlights) and
    // surface the supported file types — but NEVER click (a click opens the OS
    // file chooser and hangs the recorder). ────────────────────────────────────
    const dropzone = page.getByText(/drag & drop files here|click to select/i).first();
    if (await visibleSoon(dropzone, 6_000)) {
      await dropzone.scrollIntoViewIfNeeded().catch(() => undefined);
      await dropzone.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }
    await scrollToText(page, /PDF, Images, Word|supported|ZIP/i).catch(() => undefined);
    await pauseForDemo(900);

    // ---- Beat 4: the attach-existing-files picker — open it, search, close.
    // The instance already has files, so the picker reads as populated. ─────────
    const picker = page.getByRole("button", { name: /select files|attach|choose file/i }).first();
    if (await visibleSoon(picker, 4_000)) {
      await picker.scrollIntoViewIfNeeded().catch(() => undefined);
      await picker.click().catch(() => undefined);
      await pauseForDemo(1_000);
      const search = page.getByPlaceholder(/search/i).first();
      if (await visibleSoon(search, 3_000)) {
        await search.click().catch(() => undefined);
        await search.pressSequentially("FERPA", { delay: 60 }).catch(() => undefined);
        await pauseForDemo(1_100);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
