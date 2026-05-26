// Overview — demo stories (paced, recorded), one per domain.
//
// Read-only: open each domain's library and browse the populated grid. These
// are browse-heavy, so they assume the connected backend already holds a
// representative dataset (the client never seeds). The data-driven loop emits
// one test — and one `{plural}-overview-story.webm` — per registered domain,
// so new domains are covered automatically.

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} overview`, () => {
    test(`browse the ${spec.plural} library`, async ({ page, demo, registry }) => {
      const facade = new DomainFacade(page, demo, spec, registry);

      test.skip(
        !(await facade.library.openIfPopulated()),
        `${spec.plural} library is empty (no seed data to browse)`,
      );
      await facade.library.browse();

      await saveDemoVideo(page, `${spec.plural}-overview-story`);
    });
  });
}
