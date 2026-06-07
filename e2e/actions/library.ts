// Library — generic page object for any list/grid surface.
//
// GLOW's library screens are strikingly uniform: every domain renders a
// `{plural}-toolbar`, a `{plural}-search` input, a `{plural}-grid`, and
// row cards with role="gridcell" + aria-label "{singular} card {name}".
// So one parameterized object, driven by a DomainSpec, covers personas,
// rubrics, agents, scenarios, … — no per-domain class needed.

import { expect, type Locator, type Page } from "@playwright/test";

import { DemoDriver } from "../demo/DemoDriver";
import { waitOutSkeleton } from "../helpers/demo-page";
import type { DomainSpec } from "./domains";

export class Library {
  constructor(
    private readonly page: Page,
    private readonly demo: DemoDriver,
    private readonly spec: DomainSpec,
  ) {}

  private get toolbar(): Locator {
    return this.page.getByTestId(`${this.spec.plural}-toolbar`);
  }
  // Card grids use `{plural}-grid`; table surfaces (documents, profiles) use
  // `{plural}-table`. The DomainSpec can override.
  private get grid(): Locator {
    return this.page.getByTestId(
      this.spec.gridTestId ?? `${this.spec.plural}-grid`,
    );
  }
  /** Whether this library renders as a table (documents, profiles) rather than
   *  a card grid — keyed off the established `{plural}-table` gridTestId
   *  convention. Rows here are multi-cell, so name derivation differs. */
  private get isTable(): boolean {
    return (this.spec.gridTestId ?? "").endsWith("-table");
  }
  private get searchBox(): Locator {
    return this.page.getByTestId(
      this.spec.searchTestId ?? `${this.spec.plural}-search`,
    );
  }

  /** Navigate to a library URL while bypassing the backend's Redis list
   *  cache, then restore the default headers.
   *
   *  WHY: the list pages SSR-fetch ``/{artifact}/search`` and only forward
   *  ``X-Bypass-Cache: 1`` when the request looks like a *hard* refresh — they
   *  read ``Cache-Control: no-cache`` off the incoming request headers
   *  (``lib/cache-utils.ts``'s ``isHardRefresh``). A plain ``page.goto`` is a
   *  SOFT navigation, so the SSR serves whatever the Redis list cache holds —
   *  which, right after a create / factory-seed / bulk mutation, is STALE: it
   *  predates the new/changed rows. That's the recurring demo failure:
   *    - fields-create: the created field is in the DB but absent from the
   *      cached ``/field/search`` the page SSRs, so the client-side search
   *      filter (a tanstack column filter over the SSR set) matches 0 →
   *      ``expectVisible`` times out.
   *    - tools-bulk: the two factory-seeded rows aren't in the cached
   *      ``/tool/search`` page, so they never load into the table → the
   *      ``?selectedIds=`` selection resolves to 0 deletable loaded rows →
   *      the "Delete N" trigger stays disabled.
   *  Sending ``Cache-Control: no-cache`` on the navigation makes the SSR treat
   *  it as a hard refresh and forward ``X-Bypass-Cache: 1``, so the backend
   *  reads through to a fresh list that includes the just-mutated rows. This is
   *  exactly what a real user's browser hard-reload (or the page's "Refresh"
   *  toolbar button) sends — so the demo settles on the same authoritative path
   *  rather than papering over the cache with a sleep. */
  private async gotoFresh(url: string, opts: { keepHeader?: boolean } = {}): Promise<void> {
    await this.page.setExtraHTTPHeaders({ "Cache-Control": "no-cache" });
    try {
      await this.page.goto(url);
    } finally {
      // Restore defaults so only THIS navigation bypasses the cache — later
      // soft navs / XHRs keep their normal cache behavior.
      //
      // EXCEPT when `keepHeader` is set (openUntilVisible's create-verify
      // path): the bypass MUST stay active across the subsequent box-search
      // XHR, not just the navigation. Otherwise the box's debounced
      // `/{artifact}/search` refetch reads the STALE Redis list cache — the
      // same cache that predates the just-created row — and the row never
      // surfaces. The caller restores defaults itself once the row is found.
      if (!opts.keepHeader) await this.page.setExtraHTTPHeaders({});
    }
  }

