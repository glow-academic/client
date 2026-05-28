// Duplicate — demo stories (paced, recorded), one per domain.
//
// Seed one row via the factory, open the library, search it, and click its
// per-card "Duplicate" action (no confirm) → success toast. The backend mints
// the copy; we track both the original name and a "(copy)"-suffixed name so
// teardown reaps whichever convention the backend uses (it deletes by exact
// name, so tracking both covers same-name and suffixed copies).
//
// Covers the duplicate-wired libraries the factory can seed; others skip.

import { test, expect } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { apiCreate } from "../support/setup";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} duplicate`, () => {
    test(`duplicate a ${spec.singular}`, async ({
      page,
      demo,
      registry,
      request,
      runId,
    }) => {
      test.setTimeout(180_000);

      const name = `Dup ${spec.singular} ${runId}`;
      test.skip(
        !(await apiCreate(request, key, name)),
        `could not seed a ${spec.singular} via the factory`,
      );
      registry.track({ kind: key, name });
      // The backend names the copy "{name} Copy" — track it so teardown reaps it.
      registry.track({ kind: key, name: `${name} Copy` });

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.open();
      await facade.search(name);
      await expect(facade.card(name)).toBeVisible();
      await facade.library.duplicate(name);

      await saveDemoVideo(page, `${spec.plural}-duplicate-story`);
    });
  });
}
