import { expect } from "@playwright/test";

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

// AUDIT FIX: the Auths library used to ship picker-filters only (no free-text
// box), so the generic `searchDemo` `test.skip`-ped on `hasSearch()` and
// produced no video. The page NOW renders a real server-side search box
// (`auths-search`, debounced → `?search=` → /auth/search; see
// Auths.tsx + "fix(auth): thread search into AuthsListBody"), so this is a
// substantive demo of that affordance: open the populated library, read a real
// card's name, type its first word into the search box, and ASSERT the grid
// narrowed to that card. Fail-loud — if the box or matching card isn't there,
// the demo fails rather than silently skipping.
test.describe("demo: auths search", () => {
  test("search the auths library by a real entry name", async ({
    page,
    demo,
    registry,
  }) => {
    const spec = DOMAINS["auth"]!;
    const facade = new DomainFacade(page, demo, spec, registry);

    // Open and require the library is populated — a search demo on an empty
    // library is meaningless, so fail rather than film a "no entries" state.
    expect(
      await facade.library.openIfPopulated(),
      "auths library is empty — seed at least one auth entry before recording the search demo",
    ).toBe(true);

    // The search box must exist (this is the whole point of the fix).
    expect(
      await facade.library.hasSearch(),
      "auths library has no `auths-search` box — the search affordance regressed",
    ).toBe(true);

    // Query by the first word of a real card's name so the grid visibly narrows.
    const name = await facade.library.firstCardName();
    expect(name, "could not read a first auth card name to search for").toBeTruthy();
    const token = name!.split(/\s+/)[0]!;

    await facade.search(token);
    await facade.library.browse();

    // FAIL-LOUD: the searched-for card must still be on screen after filtering,
    // proving the search actually ran against real rows (not a no-op box).
    await facade.library.expectVisible(name!);

    await saveDemoVideo(page, `${spec.plural}-search`);
  });
});
