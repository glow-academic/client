import { test } from "../fixtures";
import { exerciseListView } from "../helpers/exercise-list";
import { waitOutSkeleton } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

// # coverage: MEMBER-LENS tour of the departments library (/platform/departments).
// SISTER to departments-overview/-search, but framed around DEPARTMENT MEMBERSHIP:
// the centerpiece is the per-card "{N} staff" count badge and the two faceted
// pickers that scope a department by WHO is in it — Profile (member-profile
// facet) and Logins (login-activity facet). It walks the grid reading those
// staff-count badges, opens the Profile / Logins / Settings pickers to reveal
// their member-scoping options (open-then-Escape, never committed), types a real
// name into the search box (narrows then clears), flips the card View
// (column-visibility) toggle, and pages through pagination — then ENDS SETTLED on
// the populated grid. There is deliberately NO navigation off the list page (an
// earlier cut visited a department detail page and flashed a loading skeleton at
// the very end; that trailing visit is removed).
//
// PAGE-READY GATE: we drive the `departments` DomainFacade's shared library
// directly. `openIfPopulated()` navigates, waits the toolbar + grid visible, then
// waits the loading skeleton OUT (so the first recorded frame is the LOADED grid,
// never a shimmer) and returns false on an empty library — we test.skip cleanly
// then (no members to tour). That single page-ready gate is the ONE hard
// assertion; EVERY beat after it is independently GUARDED (isVisible()/count()
// bail) so a control or card the page lacks is skipped, never failed.
//
// All NON-DESTRUCTIVE: search types-then-clears, the faceted pickers
// open-then-Escape (no commit), the View toggle flips off->on->closes, and
// pagination returns to page 1 — links / Edit / View / Duplicate / Delete are
// never clicked. One save, under the canonical "departments-members" name.

const GRID_TESTID = "departments-grid";
const CARD_TESTID = "department-card";

test.describe("demo: departments members", () => {
  test("records department member and login-count context", async ({ departments, page }) => {
    // PAGE-READY GATE — navigate + wait the loaded grid (skeleton settled).
    // Skip cleanly when the library is empty (no departments / members to tour).
    test.skip(
      !(await departments.library.openIfPopulated()),
      "departments library is empty (no members to tour)",
    );

    // Trim any residual shimmer before the first beat so no half-loaded frame is
    // recorded.
    await waitOutSkeleton(page);

    // 1) Tour the grid top->bottom: bring the grid into frame, then walk the
    // first few department cards so the camera reads each card's "{N} staff"
    // count badge — the membership lens of this clip. Hover only (never click an
    // Edit/View/Duplicate row control: those navigate off the list or mutate).
    const grid = page.getByTestId(GRID_TESTID).first();
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    const cards = page.getByTestId(CARD_TESTID);
    const cardCount = await cards.count().catch(() => 0);
    for (let i = 0; i < Math.min(cardCount, 3); i++) {
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      await card.scrollIntoViewIfNeeded().catch(() => undefined);
      await card.hover().catch(() => undefined);
      await pauseForDemo(800);
    }

    // 2) The MEMBER-SCOPING faceted pickers (a ThreePickerFilters bar:
    // Profile / Logins / Settings). Profile scopes by member profile and Logins
    // by login activity — the two that answer "who is in this department". Open
    // each picker, hold on its revealed option list so the facet values read on
    // camera, then dismiss with Escape WITHOUT selecting anything (no committed
    // filter, no re-query side effect). Each picker is independently guarded so an
    // absent / empty-option one is skipped cleanly. Logins/Profile lead so the
    // membership facets are what the camera lingers on.
    for (const title of ["Profile", "Logins", "Settings"]) {
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

    // 3) The shared interactive list controls, each step independently guarded
    // inside exerciseListView. We KEEP its generic search (types a selective,
    // card-derived term char-by-char so the grid narrows on camera, then clears),
    // the card View (column-visibility) toggle (off->on->close), pagination
    // (Next -> Prev, returns to page 1) and the page-size selector. We SKIP its
    // generic faceted-filter step because the departments pickers are titled
    // Profile/Logins/Settings — names the shared regex doesn't match — and we
    // exercised them explicitly (member-framed) in beat 2.
    await exerciseListView(page, { skipFilters: true });

    // Land the clip back on the full, settled grid (not mid-interaction, no
    // navigation off the list) so the recording ENDS on the populated departments
    // grid — staff counts and all.
    await waitOutSkeleton(page);
    if (await grid.isVisible().catch(() => false)) {
      await grid.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, "departments-members");
  });
});
