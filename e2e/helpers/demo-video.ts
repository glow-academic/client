import type { Page } from "@playwright/test";
import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

export async function pauseForDemo(ms = 700): Promise<void> {
  if (process.env["PLAYWRIGHT_DEMO"] === "1") {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Save the active page's recording to ``demo-output/{topic}.webm``.
 *
 * Playwright records VP8 in a WebM container natively; we keep the
 * extension honest rather than transcoding to mp4. WebM plays in every
 * modern browser + embeds directly in the docs site's ``<video>`` tags
 * and GitHub READMEs. For local preview on macOS where QuickTime
 * doesn't handle webm, open in a browser instead:
 *
 *   open -a "Google Chrome" demo-output/{topic}.webm
 */
export async function saveDemoVideo(page: Page, topic: string): Promise<void> {
  if (process.env["PLAYWRIGHT_DEMO"] !== "1") return;

  const video = page.video();
  if (!video) return;

  await page.close();
  const source = await video.path();
  const outputDir = join(process.cwd(), "demo-output");
  await mkdir(outputDir, { recursive: true });
  await copyFile(source, join(outputDir, `${topic}.webm`));
}
