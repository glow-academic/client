import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "../fixtures";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: settings csv", () => {
  test("import settings from a CSV", async ({ settings, page, registry, runId }) => {
    test.setTimeout(180_000);
    const names = [`Imported Setting A ${runId}`, `Imported Setting B ${runId}`];
    for (const n of names) registry.track({ kind: "setting", name: n });
    const dir = await mkdtemp(join(tmpdir(), "glow-csv-"));
    const csv = join(dir, "settings.csv");
    await writeFile(csv, `Name\n${names[0]}\n${names[1]}\n`);
    await settings.open();
    await settings.library.bulkImport(csv);
    await saveDemoVideo(page, "settings-csv");
  });
});
