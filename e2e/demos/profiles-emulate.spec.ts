import { test } from "@playwright/test";

import { openLibrary } from "../helpers/artifact-demo";
import { waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "profiles-emulate";

// # coverage: ADMIN-LENS tour of the profiles directory (/management/profiles)
// framed around the EMULATE ("view as user") entry-point. The centerpiece is the
// per-row actions cluster — View Report (Eye), Edit, Delete, and the Emulate
// (Play) button that lets a superadmin step into another user's session. We tour
// the whole page top->bottom: read the toolbar, type a name into the search box
// (narrows the table on camera, then clears), open EACH of the three faceted
// pickers (Role / Permissions / Department) to reveal their option lists
// (open-then-Escape, never committed — no re-query side effect), flip the View
// column-visibility toggle, walk a few profile rows hovering the per-row action
// buttons so the camera reads the Emulate entry-point, then page through
// pagination — ending SETTLED on the populated table.
//
// HARD NON-DESTRUCTIVE RULE: the Emulate button has NO confirm dialog — its
// onClick calls handleEmulate immediately, which swaps the live session/role.
// So we ONLY HOVER it to surface its "Emulate" tooltip and NEVER click it. The
// single-delete dialog (which DOES gate behind a confirm) we open-then-CANCEL to
// show its content without committing. No row link, Edit, View Report, Delete
// confirm, bulk action, or Emulate click is ever invoked.
//
// PAGE-READY GATE: openLibrary navigates, asserts the profiles-toolbar +
// profiles-table visible, and pauses — that is the ONE hard assertion. Every beat
// after it is independently GUARDED (isVisible()/count() bail) so a control the
// page lacks is skipped, never failed. waitOutSkeleton() runs before the first
// beat so no loading shimmer is recorded.

test.describe("demo: profiles emulate", () => {
  test("records the profile action area where admins can emulate users", async ({ page }) => {
    // PAGE-READY GATE — the single hard assertion (toolbar + table visible).
    await openLibrary(page, "/management/profiles", "profiles-toolbar", "profiles-table");

    // Trim any residual skeleton before the first beat so the opening frame is
    // the LOADED, populated directory, never a shimmer.
    await waitOutSkeleton(page);

    // 1) Read the toolbar, then tour the table top->bottom so the camera takes in
    // the populated profiles directory before we exercise any control.
    const toolbar = page.getByTestId("profiles-toolbar").first();
    if (await toolbar.isVisible().catch(() => false)) {
      await toolbar.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }
    const tableWrap = page.getByTestId("profiles-table").first();
    if (await tableWrap.isVisible().catch(() => false)) {
      await tableWrap.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // 2) Search box — type a real query char-by-char so the typing shows and the
    // table narrows on camera, then clear it back to the full directory.
    const search = page.getByTestId("profiles-search").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("admin", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(900);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(600);
    }

    // 3) The three faceted view-filter pickers (Role / Permissions / Department).
    // Open each to reveal its option list, hold so the facet values read on
    // camera, then dismiss with Escape WITHOUT selecting anything — read-only, no
    // committed filter. Each picker is independently guarded.
    for (const title of ["Role", "Permissions", "Department"]) {
      const trigger = page.getByRole("button", { name: new RegExp(`^${title}$`) }).first();
      if (!(await trigger.isVisible().catch(() => false))) continue;
      await trigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await trigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(900);
      const option = page.getByRole("option").first();
      if (await option.isVisible().catch(() => false)) {
        await pauseForDemo(700);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // 4) The View (column-visibility) toggle — open it to reveal the toggleable
    // columns, hold, then Escape closed. No column is actually toggled.
    const viewTrigger = page.getByRole("button", { name: /^View$/ }).first();
    if (await viewTrigger.isVisible().catch(() => false)) {
      await viewTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewTrigger.click({ timeout: 10_000 }).catch(() => undefined);
      await pauseForDemo(800);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // 5) THE EMULATE ENTRY-POINT. Walk the first few rows, hovering each row's
    // per-row action cluster so the camera reads the View Report / Edit / Delete /
    // Emulate buttons. The Emulate (Play) button is the centerpiece — we hover it
    // to surface its "Emulate" tooltip but NEVER click it (a click swaps the live
    // session with no confirm). Every hover is guarded.
    const rows = page.getByTestId("profiles-row");
    const rowCount = await rows.count().catch(() => 0);
    for (let i = 0; i < Math.min(rowCount, 3); i++) {
      const row = rows.nth(i);
      if (!(await row.isVisible().catch(() => false))) continue;
      await row.scrollIntoViewIfNeeded().catch(() => undefined);
      await row.hover().catch(() => undefined);
      await pauseForDemo(600);
      // Surface the row's Emulate ("view as user") button without committing.
      const emulate = row.getByTestId("btn-emulate-profile").first();
      if (await emulate.isVisible().catch(() => false)) {
        await emulate.scrollIntoViewIfNeeded().catch(() => undefined);
        await emulate.hover().catch(() => undefined);
        await pauseForDemo(900);
      }
    }

    // 6) The single-delete confirm dialog — the one row action that DOES gate
    // behind a confirm. Open it to show its content, hold so it reads, then
    // CANCEL (never confirm). Guarded so a row without a delete button is skipped.
    const firstRow = rows.first();
    if (await firstRow.isVisible().catch(() => false)) {
      const del = firstRow.getByTestId("btn-delete-profile").first();
      if (await del.isVisible().catch(() => false)) {
        await del.scrollIntoViewIfNeeded().catch(() => undefined);
        await del.click({ timeout: 10_000 }).catch(() => undefined);
        const dialog = page.getByTestId("dialog-delete-profile").first();
        if (await dialog.isVisible().catch(() => false)) {
          await pauseForDemo(1_000);
          const cancel = page.getByTestId("btn-cancel-delete").first();
          if (await cancel.isVisible().catch(() => false)) {
            await cancel.click().catch(() => undefined);
          } else {
            await page.keyboard.press("Escape").catch(() => undefined);
          }
          await pauseForDemo(600);
        }
      }
    }

    // 7) Pagination — page forward then back so the table re-renders on camera,
    // returning to page 1. Guarded: absent / disabled controls no-op.
    const next = page.getByRole("button", { name: /next/i }).first();
    if (await next.isVisible().catch(() => false) && (await next.isEnabled().catch(() => false))) {
      await next.scrollIntoViewIfNeeded().catch(() => undefined);
      await next.click().catch(() => undefined);
      await pauseForDemo(800);
      const prev = page.getByRole("button", { name: /previous|prev/i }).first();
      if (await prev.isVisible().catch(() => false) && (await prev.isEnabled().catch(() => false))) {
        await prev.click().catch(() => undefined);
        await pauseForDemo(700);
      }
    }

    // Land the clip back on the full, settled directory (not mid-interaction) so
    // the recording ENDS on the populated profiles table with its Emulate column.
    await waitOutSkeleton(page);
    if (await tableWrap.isVisible().catch(() => false)) {
      await tableWrap.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
