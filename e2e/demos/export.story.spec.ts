// Export (CSV download) — demo stories (paced, recorded), one per domain.
//
// Read-only: open the library and click the page toolbar's "Download CSV"
// (POST /{artifact}/export → file_id → native browser download). Captures the
// download event to confirm it came through. Skips libraries that don't wire an
// export action. Browse-heavy — assumes the backend holds data.

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} export`, () => {
    test(`export the ${spec.plural} library`, async ({ page, demo, registry }) => {
      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.library.openIfPopulated(); // navigate + wait for the toolbar
      test.skip(
        !(await facade.library.hasToolbarButton("Download CSV")),
        `${spec.plural} has no CSV export`,
      );
      await facade.library.exportCsv();

      await saveDemoVideo(page, `${spec.plural}-export-story`);
    });
  });
}
