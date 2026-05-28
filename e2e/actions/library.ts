// Library — generic page object for any list/grid surface.
//
// GLOW's library screens are strikingly uniform: every domain renders a
// `{plural}-toolbar`, a `{plural}-search` input, a `{plural}-grid`, and
// row cards with role="gridcell" + aria-label "{singular} card {name}".
// So one parameterized object, driven by a DomainSpec, covers personas,
// rubrics, agents, scenarios, … — no per-domain class needed.

import { expect, type Locator, type Page } from "@playwright/test";

import { DemoDriver } from "../demo/DemoDriver";
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
  private get searchBox(): Locator {
    return this.page.getByTestId(
      this.spec.searchTestId ?? `${this.spec.plural}-search`,
    );
  }

  /** Navigate to the library and wait until the grid is ready. */
  async open(): Promise<void> {
    await this.page.goto(this.spec.listPath);
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
    if (populated) await this.demo.pause();
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
   *  selection toolbar to appear. */
  async openSelected(ids: string[]): Promise<void> {
    await this.page.goto(`${this.spec.listPath}?selectedIds=${ids.join(",")}`);
    await this.bulkDeleteTrigger.waitFor({ state: "visible", timeout: 30_000 });
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
    await this.demo.click(confirm);
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
   *  empty. */
  async firstCardName(): Promise<string | null> {
    const first = this.page
      .getByTestId(this.spec.cardTestId ?? `${this.spec.singular}-card`)
      .first();
    if (!(await first.isVisible().catch(() => false))) return null;
    const label = (await first.getAttribute("aria-label").catch(() => "")) ?? "";
    const m = label.match(new RegExp(`${this.spec.singular}\\s+card\\s+(.+)`, "i"));
    if (m?.[1]) return m[1].trim();
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
