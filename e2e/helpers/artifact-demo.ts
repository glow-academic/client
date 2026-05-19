import { expect, type Page } from "@playwright/test";

import { expectAuthenticated, fillSearch, hoverFirstVisible, scrollToText } from "./demo-page";
import { pauseForDemo } from "./demo-video";

export async function openLibrary(page: Page, path: string, toolbar: string, surface: string): Promise<void> {
  await page.goto(path);
  await expectAuthenticated(page);
  await expect(page.getByTestId(toolbar)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(surface)).toBeVisible();
  await pauseForDemo();
}

export async function openArtifactForm(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expectAuthenticated(page);
  await expect(page.getByTestId("artifact-form")).toBeVisible({ timeout: 30_000 });
  await pauseForDemo();
}

export async function showFormStep(page: Page, stepId: string): Promise<void> {
  const step = page.getByTestId(`artifact-form-step-${stepId}`);
  await expect(step).toBeVisible({ timeout: 30_000 });
  await step.scrollIntoViewIfNeeded();
  await pauseForDemo();
}

export async function recordSearchControls(
  page: Page,
  options: { path: string; toolbar: string; surface: string; search: string; query: string; card?: string | RegExp },
): Promise<void> {
  await openLibrary(page, options.path, options.toolbar, options.surface);
  await fillSearch(page, options.search, options.query);
  await scrollToText(page, /filter|department|scenario|persona|voice|rubric|cohort/i);
  if (options.card) await hoverFirstVisible(page, options.card);
}

export async function recordBulkAffordances(
  page: Page,
  options: { path: string; toolbar: string; surface: string; card?: string | RegExp },
): Promise<void> {
  await openLibrary(page, options.path, options.toolbar, options.surface);
  if (options.card) await hoverFirstVisible(page, options.card);
  await scrollToText(page, /select|bulk|delete|edit|matching/i);
}
