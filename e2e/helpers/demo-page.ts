import { expect, type Locator, type Page } from "@playwright/test";

import { pauseForDemo } from "./demo-video";

export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/auth\/signin|\/api\/auth\/signin/);
  await expect(page.getByText("Redirecting to login")).toHaveCount(0);
}

export async function hoverFirstVisible(page: Page, testId: string | RegExp): Promise<void> {
  const target = page.getByTestId(testId).first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded();
    await target.hover();
    await pauseForDemo();
  }
}

export async function hoverLocatorIfVisible(locator: Locator): Promise<void> {
  const target = locator.first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => undefined);
    await target.hover({ timeout: 1_000, force: true }).catch(() => undefined);
    await pauseForDemo();
  }
}

export async function scrollToText(page: Page, text: string | RegExp): Promise<void> {
  const target = page.getByText(text).first();
  if (await target.isVisible().catch(() => false)) {
    await target.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo();
  }
}

export async function fillSearch(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(testId);
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(value);
  await input.press("Enter");
  await pauseForDemo(900);
}

export async function openGenerationPanel(page: Page): Promise<void> {
  const instructions = page.getByPlaceholder("Instructions...");
  if (!(await instructions.isVisible().catch(() => false))) {
    const toggle = page.getByTestId("toggle-right-panel");
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await pauseForDemo();
    }
  }
  await expect(instructions).toBeVisible({ timeout: 30_000 });
}
