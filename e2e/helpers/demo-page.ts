import { expect, type Locator, type Page } from "@playwright/test";

import { pauseForDemo } from "./demo-video";

export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/auth\/signin|\/api\/auth\/signin/);
  await expect(page.getByText("Redirecting to login")).toHaveCount(0);
}

/**
 * Wait out the loading skeleton so the captured video is mostly the LOADED,
 * populated screen rather than the pre-load shimmer.
 *
 * Every `<Skeleton>` carries `data-testid="skeleton"`, so once the page's real
 * content has rendered the skeletons detach. We:
 *   1. wait for the skeletons to go (bounded — a page with none returns fast),
 *   2. hold a short settle beat so the populated screen is on frame, then
 *   3. tour the loaded content (scroll/hover) so it dominates the clip.
 *
 * Call this AFTER the page's ready-testid is visible. It is a no-op outside
 * demo mode (the pauses/tours are gated on PLAYWRIGHT_DEMO).
 */
export async function settleLoaded(
  page: Page,
  opts: { scrollTexts?: Array<string | RegExp>; hoverTestIds?: Array<string | RegExp> } = {},
): Promise<void> {
  await waitOutSkeleton(page);
  for (const text of opts.scrollTexts ?? []) await scrollToText(page, text);
  for (const testId of opts.hoverTestIds ?? []) await hoverFirstVisible(page, testId);
  // A final beat on the loaded content so the clip ends substantive.
  await pauseForDemo(800);
}

/**
 * The skeleton-settle core of {@link settleLoaded}, with no scroll/hover tour.
 *
 * Waits for the loading shimmer (`data-testid="skeleton"`) to detach, then
 * holds one beat on the populated screen so the LOADED content — not the
 * skeleton — is what fills the opening frames of the clip.
 *
 * This is the single high-leverage hook wired into the shared library path
 * (`Library.openIfPopulated`) so every grid-based overview/search demo trims
 * the blank/skeleton lead-in with no per-demo wiring. It is bounded (a page
 * with no skeleton returns fast) and a no-op outside demo mode (the pause is
 * gated on PLAYWRIGHT_DEMO), so it is safe on demos that lack a skeleton.
 */
export async function waitOutSkeleton(page: Page): Promise<void> {
  // Skeletons detach once data lands. Bounded so a skeleton-free page (or one
  // that keeps a lingering shimmer somewhere off-screen) never hangs the clip.
  await page
    .getByTestId("skeleton")
    .first()
    .waitFor({ state: "detached", timeout: 15_000 })
    .catch(() => undefined);
  // Hold on the populated screen so it, not the skeleton, fills the frame.
  await pauseForDemo(1_200);
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

/**
 * Assert the LOADED benchmark eval grid is on screen, scoped to the *visible*
 * instance.
 *
 * `data-testid="benchmark-eval-grid"` is rendered by exactly one live source —
 * the loaded carousel grid in `BenchmarkZone` (the loading skeletons in
 * `benchmark/loading.tsx` carry no such testid, and `BenchmarkZoneSkeleton`,
 * the only other node that ever had it, is transitively dead — its sole
 * renderer is imported nowhere). Statically there is one grid.
 *
 * At runtime, though, the demo recorder occasionally observes a *second*
 * `benchmark-eval-grid` that is `hidden` — a transient stale-tree artifact of
 * Next's dev-mode `force-dynamic` layout (an outgoing route subtree can briefly
 * coexist with the incoming one). A bare `getByTestId(...).toBeVisible()` is a
 * strict locator, so the two matches trip a strict-mode violation ("resolved to
 * 2 elements") before the visibility check even runs.
 *
 * Scoping to `{ visible: true }` makes the assertion target the one grid the
 * user actually sees and ignore any hidden duplicate, so it resolves uniquely
 * regardless of a lingering hidden copy. The component is correct as-is, so the
 * right place for this robustness is the demo locator, not a component change.
 */
export async function expectBenchmarkGridVisible(page: Page): Promise<void> {
  await expect(
    page.getByTestId("benchmark-eval-grid").filter({ visible: true }),
  ).toBeVisible({ timeout: 30_000 });
}

export async function fillSearch(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(testId);
  await expect(input).toBeVisible({ timeout: 30_000 });
  // Type character-by-character (clearing first), mirroring the proven
  // searchDemo / exercise-list path. A bare `fill(value)` sets the DOM value in
  // one shot and fires a single `input` event, but the search box commits via
  // `commitSearch(searchTerm)` — a state closure populated per-keystroke by the
  // box's debounced `onChange`. After a one-shot `fill`, the subsequent Enter's
  // `onKeyDown` can read a STALE `searchTerm`, so the grid never narrows on
  // camera (the WEAK observed live). Per-keystroke typing flushes `setSearchTerm`
  // so Enter commits the full live term and the grid actually narrows.
  await input.click({ timeout: 10_000 }).catch(() => undefined);
  await input.fill("");
  await input.pressSequentially(value, { delay: 40 });
  await input.press("Enter");
  await pauseForDemo(900);
}

export async function openGenerationPanel(page: Page): Promise<void> {
  const instructions = page.getByPlaceholder("Instructions...").first();
  // Robust against a still-loading page / animating panel: retry the toggle a
  // few times, waiting for it to exist before clicking.
  for (let i = 0; i < 3; i++) {
    if (await instructions.isVisible().catch(() => false)) return;
    const toggle = page.getByTestId("toggle-right-panel").first();
    await toggle.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    await toggle.click().catch(() => undefined);
    await pauseForDemo();
  }
  await expect(instructions).toBeVisible({ timeout: 30_000 });
}
