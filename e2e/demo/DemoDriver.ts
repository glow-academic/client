// DemoDriver — human-like pacing primitives.
//
// Layer 1 of the e2e stack: the lowest-level "how a person moves through
// the UI" wrapper. Everything above (Library, ArtifactForm, the domain
// facades) drives the browser through these so a recording feels
// deliberate instead of machine-fast.
//
// Crucially, the pacing is GATED on PLAYWRIGHT_DEMO=1. In correctness
// mode (plain `playwright test`) every `pause()` is a no-op and `type()`
// uses a single `fill()`, so the *same* action code that records a
// polished video also runs as a fast, strict test. One set of flows,
// two speeds.

import { type Locator, type Page } from "@playwright/test";

const DEMO = process.env["PLAYWRIGHT_DEMO"] === "1";

export class DemoDriver {
  constructor(private readonly page: Page) {}

  /** Presentation pause. Only slows the run in demo mode. */
  async pause(ms = 600): Promise<void> {
    if (DEMO) await this.page.waitForTimeout(ms);
  }

  /** Bring a target into view, then settle. */
  async scrollTo(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.pause(300);
  }

  /** Cinematic wheel scroll — for browsing shots, not navigation. */
  async scrollDown(amount = 600): Promise<void> {
    await this.page.mouse.wheel(0, amount);
    await this.pause(300);
  }

  /** Click with the small before/after beats a viewer needs to follow. */
  async click(target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.pause(200);
    await target.click();
    await this.pause(400);
  }

  /**
   * Type into a field. In demo mode this types character-by-character so
   * the text visibly appears; in correctness mode it's a single fast
   * fill(). Either way the field is cleared first.
   */
  async type(target: Locator, text: string): Promise<void> {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    // Bounded actionability: if a draft re-seed detaches the field mid-type,
    // fail in ~15s rather than waiting out the whole test timeout (the retry
    // then re-attempts on a fresh form).
    await target.click({ timeout: 15_000 });
    await target.fill("", { timeout: 15_000 });
    if (DEMO) {
      await target.pressSequentially(text, { delay: 22, timeout: 30_000 });
    } else {
      await target.fill(text, { timeout: 15_000 });
    }
    await this.pause(250);
  }
}
