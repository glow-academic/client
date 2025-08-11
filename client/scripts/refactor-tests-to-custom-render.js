/*
  Refactors test files to use the custom renderer and removes deprecated mocks.
  - Switch imports from '@testing-library/react' to '@/test/custom-render'
  - Replace renderWithMocks with render from '@/test/custom-render'
  - Remove imports of '@/mocks/queries' and '@/mocks/mutations' (and '@mocks/...')
*/

import fs from "fs";
import path from "path";

function walk(dir, exts, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, exts, files);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

function refactorFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");
  let content = original;

  // 1) Replace testing-library import with custom renderer
  content = content.replace(
    /from\s+["']@testing-library\/react["']/g,
    "from '@/test/custom-render'"
  );

  // 2) Replace renderWithMocks import with render from custom renderer
  content = content.replace(
    /import\s*\{\s*renderWithMocks\s*\}\s*from\s*["']@\/test\/renderWithMocks["']/g,
    "import { render } from '@/test/custom-render'"
  );

  // 3) Replace calls to renderWithMocks( with render(
  content = content.replace(/\brenderWithMocks\s*\(/g, "render(");

  // 4) Remove lines importing mocks/queries or mocks/mutations
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    return (
      !line.match(/[@]\/mocks\/(queries|mutations)/) &&
      !line.match(/@mocks\/(queries|mutations)/)
    );
  });
  content = filtered.join("\n");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  }
  return false;
}

function main() {
  const roots = ["client/__tests__", "client/test"];
  const targets = [];
  for (const root of roots) {
    if (fs.existsSync(root)) {
      walk(root, [".test.tsx", ".test.ts", ".test.jsx"], targets);
    }
  }

  let changed = 0;
  for (const f of targets) {
    if (refactorFile(f)) {
      changed += 1;
      // eslint-disable-next-line no-console
      console.log(`Updated: ${f}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Done. Updated ${changed} file(s).`);
}

main();
