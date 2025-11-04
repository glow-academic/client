// scripts/gen-keys.ts
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const specPath = path.join(__dirname, "../../server/openapi.json");
const outputPath = path.join(__dirname, "../lib/query/keys.ts");

if (!fs.existsSync(specPath)) {
  console.error(`❌ OpenAPI spec not found at: ${specPath}`);
  process.exit(1);
}

type OpenAPISpec = {
  paths: Record<
    string,
    Record<
      string,
      {
        tags?: string[];
        operationId?: string;
        "x-cache-tags"?: string[];
        parameters?: Array<{ name?: string; in?: string }>;
        requestBody?: {
          content?: {
            "application/json"?: {
              schema?: {
                type?: string;
                properties?: Record<string, { type?: string }>;
                required?: string[];
              };
            };
          };
        };
      }
    >
  >;
};

const spec: OpenAPISpec = JSON.parse(fs.readFileSync(specPath, "utf-8"));

/** per-tag capabilities discovered from the spec */
type TagInfo = {
  hasWith: boolean;
  hasList: boolean;
  idParams: Set<string>; // path templated {id} style
  bodyIdFields: Set<string>; // body { personaId } style
};
const tagsInfo = new Map<string, TagInfo>();

function ensureTagInfo(tag: string): TagInfo {
  let t = tagsInfo.get(tag);
  if (!t) {
    t = {
      hasWith: false,
      hasList: false,
      idParams: new Set(),
      bodyIdFields: new Set(),
    };
    tagsInfo.set(tag, t);
  }
  return t;
}

/** simple heuristics */
const isListPath = (p: string, opId?: string) =>
  /\/list$/.test(p) || /(^|_)list($|_)/i.test(opId || "");

const idLike = (name: string) => /(^id$|Id$|ID$)/.test(name);

for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
  for (const [_method, op] of Object.entries(pathItem || {})) {
    if (!op || typeof op !== "object") continue;

    const primaryTag = (op["x-cache-tags"]?.[0] || op.tags?.[0]) as
      | string
      | undefined;
    if (!primaryTag) continue;

    const info = ensureTagInfo(primaryTag);
    info.hasWith = true; // any operation → allow generic `with(...)`

    // 1) list detection
    if (isListPath(pathStr, op.operationId)) info.hasList = true;

    // 2) path templated ids: /foo/{barId}
    const templated = [...pathStr.matchAll(/\{([^}]+)\}/g)]
      .map((m) => m[1])
      .filter(
        (param): param is string =>
          typeof param === "string" && param.length > 0
      );
    templated.forEach((param) => {
      if (idLike(param)) info.idParams.add(param);
    });

    // 3) body id detection: look at JSON body schema properties
    const props =
      op.requestBody?.content?.["application/json"]?.schema?.properties;
    if (props && typeof props === "object") {
      // pick obvious id-like props
      for (const propName of Object.keys(props)) {
        if (idLike(propName)) info.bodyIdFields.add(propName);
      }
    }
  }
}

// Build file
const header = `// AUTO-GENERATED from OpenAPI spec. Do not edit.
// Generated from: server/openapi.json

const stable = (v: unknown): string =>
  v && typeof v === "object"
    ? JSON.stringify(v, Object.keys(v as Record<string, unknown>).sort())
    : String(v ?? "");
`;

function emitNs(tag: string, info: TagInfo) {
  // Always emit `all` and `with`
  const lines: string[] = [];
  lines.push(`  ${tag}: Object.assign(`);
  lines.push(
    `    (p?: Record<string, unknown>) => p ? [${JSON.stringify(
      tag
    )}, "with", stable(p)] as const : [${JSON.stringify(tag)}] as const,`
  );
  lines.push(`    {`);
  lines.push(`      all: [${JSON.stringify(tag)}] as const,`);
  lines.push(
    `      with: (p: Record<string, unknown>) => [${JSON.stringify(
      tag
    )}, "with", stable(p)] as const,`
  );

  // `list(filters?)`
  if (info.hasList) {
    lines.push(
      `      list: (filters?: Record<string, unknown>) => filters ? [${JSON.stringify(
        tag
      )}, "list", stable(filters)] as const : [${JSON.stringify(tag)}, "list"] as const,`
    );
  }

  // `id(id)` (basic entity scoping)
  if (info.idParams.size || info.bodyIdFields.size) {
    lines.push(
      `      id: (id: string | number) => [${JSON.stringify(
        tag
      )}, "id", String(id)] as const,`
    );
    // `detail(id, extra?)`
    lines.push(
      `      detail: (id: string | number, extra?: Record<string, unknown>) => extra ? [${JSON.stringify(
        tag
      )}, "detail", String(id), stable(extra)] as const : [${JSON.stringify(
        tag
      )}, "detail", String(id)] as const,`
    );
  }

  lines.push(`    }`);
  lines.push(`  ),`);
  return lines.join("\n");
}

const body =
  header +
  `\nexport const keys = {\n` +
  [...tagsInfo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, info]) => emitNs(tag, info))
    .join("\n") +
  `\n} as const;\n\nexport type CacheTag = keyof typeof keys;\n`;

const outDir = path.dirname(outputPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, body);
console.log(`✅ Generated keys.ts with ${tagsInfo.size} namespaces`);