  /** Build a list URL that pins a single row by NAME via the page's server
   *  ``?search=`` param, optionally with extra query (e.g. ``selectedIds``).
   *
   *  WHY this is the real fix (over a cache-bypass alone): the list pages that
   *  thread search server-side (tools, and every page whose nuqs loader has a
   *  ``search`` key) default to ``page_size: 12``, name-ascending. A freshly
   *  created/seeded row carries a run-scoped probe name (``… {runId}``,
   *  ``Bulk … {runId}``) that sorts to the ALPHABETICAL TAIL — so it lands off
   *  page 1 and never appears, no matter how fresh the cache is. A
   *  name-filtered server query collapses the list to (essentially) just that
   *  row, so it's on page 1 regardless of total count or sort order. This is
   *  order- AND page-independent, which a bare ``listPath`` nav is not.
   *
   *  Pages that DON'T thread search server-side (fields — SSR body is
   *  ``page_size: null``, i.e. ALL rows, and search is a client-side tanstack
   *  column filter) simply ignore the unknown ``search`` param: they already
   *  load the full set, so the row is present and the on-camera ``search()``
   *  client-filters onto it. So one URL shape is correct for both architectures
   *  — server-paginated and load-everything. Combined with ``gotoFresh`` the
   *  query also reads through the stale Redis list cache, so neither the cache
   *  nor the page boundary can hide the row. */
  private searchUrl(name: string, extra?: string): string {
    const params = new URLSearchParams({ search: name });
    const qs = extra ? `${params.toString()}&${extra}` : params.toString();
    return `${this.spec.listPath}?${qs}`;
  }

  /** Navigate to the library and wait until the grid is ready.
   *
   *  Cache-bypassing on purpose: ``open()`` is the post-mutation re-entry point
   *  (createDemo opens here after a create; bulkDeleteDemo after a delete), so
   *  it must read through the stale Redis list cache to surface the just-
   *  mutated rows. See ``gotoFresh`` for the full rationale. */
  async open(): Promise<void> {
    await this.gotoFresh(this.spec.listPath);
    await expect(this.toolbar).toBeVisible({ timeout: 30_000 });
    await expect(this.grid).toBeVisible({ timeout: 30_000 });
    await this.demo.pause();
  }

