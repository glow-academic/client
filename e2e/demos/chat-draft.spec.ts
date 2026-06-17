// TOPIC: chat-draft
// coverage: a chat you can "Continue" is an IN-PROGRESS (draft) attempt — this
// demo resumes one from the practice history and shows the draft conversation it
// reopens (the persona's framing, the turns so far, the composer awaiting the
// next message). It is deliberately DISTINCT from chat-overview (the practice
// grid / entry point), chat-message (a completed transcript) and chat-grade (the
// rubric scorecard). The prior version sat on the /practice list because the
// "View" link it looked for resolved to a graded scorecard, never a draft chat.
//
// NON-DESTRUCTIVE: "Continue" is a plain <Link href="/attempt/{id}"> — navigation
// only. We tour the reopened draft conversation but never send a message, so no
// run is spent and nothing persists. Every beat past the page-ready assertion is
// guarded; settleLoaded() avoids skeleton frames.

import { expect, type Locator } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-draft";

async function visibleSoon(locator: Locator, timeout = 5_000): Promise<boolean> {
  return locator
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

test.describe("demo: chat draft", () => {
  test("continue an in-progress (draft) chat and tour the reopened conversation", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await settleLoaded(page, { scrollTexts: [/practice|simulation|history/i] });
    await pauseForDemo(900);

    // ---- Beat 1: surface the history — the entry point into a draft chat. ─────
    await scrollToText(page, /history|continue|date|simulation/i).catch(() => undefined);
    await pauseForDemo(1_000);

    // ---- Beat 2: "Continue" reopens an in-progress (draft) attempt. Prefer
    // Continue; fall back to the first View. Both are plain <Link
    // href="/attempt/{id}"> — navigation only, nothing is created. ─────────────
    const continueLink = page.getByRole("link", { name: /^continue$/i }).first();
    const viewLink = page.getByRole("link", { name: /^view$/i }).first();
    const opener = (await visibleSoon(continueLink, 6_000)) ? continueLink : viewLink;
    if (await visibleSoon(opener, 6_000)) {
      await opener.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
      await opener.click().catch(() => undefined);
      // The attempt page opens a live chat socket → networkidle never settles;
      // wait for the chat shell instead of a skeleton frame.
      await page
        .getByText(/type your message|end session|persona|assistant/i)
        .first()
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => undefined);
      await settleLoaded(page);
      await pauseForDemo(1_400);
    }

    // ---- Beat 3: tour the reopened draft conversation — the persona framing and
    // the turns so far. Slow scroll through the thread. ────────────────────────
    await scrollToText(page, /persona|assistant|setting|rubric/i).catch(() => undefined);
    await pauseForDemo(1_000);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 420);
      await pauseForDemo(800);
    }

    // ---- Beat 4: rest on the composer — where the draft is continued (we do NOT
    // type or send; resuming the draft is the whole point). ────────────────────
    await scrollToText(page, /type your message|send|message/i).catch(() => undefined);
    await pauseForDemo(1_400);

    await saveDemoVideo(page, TOPIC);
  });
});
