// Edit — demo stories (paced, recorded), one per domain.
//
// Setup-via-API: seed one fresh entity through the backend create endpoint
// (apiCreate), then drive the UI edit. A fresh create isn't tied to anything,
// so editing/deleting it is safe and self-cleaning (the registry reaps it by
// name). This avoids re-driving the slower, sometimes-blocked UI create just to
// have something to edit — and the same apiCreate primitive seeds the N rows a
// bulk edit/delete spec will need next.
//
// Editing changes the *description* (never the name) so teardown-by-name still
// resolves. Domains that can't be seeded with a bare name (required cross-
// entity relations) skip cleanly, as do any without an editable description.

import { test, expect } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { apiCreate, resolveId } from "../support/setup";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} edit`, () => {
    test(`edit a ${spec.singular}`, async ({
      page,
      demo,
      registry,
      request,
      runId,
    }) => {
      // Cold-backend first-hits and the heavier edit pages (documents) can run
      // slow; give headroom past the 120s default so a slow-but-working edit
      // isn't a false timeout.
      test.setTimeout(180_000);
      const name = `Edit ${spec.singular} ${runId}`;

      // Seed a fresh entity to edit (fast, reliable, self-cleaning).
      test.skip(
        !(await apiCreate(request, key, name)),
        `${spec.singular} not API-creatable with a bare name`,
      );
      registry.track({ kind: key, name });

      const id = await resolveId(request, key, name);
      test.skip(!id, `could not resolve the created ${spec.singular} id`);

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.form.openEdit(`${spec.listPath}/${id}`);

      // Change a non-name field so teardown still resolves the entity by name.
      test.skip(
        !(await facade.form.fillIfPresent("description", `Edited by e2e ${runId}.`)),
        `${spec.singular} has no editable description field`,
      );
      await facade.form.waitForDraftSaved();
      await facade.form.submit();
      // Generous: the update round-trip can be slow on a degraded backend, and
      // the "… updated successfully" toast is what confirms it persisted.
      await expect(page.getByText(/updated/i).first()).toBeVisible({
        timeout: 45_000,
      });

      await saveDemoVideo(page, `${spec.plural}-edit-story`);
    });
  });
}
