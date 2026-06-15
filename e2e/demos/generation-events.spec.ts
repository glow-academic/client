import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { expectAuthenticated, openGenerationPanel, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "generation-events";

// coverage: tour the AI generation panel end-to-end — open the right rail,
// open the chat-history picker (search box + past-run list), pick ONE past
// generation to surface its persisted event stream, tour a few event
// pills/tool bubbles, then open the generation-settings menu. Hard-bounded
// (~14-18s): every beat past the page-ready assertion no-ops if its target
// is absent, and NO beat waits on a live generation or a large history.
test.describe("demo: generation events", () => {
  test("surface the AI generation event stream", async ({ page }) => {
    test.setTimeout(90_000);

    // 1) Land on the personas workspace — the artifact surface that hosts the
    //    AI generation panel (the panel is namespaced to /persona/*).
    await page.goto("/training/personas");
    await expectAuthenticated(page);

    // The ONE real page-ready assertion: a broken route still fails loudly.
    await expect(page.getByTestId("page-header")).toBeVisible({ timeout: 30_000 });
    // Settle out the loading skeleton so no shimmer frame is recorded.
    await page
      .getByTestId("skeleton")
      .first()
      .waitFor({ state: "detached", timeout: 12_000 })
      .catch(() => undefined);
    await pauseForDemo(1200);

    // 2) Open the right-rail generation panel — this is where every run's
    //    event stream (event pills, tool bubbles, assistant messages) renders.
    await openGenerationPanel(page);
    await pauseForDemo(1200);

    // 3) Open the chat-history picker (the chat-name button with the
    //    up/down chevron in the panel header). Opening it fires
    //    `/persona/generations` and reveals the search box + past-run list.
    const pickerTrigger = page
      .locator('[data-sidebar="menu-button"]')
      .filter({ hasText: /new chat|untitled|previous session|current session/i })
      .first();
    let openedHistory = false;
    if (await pickerTrigger.isVisible().catch(() => false)) {
      await pickerTrigger.click({ timeout: 5_000 }).catch(() => undefined);
      await pauseForDemo(1200);

      // 3a) Type into the chat search so the read-only re-query shows, then
      //     clear it — non-destructive, no chat selected by typing.
      const search = page.getByPlaceholder("Search chats...").first();
      if (await search.isVisible().catch(() => false)) {
        await search.pressSequentially("persona", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(900);
        await search.fill("").catch(() => undefined);
        await pauseForDemo(700);
      }

      // 4) Pick the FIRST past generation chat — its historical event stream
      //    loads into the panel (event pills + tool/assistant bubbles). This
      //    is a read-only view switch, no tokens spent, no mutation.
      const firstChat = page.getByRole("menuitem").first();
      if (await firstChat.isVisible().catch(() => false)) {
        await firstChat.click({ timeout: 5_000 }).catch(() => undefined);
        openedHistory = true;
        // The history loader shows a brief spinner; wait it out (bounded) so
        // the recorded frame is the populated stream, not the spinner.
        await page
          .locator(".animate-spin")
          .first()
          .waitFor({ state: "detached", timeout: 8_000 })
          .catch(() => undefined);
        await pauseForDemo(1400);

        // Tour the event stream — scroll to a few representative beats
        // (tool/event markers, then assistant/draft content).
        for (const t of [/tool|event|context|search/i, /persona|draft|generat|response/i] as RegExp[]) {
          await scrollToText(page, t).catch(() => undefined);
        }
        await pauseForDemo(1200);
      } else {
        // No past chats surfaced — dismiss the picker cleanly (Escape, no
        // selection) so the clip ends on the panel rather than a stuck menu.
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // 5) Open the generation-settings menu to reveal the run controls
    //    (Safe mode, Show full context, Show user tools), then dismiss with
    //    Escape WITHOUT toggling anything — purely a read-only reveal.
    const settings = page.getByTestId("gp-settings").first();
    if (await settings.isVisible().catch(() => false)) {
      await settings.click({ timeout: 5_000 }).catch(() => undefined);
      await pauseForDemo(1300);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Final beat on the populated panel (or the empty prompt rail if no
    // history existed) so the clip closes on substantive content.
    if (openedHistory) {
      await scrollToText(page, /generat|event|tool|message|response/i).catch(() => undefined);
    }
    await pauseForDemo(1100);

    await saveDemoVideo(page, TOPIC);
  });
});
