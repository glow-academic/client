import { test } from "@playwright/test";
import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// coverage: tours the LEFT SIDEBAR navigation on /home — hovers each nav
// section, opens the profile/theme dropdown (open-then-Escape), exercises the
// sidebar search filter (type → react → clear), and collapses/re-expands a
// collapsible nav group. Read-only: hover/expand/search only; never navigates
// away and never mutates. Every beat past the single page-ready assertion
// no-ops if its target is absent.

test.describe("demo: index sidebar", () => {
  test("the left-nav mapping to the running UI", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    // Single page-ready assertion: the sidebar shell is mounted. Everything
    // after this is guarded.
    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await sidebar.waitFor({ state: "visible", timeout: 30_000 });
    await settleLoaded(page);

    // 1) Profile / user menu at the top of the sidebar: hover, open the
    // dropdown so the theme options + logout read, then Escape (non-destructive).
    const profileBtn = page
      .locator('[data-sidebar="header"] [data-sidebar="menu-button"]')
      .first();
    if (await profileBtn.isVisible().catch(() => false)) {
      await profileBtn.hover().catch(() => undefined);
      await pauseForDemo(700);
      await profileBtn.click().catch(() => undefined);
      await pauseForDemo(1_200);
      // The open menu surfaces Light / Dark / System + Logout. Hold so it reads.
      const themeItem = page.getByRole("menuitem", { name: /Light|Dark|System/i }).first();
      if (await themeItem.isVisible().catch(() => false)) {
        await themeItem.hover().catch(() => undefined);
        await pauseForDemo(900);
      }
      // Dismiss WITHOUT committing a theme change or logout.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // 2) Hover the full nav hierarchy top→bottom so each section reads. These
    // are the section labels/triggers rendered by getSidebarSectionsFromPermissions.
    const NAV_LABELS = [
      /^Home$/i,
      /^Practice$/i,
      /^Leaderboard$/i,
      /^Analytics$/i,
      /^Training$/i,
      /^Management$/i,
      /^Intelligence$/i,
      /^Platform$/i,
      /^Health$/i,
      /^Benchmark$/i,
      /^Settings$/i,
    ];
    for (const label of NAV_LABELS) {
      const navItem = sidebar.getByText(label).first();
      if (await navItem.isVisible().catch(() => false)) {
        await navItem.scrollIntoViewIfNeeded().catch(() => undefined);
        await navItem.hover().catch(() => undefined);
        await pauseForDemo(650);
      }
    }

    // 3) Sidebar search: type so the nav list filters live, hold, then clear so
    // the full hierarchy returns (read-only — filtering only re-renders the nav).
    const search = page.locator('[data-sidebar="input"]').first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("train", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_100);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(800);
    }

    // 4) Collapsible nav group: collapse then re-expand a group (Analytics/
    // Training/etc.) via its trigger so the expand/collapse affordance + the
    // sub-item hierarchy both show. We restore it to open (no net change).
    const COLLAPSIBLE_LABELS = [/^Analytics$/i, /^Training$/i, /^Intelligence$/i, /^Platform$/i];
    for (const label of COLLAPSIBLE_LABELS) {
      const trigger = sidebar
        .locator('[data-sidebar="group-label"]')
        .filter({ hasText: label })
        .first();
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
        await trigger.hover().catch(() => undefined);
        await pauseForDemo(500);
        // Collapse — chevron rotates, sub-items hide.
        await trigger.click().catch(() => undefined);
        await pauseForDemo(900);
        // Re-expand — sub-items slide back in. Restores the default-open state.
        await trigger.click().catch(() => undefined);
        await pauseForDemo(1_000);
        break;
      }
    }

    // 5) Footer affordance: hover the Report Problem button so the full
    // top→bottom sweep of the sidebar is on frame (open-then-Escape, no submit).
    const reportBtn = page.getByRole("button", { name: /Report Problem/i }).first();
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.scrollIntoViewIfNeeded().catch(() => undefined);
      await reportBtn.hover().catch(() => undefined);
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, "index-sidebar");
  });
});
