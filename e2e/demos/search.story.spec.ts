// Search — demo stories (paced, recorded), one per domain.
//
// Read-only: open the library, read a real card's name, search a token from it
// and let the grid filter. Browse-heavy, so it assumes the backend holds data
// (the client never seeds). Skips libraries with no free-text search box (auth
// ships only picker filters) or no data. One `{plural}-search-story.webm` per
// registered domain.

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} search`, () => {
    test(`search the ${spec.plural} library`, async ({ page, demo, registry }) => {
      const facade = new DomainFacade(page, demo, spec, registry);

      test.skip(
        !(await facade.library.openIfPopulated()),
        `${spec.plural} library is empty (no seed data to search)`,
      );
      test.skip(
        !(await facade.library.hasSearch()),
        `${spec.plural} has no free-text search`,
      );

      const name = await facade.library.firstCardName();
      test.skip(!name, `${spec.plural} library is empty`);

      // Query a leading token of a real name so the filter has a guaranteed hit.
      const query = name!.split(/\s+/)[0]!;
      await facade.search(query);
      await facade.library.browse();

      await saveDemoVideo(page, `${spec.plural}-search-story`);
    });
  });
}
