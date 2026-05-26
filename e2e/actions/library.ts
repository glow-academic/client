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
