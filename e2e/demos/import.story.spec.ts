// CSV import — demo stories (paced, recorded), one per domain.
//
// Writes a minimal name-only CSV to a temp file, opens the library's "Import
// CSV" dialog, uploads it (react-dropzone hidden input → server parse → review
// table), and confirms the import. The imported names are tracked so teardown
// reaps them. The CSV header is "Name" — domains whose import maps a Name field
// import cleanly; others surface their own validation in the review/results
// step. Data-driven over the import-wired libraries.

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "../fixtures";
import { DOMAINS, DomainFacade } from "../actions/domains";
import { saveDemoVideo } from "../helpers/demo-video";

for (const key of Object.keys(DOMAINS)) {
  const spec = DOMAINS[key]!;
  test.describe(`demo: ${spec.plural} import`, () => {
    test(`import ${spec.plural} from CSV`, async ({
      page,
      demo,
      registry,
      runId,
    }) => {
      test.setTimeout(180_000);

      const names = [
        `Imported ${spec.singular} A ${runId}`,
        `Imported ${spec.singular} B ${runId}`,
      ];
      for (const name of names) registry.track({ kind: key, name });

      const dir = await mkdtemp(join(tmpdir(), "glow-import-"));
      const csvPath = join(dir, `${spec.plural}.csv`);
      await writeFile(csvPath, `Name\n${names[0]}\n${names[1]}\n`);

      const facade = new DomainFacade(page, demo, spec, registry);
      await facade.open();
      await facade.library.bulkImport(csvPath);

      await saveDemoVideo(page, `${spec.plural}-import-story`);
    });
  });
}
