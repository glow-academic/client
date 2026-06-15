import { test } from "@playwright/test";

import {
  expectAuthenticated,
  expectBenchmarkGridVisible,
  hoverFirstVisible,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-test-config";

// # coverage: FOCUS the benchmark TEST CONFIG. Each eval card on /benchmark is
// a pre-configured benchmark test: it carries the test's config context —
// title, description, the runtime/duration stat, and the model-count stat —
// plus the run-mode controls (Start Eval + the Infinite Mode toggle). This
// demo tours that config READ-ONLY: it draws the eye across one card's config
// fields (title -> description -> duration -> models), hovers the Infinite Mode
// toggle to reveal its tooltip (a run-mode CONFIG option) WITHOUT clicking,
// hovers (never clicks) the Start Eval control, then pages the carousel to
// frame the config catalog as a SET and returns it where it was found. It
// NEVER starts/runs/submits a benchmark. Every beat past the one page-ready
// assertion is guarded (no-op if absent) and fully non-destructive.

test.describe("demo: benchmark test config", () => {
  test("tours an eval's test-config context and run-mode options read-only", async ({
    page,
  }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the loaded eval grid is on screen.
    await expectBenchmarkGridVisible(page);

    // Open on the populated grid (skeleton waited out + a settle beat) so no
    // loading shimmer is captured before the config tour begins.
    await settleLoaded(page);

    // ---- Beat 1 — settle on the first eval card: this is the test-config
    // surface. Bring it into view so its config fields fill the frame. ------
    const firstCard = page.getByTestId(/^eval-card-/).first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await firstCard.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // ---- Beat 2 — read the config context fields in order: the eval's
    // title, then its duration/runtime stat, then the model-count stat. Each
    // hover is guarded and no-ops if the field is absent. -------------------
    await hoverFirstVisible(page, "eval-title");
    await pauseForDemo(900);
    await hoverFirstVisible(page, "eval-duration");
    await pauseForDemo(900);
    await hoverFirstVisible(page, "eval-models");
    await pauseForDemo(1_000);

    // ---- Beat 3 — surface the run-mode CONFIG options. Hover the Infinite
    // Mode toggle to reveal its "Infinite Mode" tooltip (a config choice)
    // WITHOUT clicking it — clicking would start a run, which is forbidden. --
    const infiniteToggle = page.getByTestId(/^start-infinite-/).first();
    await hoverLocatorIfVisible(infiniteToggle);
    await pauseForDemo(1_100);

    // ---- Beat 4 — hover (never click) the Start Eval control so the card's
    // primary run action reads on frame as the next step the config feeds. --
    const startBtn = page
      .getByRole("button", { name: /Start Eval/i })
      .first();
    await hoverLocatorIfVisible(startBtn);
    await pauseForDemo(1_000);

    // ---- Beat 5 — surface a second card so the config catalog reads as a SET
    // of pre-configured tests, not a single eval. --------------------------
    const secondCard = page.getByTestId(/^eval-card-/).nth(1);
    if (await secondCard.isVisible().catch(() => false)) {
      await secondCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await secondCard.hover().catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // ---- Beat 6 — page the eval carousel forward to reveal more configured
    // tests (only renders when there are >3 evals), then page back so the
    // catalog is left where it was found. Non-destructive: it only changes
    // which 3 config cards are shown. -------------------------------------
    const carouselIndicator = page.getByText(/^\d+ of \d+$/).first();
    if (await carouselIndicator.isVisible().catch(() => false)) {
      const navButtons = page
        .locator("button")
        .filter({
          has: page.locator(
            "svg.lucide-chevron-right, svg.lucide-chevron-left",
          ),
        });
      const nextBtn = navButtons.nth(1);
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextBtn.click().catch(() => undefined);
        await pauseForDemo(1_200);
        const prevBtn = navButtons.nth(0);
        await prevBtn.click().catch(() => undefined);
        await pauseForDemo(900);
      }
    }

    // ---- Final hold — end framed on the first card's config, leaving the
    // page exactly as found (no run started, no filter committed). ----------
    await scrollToText(page, /eval/i);
    await hoverFirstVisible(page, "eval-title");
    await pauseForDemo(1_200);

    await saveDemoVideo(page, TOPIC);
  });
});