  /** Navigate and report whether the grid rendered — i.e. the library has
   *  data. An empty library shows a "No {plural} found" state instead of the
   *  grid, so read-only browse/search demos use this to skip cleanly rather
   *  than fail `open()`'s grid assertion. (Create specs keep `open()`, which is
   *  strict because the just-created row guarantees the grid.) */
  async openIfPopulated(): Promise<boolean> {
    await this.page.goto(this.spec.listPath);
    await this.toolbar
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => undefined);
    const populated = await this.grid
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (populated) {
      // Central lead-in trim: the grid renders before its card data fully
      // lands, so the opening frames are still shimmer. Wait the skeleton out
      // (bounded, demo-mode-only) so the LOADED grid — not the blank/skeleton
      // frame — dominates every overview/search clip routed through here.
      await waitOutSkeleton(this.page);
      await this.demo.pause();
    }
    return populated;
  }

  /** Type a query and commit it (Enter), then let the grid settle. */
  async search(query: string): Promise<void> {
    await this.demo.type(this.searchBox, query);
    await this.searchBox.press("Enter");
    await this.demo.pause(800);
  }

  /** A row located by its testid + visible name. Card grids use
   *  `{singular}-card`; table surfaces use `{plural}-row` (DomainSpec
   *  overrides via cardTestId). Run-scoped unique names keep hasText to one. */
  card(name: string): Locator {
    return this.page
      .getByTestId(this.spec.cardTestId ?? `${this.spec.singular}-card`)
      .filter({ hasText: name });
  }

  async expectVisible(name: string): Promise<void> {
    await expect(this.card(name)).toBeVisible({ timeout: 30_000 });
    await this.demo.scrollTo(this.card(name));
  }

  /** Settle the list onto a just-created row by NAME, order- and
   *  page-independently — by DRIVING THE SEARCH BOX, not the URL.
   *
   *  WHY the box and not ``?search=`` (the prior approach): the list pages split
   *  into two architectures for search, and only the box honors BOTH:
   *    - tools (and every server-threaded list) page at 12 name-ascending, so a
   *      run-scoped probe name (``… {runId}``) sorts to the alphabetical tail and
   *      lands off page 1. Its search box debounces a fresh ``/tool/search`` with
   *      the typed term, collapsing the page to the matching row.
   *    - fields is a load-everything SSR (``page_size: null``) whose search is a
   *      CLIENT-SIDE tanstack column filter — and its Next route IGNORES the
   *      ``?search=`` URL param entirely (it only reads ``groupId``). So a
   *      ``?search=`` nav lands on the unfiltered alphabetical head (12 of 68)
   *      and the tail row never shows. But TYPING into the box runs the client
   *      filter over the full SSR set and surfaces the row. This is exactly the
   *      proven ``search()`` path that fields-search passes with.
   *  So we open the bare (cache-fresh) library, then drive the box with the
   *  exact name — the one mechanism correct for server-threaded AND client-
   *  filtered lists alike.
   *
   *  ``gotoFresh(listPath)`` keeps cache-freshness: the post-create open must
   *  read through the stale Redis list cache that predates the new row (see
   *  ``gotoFresh``). For fields that means the full SSR set already contains the
   *  row for the client filter to find; for tools the box's own refetch is fresh.
   *
   *  A single open+search can still miss the row when the create commit and the
   *  read race (brief eventual consistency between the write and when
   *  ``/{artifact}/search`` returns it). So re-open + re-search until the row
   *  appears, bounded by ``toPass`` — the create-side mirror of openSelected's
   *  "wait for the real signal" discipline: the signal here is the row landing
   *  in the searched list, not a fixed delay. */
  async openUntilVisible(name: string): Promise<void> {
    // Keep the `Cache-Control: no-cache` bypass active across BOTH the
    // navigation AND the box-search refetch below (`keepHeader: true`). The
    // box's debounced `/{artifact}/search` is a fresh network read for a
    // server-threaded list (tools); if it carried default headers it would hit
    // the stale Redis list cache that predates the just-created row, and the
    // row would never surface — exactly the create-verify failure observed live
    // (the prior code restored defaults in gotoFresh BEFORE this refetch ran).
    // The header is restored in `finally` once the row is found (or we give up).
    try {
      await expect(async () => {
        await this.gotoFresh(this.spec.listPath, { keepHeader: true });
        await expect(this.toolbar).toBeVisible({ timeout: 15_000 });
        // Drive the box the same way the on-camera search() does (clear → type →
        // Enter), so a server-threaded list refetches with the term and a
        // client-filtered list (fields) filters its full SSR set onto the row.
        // This refetch runs UNDER the bypass header above, so it reads fresh.
        await this.demo.type(this.searchBox, name);
        await this.searchBox.press("Enter");
        await expect(this.card(name)).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 45_000, intervals: [1_000, 2_000, 5_000] });
    } finally {
      // Restore default headers so the on-camera search() + later soft navs
      // keep normal cache behavior (mirrors gotoFresh's default-path restore).
      // Does NOT regress tools-bulk: openSelected uses gotoFresh's default path
      // and is untouched.
      await this.page.setExtraHTTPHeaders({});
    }
    await this.demo.pause();
  }

  /** Whether a page-toolbar action button (by accessible name) is present. */
  async hasToolbarButton(name: string): Promise<boolean> {
    return this.page
      .getByRole("button", { name })
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** Export the library to CSV via the page toolbar's "Download CSV" — POST
   *  /{artifact}/export → file_id → a native browser download. Captures the
   *  download event to confirm the file came through. */
  async exportCsv(): Promise<void> {
    const btn = this.page.getByRole("button", { name: "Download CSV" }).first();
    await this.demo.scrollTo(btn);
    const [download] = await Promise.all([
      this.page.waitForEvent("download", { timeout: 30_000 }),
      this.demo.click(btn),
    ]);
    await download.path(); // resolves once the file is fully written
    await this.demo.pause();
  }

  /** Refresh the library via the page toolbar's "Refresh" (POST
   *  /{artifact}/refresh — server cache refresh), then let it settle. */
  async refresh(): Promise<void> {
    await this.demo.click(this.page.getByRole("button", { name: "Refresh" }).first());
    await this.demo.pause(1200);
  }

  /** Duplicate a single row via its card's "Duplicate" action (no confirm) and
   *  wait for the success toast. The backend mints the copy. */
  async duplicate(name: string): Promise<void> {
    const btn = this.card(name).getByTestId(`btn-duplicate-${this.spec.singular}`);
    // Fail fast if the row/button isn't surfaced (loaded-row lag) rather than
    // waiting out the click timeout.
    await btn.waitFor({ state: "visible", timeout: 8_000 });
    await this.demo.scrollTo(btn);
    await this.demo.click(btn);
    await expect(this.page.getByText(/duplicated/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await this.demo.pause(800);
  }

  /** The selection toolbar's "Delete {N}" trigger — present only when rows are
   *  selected (the toolbar swaps from filter-bar to selection-bar). */
  private get bulkDeleteTrigger(): Locator {
    return this.toolbar.getByRole("button", { name: /^Delete \d+/ });
  }

  /** Open the library with rows pre-selected via the `?selectedIds=` URL param
   *  — deterministic bulk selection, no checkbox-clicking — and wait for the
   *  selection toolbar to appear.
   *
   *  ``nameFilter`` (the shared name stem of the seeded rows) is threaded into
   *  the server ``?search=`` so the seeded rows are pulled onto page 1. WHY:
   *  the "Delete N" trigger is ``deletable = selected.filter(can_delete)`` over
   *  the LOADED rows only — on a server-paginated page (tools, page_size 12)
   *  the run-scoped seed names sort to the alphabetical tail, land off page 1,
   *  and so are selected-but-not-loaded → 0 deletable → trigger stays disabled
   *  ("Delete 0 of N"). A name-filtered query collapses the page to the seeded
   *  rows so they're loaded AND selected. Load-everything pages (fields) ignore
   *  the param and already have every row loaded. ``gotoFresh`` additionally
   *  reads through the stale Redis cache that predates the just-seeded rows. */
  async openSelected(ids: string[], nameFilter?: string): Promise<void> {
    const extra = `selectedIds=${ids.join(",")}`;
    await this.gotoFresh(
      nameFilter
        ? this.searchUrl(nameFilter, extra)
        : `${this.spec.listPath}?${extra}`,
    );
    await this.bulkDeleteTrigger.waitFor({ state: "visible", timeout: 30_000 });
    // Settle on the REAL signal, not a sleep: the seeded rows must be both
    // loaded into the table AND resolved as selected before the "Delete N"
    // trigger reports them deletable. The trigger reads "Delete N of M" and is
    // disabled at 0 deletable; wait until it's enabled so the subsequent
    // bulkDelete() acts on a settled selection rather than racing the load.
    await expect(this.bulkDeleteTrigger).toBeEnabled({ timeout: 30_000 });
    await this.demo.pause();
  }

  /** Bulk-delete the selected rows: click the toolbar "Delete N" trigger, then
   *  confirm in the shared BulkDeleteDialog. */
  async bulkDelete(): Promise<void> {
    // The trigger reads "Delete N of M" and is disabled when 0 are deletable —
    // e.g. when the just-seeded rows aren't in the library's loaded set yet
    // (a fields-style refetch lag). Fail fast instead of waiting out the click.
    await expect(this.bulkDeleteTrigger).toBeEnabled({ timeout: 10_000 });
    await this.demo.click(this.bulkDeleteTrigger);
    const confirm = this.page.getByTestId("btn-confirm-bulk-delete");
    await expect(confirm).toBeVisible({ timeout: 15_000 });
    // The confirm handler fires `{singular}/delete` then `router.refresh()`,
    // but neither is awaited by the click — so a caller that navigates right
    // after (the bulk-delete demo's `open()` → goto) would abort the in-flight
    // DELETE before it commits, leaving the "deleted" rows still present on the
    // re-fetched list. Wait for the delete POST to come back 2xx *before*
    // returning so the mutation has actually persisted. Bounded; falls through
    // on a domain whose delete endpoint we don't know.
    const deletePath = this.spec.api.delete;
    const [resp] = await Promise.all([
      deletePath
        ? this.page
            .waitForResponse(
              (r) => r.url().includes(deletePath) && r.request().method() === "POST",
              { timeout: 30_000 },
            )
            .catch(() => null)
        : Promise.resolve(null),
      this.demo.click(confirm),
    ]);
    if (resp) {
      expect(
        resp.ok(),
        `bulk delete POST ${deletePath} returned ${resp.status()}`,
      ).toBeTruthy();
    }
    await this.demo.pause(800);
  }

  /** Import rows from a CSV via the shared BulkImport dialog: open it, upload
   *  the file into the dropzone's hidden input (→ server parse → review table),
   *  confirm the import, and close on the results step. */
  async bulkImport(csvPath: string): Promise<void> {
    await this.demo.click(
      this.page.getByRole("button", { name: /import csv/i }).first(),
    );
    const dialog = this.page.getByTestId("dialog-bulk-import");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // react-dropzone renders a hidden <input type=file>; setInputFiles drives it
    // without the native dialog, triggering parse → review stage.
    await dialog.locator('input[type="file"]').first().setInputFiles(csvPath);
    const confirm = this.page.getByTestId("btn-confirm-import");
    await expect(confirm).toBeVisible({ timeout: 30_000 });
    await this.demo.click(confirm);
    const done = this.page.getByRole("button", { name: /^Done$/ });
    await expect(done).toBeVisible({ timeout: 30_000 });
    await this.demo.click(done);
    await this.demo.pause();
  }

  /** The selection toolbar's "Edit {N}" trigger. */
  private get bulkEditTrigger(): Locator {
    return this.toolbar.getByRole("button", { name: /^Edit \d+/ });
  }

  /** Bulk-edit the selected rows: open the shared BulkEditDialog, toggle the
   *  first flag row (Active Status — tri-state, so toggling registers a change
   *  and enables Apply), then Apply. The dialog closing confirms it applied. */
  async bulkEdit(): Promise<void> {
    await expect(this.bulkEditTrigger).toBeEnabled({ timeout: 10_000 });
    await this.demo.click(this.bulkEditTrigger);
    const dialog = this.page.getByTestId("dialog-bulk-edit");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // BulkEditFlagField is tri-state: at "no change" it shows "Set {label}"
    // buttons (the Switch only appears once a value is chosen). Click the first
    // "Set …" button (Active) to register a change so Apply enables. Bounded so
    // a dialog without a flag field fails fast.
    const setFlag = dialog.getByRole("button", { name: /^Set / }).first();
    await setFlag.waitFor({ state: "visible", timeout: 8_000 });
    await this.demo.click(setFlag);
    await this.demo.click(this.page.getByTestId("btn-apply-bulk-edit"));
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await this.demo.pause();
  }

  /** Whether this library exposes a free-text search box. Most do; a few
   *  (auth) ship only picker filters, so a search demo skips them. */
  async hasSearch(): Promise<boolean> {
    return this.searchBox
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** The first card's display name — read from its aria-label
   *  ("{singular} card {name}") or, failing that, its text. Lets a search demo
   *  query real data instead of a hard-coded term. Null when the grid is
   *  empty.
   *
   *  Table surfaces (documents, profiles — `gridTestId` ends `-table`) have no
   *  per-card aria-label and a row is many cells (name + email + dept + …), so
   *  scraping the whole row's textContent concatenates them into one space-less
   *  blob (e.g. an email run into the name) that matches nothing. Both tables
   *  render the name in a `.font-medium` cell, distinct from the muted
   *  secondary text — read that cell so the derived term is one real name. */
  async firstCardName(): Promise<string | null> {
    const first = this.page
      .getByTestId(this.spec.cardTestId ?? `${this.spec.singular}-card`)
      .first();
    if (!(await first.isVisible().catch(() => false))) return null;
    const label = (await first.getAttribute("aria-label").catch(() => "")) ?? "";
    const m = label.match(new RegExp(`${this.spec.singular}\\s+card\\s+(.+)`, "i"));
    if (m?.[1]) return m[1].trim();
    if (this.isTable) {
      const nameCell = first.locator(".font-medium").first();
      const cellText = (await nameCell.textContent().catch(() => "")) ?? "";
      const name = cellText.trim().split(/\s+/).slice(0, 3).join(" ");
      if (name) return name;
    }
    const text = (await first.textContent().catch(() => "")) ?? "";
    return text.trim().split(/\s+/).slice(0, 3).join(" ") || null;
  }

  /** Cinematic browse for an overview demo: a few scrolls down through the
   *  populated grid, then back toward the top. Read-only. */
  async browse(): Promise<void> {
    await this.demo.pause();
    for (let i = 0; i < 3; i++) await this.demo.scrollDown(450);
    await this.demo.scrollDown(-1400); // ease back toward the top
    await this.demo.pause();
  }
}
