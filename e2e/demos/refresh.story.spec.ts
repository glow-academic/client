// Refresh — demo stories (paced, recorded), one per domain.
//
// Read-only: open the library and click the page toolbar's "Refresh" (POST
// /{artifact}/refresh — a server-side cache refresh), then let it settle.
// Skips libraries that don't wire a refresh action. Browse-heavy.

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} refresh`, () => {
    test(`refresh the ${spec.plural} library`, async ({ page, demo, registry }) => {
      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.library.openIfPopulated();
      test.skip(
        !(await facade.library.hasToolbarButton("Refresh")),
        `${spec.plural} has no refresh`,
      );
      await facade.library.refresh();

      await saveDemoVideo(page, `${spec.plural}-refresh-story`);
    });
  });
}
