import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible } from "./demo-page";
import { pauseForDemo, saveDemoVideo } from "./demo-video";

export interface DemoSpecConfig {
  topic: string;
  path: string;
  readyTestIds?: string[];
  hoverTestIds?: Array<string | RegExp>;
}

export function defineDemoSpec(config: DemoSpecConfig): void {
  test.describe(`demo: ${config.topic}`, () => {
    test(`records ${config.topic}`, async ({ page }) => {
      await page.goto(config.path);
      await expectAuthenticated(page);

      if (config.readyTestIds?.length) {
        for (const testId of config.readyTestIds) {
          await expect(page.getByTestId(testId)).toBeVisible({ timeout: 30_000 });
        }
      } else {
        await expect(page.locator("body")).toBeVisible({ timeout: 30_000 });
      }

      await pauseForDemo();

      for (const testId of config.hoverTestIds ?? []) {
        await hoverFirstVisible(page, testId);
      }

      await saveDemoVideo(page, config.topic);
    });
  });
}
