import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  openGenerationPanel,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-draft";

test.describe("demo: chat draft", () => {
  test("opens an existing attempt's chat and tours the draftable configuration", async ({
    page,
  }) => {
    // ---- Page-ready: the practice grid is the one real assertion. From here
    // we step into an EXISTING attempt (non-destructive — the History "View"
    // link is a plain navigation, it never creates an attempt or spends a run).
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({
      timeout: 30_000,
    });
    await settleLoaded(page, { scrollTexts: [/practice|simulation|start/i] });

    // ---- Beat 1: surface the history, the entry point into an attempt's chat.
    await scrollToText(page, /history|continue|view|score|attempt/i);
    await pauseForDemo(1_300);

    // ---- Beat 2: open an existing attempt's chat (GUARDED — if there is no
    // history row, this is a no-op and we hold on the practice screen instead).
    // "View"/"Continue" are plain <Link href="/attempt/{id}"> buttons, so this
    // navigates into the chat customization surface without mutating anything.
    const openExisting = page
      .getByRole("link", { name: /^(view|continue)$/i })
      .first();
    if (await openExisting.isVisible().catch(() => false)) {
      await openExisting.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      await openExisting.click().catch(() => undefined);
      // The attempt page opens a live chat socket, so networkidle never
      // settles — wait for the customization heading / chat shell to render.
      await page
        .getByText(/customize training|attempt|conversation/i)
        .first()
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => undefined);
      await settleLoaded(page);
    }

    // ---- Beat 3: tour the draftable chat configuration — the personas /
    // documents / scenario selections that a draft captures before a run.
    await scrollToText(page, /persona|document|scenario|department|customize/i);
    await pauseForDemo(1_300);

    // ---- Beat 4: reveal the AI generation panel (its "draft" operation is
    // what saves the in-progress chat configuration). GUARDED via the helper —
    // a no-op if the panel toggle never appears on this surface.
    await openGenerationPanel(page).catch(() => undefined);
    await pauseForDemo(1_300);

    // ---- Beat 5: type a draft instruction into the panel so the viewer sees
    // a draft being composed. We deliberately DO NOT submit (no Generate / no
    // Save) so nothing persists and no run is spent — opening + composing is
    // the whole point of the draft surface. GUARDED on the visible input.
    const instructions = page
      .locator('[placeholder="Instructions..."]:visible')
      .first();
    if (await instructions.isVisible().catch(() => false)) {
      await instructions.click().catch(() => undefined);
      await instructions
        .pressSequentially("Tougher skeptical student persona", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
