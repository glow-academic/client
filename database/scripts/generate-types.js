#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const CLIENT_TYPES_PATH = path.join(__dirname, "../../client/types.ts");

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function singularize(word) {
  const cap = capitalize(word);
  if (cap.endsWith("ies")) return cap.slice(0, -3) + "y";
  if (cap.endsWith("s")) return cap.slice(0, -1);
  return cap;
}

function generateTypes() {
  console.log("🚀 Generating types from Drizzle schema...");
  const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

  const tableRegex = /export const (\w+) = pgTable\(/g;
  const enumRegex = /export const (\w+) = pgEnum\(/g;

  const tables = [...schemaContent.matchAll(tableRegex)].map(
    (match) => match[1]
  );
  const enums = [...schemaContent.matchAll(enumRegex)].map((match) => match[1]);

  let content = `// This file is auto-generated. Do not edit manually.\n`;
  content += `import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';\n`;
  content += `import * as schema from '@/utils/drizzle/schema';\n\n`;

  tables.forEach((table) => {
    const sName = singularize(table);
    content += `export type ${sName} = InferSelectModel<typeof schema.${table}>;\n`;
    content += `export type New${sName} = InferInsertModel<typeof schema.${table}>;\n`;
  });

  enums.forEach((enumName) => {
    content += `export type ${capitalize(enumName)} = (typeof schema.${enumName}.enumValues)[number];\n`;
  });

  fs.writeFileSync(CLIENT_TYPES_PATH, content);
  console.log(`✅ Generated ${CLIENT_TYPES_PATH}`);
}

generateTypes();
