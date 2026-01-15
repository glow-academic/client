/**
 * app/(main)/engine/tools/new/page.tsx
 * New tool page (skeleton)
 */

import Tool from "@/components/tools/Tool";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/api/v4/tools/get", "post">;
type GetToolOut = OutputOf<"/api/v4/tools/get", "post">;
type SaveToolIn = InputOf<"/api/v4/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/tools/save", "post">;
type PatchToolDraftIn = InputOf<"/api/v4/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/tools/draft", "patch">;
type CreateDraftSchemasIn = InputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftSchemasOut = OutputOf<"/api/v4/resources/schemas", "post">;
type CreateDraftTemplatesIn = InputOf<"/api/v4/resources/templates", "post">;
type CreateDraftTemplatesOut = OutputOf<"/api/v4/resources/templates", "post">;
type CreateDraftSchemaFieldItemsIn = InputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;
type CreateDraftSchemaFieldItemsOut = OutputOf<
  "/api/v4/resources/schema_field_items",
  "post"
>;
type CreateDraftTemplateArrayItemsIn = InputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;
type CreateDraftTemplateArrayItemsOut = OutputOf<
  "/api/v4/resources/template_array_items",
  "post"
>;
type CreateDraftTemplateValuesIn = InputOf<
  "/api/v4/resources/template_values",
  "post"
>;
type CreateDraftTemplateValuesOut = OutputOf<
  "/api/v4/resources/template_values",
  "post"
>;
type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getToolDefault = async (input: GetToolIn): Promise<GetToolOut> => {
  return api.post("/tools/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Tool",
    description: "Create a new tool for teaching assistant training platform.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function saveTool(input: SaveToolIn): Promise<SaveToolOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/tools/save", input);
}

async function patchToolDraft(
  input: PatchToolDraftIn
): Promise<PatchToolDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/tools/draft", input);
}

async function createDraftSchemas(
  input: CreateDraftSchemasIn
): Promise<CreateDraftSchemasOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/schemas", input);
}

async function createDraftTemplates(
  input: CreateDraftTemplatesIn
): Promise<CreateDraftTemplatesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/templates", input);
}

async function createDraftSchemaFieldItems(
  input: CreateDraftSchemaFieldItemsIn
): Promise<CreateDraftSchemaFieldItemsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/schema_field_items", input);
}

async function createDraftTemplateArrayItems(
  input: CreateDraftTemplateArrayItemsIn
): Promise<CreateDraftTemplateArrayItemsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/template_array_items", input);
}

async function createDraftTemplateValues(
  input: CreateDraftTemplateValuesIn
): Promise<CreateDraftTemplateValuesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/template_values", input);
}

async function createDraftArgs(
  input: CreateDraftArgsIn
): Promise<CreateDraftArgsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/args", input);
}

async function createDraftArgsOutputs(
  input: CreateDraftArgsOutputsIn
): Promise<CreateDraftArgsOutputsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/args_outputs", input);
}

async function createSchemaField(
  input: CreateSchemaFieldIn
): Promise<CreateSchemaFieldOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/schema_fields", input);
}

async function createTemplate(
  input: CreateTemplateIn
): Promise<CreateTemplateOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/templates", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewToolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for tool search params
  const toolSearchParams = {
    draftId: parseAsString,
    schemaSearch: parseAsString,
    templateSearch: parseAsString,
    schemaShowSelected: parseAsBoolean,
    templateShowSelected: parseAsBoolean,
  };
  const loadToolSearchParams = createLoader(toolSearchParams);
  const q = loadToolSearchParams(searchParamsObj);

  // Fetch tool default data (for dropdowns and defaults) with draft_id and filter params
  const input: GetToolIn = {
    body: {
      tool_id: null,
      draft_id: q.draftId ?? null,
      schema_search: q.schemaSearch ?? null,
      template_search: q.templateSearch ?? null,
      schema_show_selected: q.schemaShowSelected ?? null,
      template_show_selected: q.templateShowSelected ?? null,
    } as GetToolIn["body"],
  };
  const toolDetailDefault = await getToolDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="tool-new"
      aria-label="Create new tool page"
    >
      <Tool
        toolDetailDefault={toolDetailDefault}
        saveToolAction={saveTool}
        patchToolDraftAction={patchToolDraft}
        createSchemasAction={createDraftSchemas}
        createTemplatesAction={createDraftTemplates}
        createArgsAction={createDraftArgs}
        createArgsOutputsAction={createDraftArgsOutputs}
        createSchemaFieldItemsAction={createDraftSchemaFieldItems}
        createTemplateArrayItemsAction={createDraftTemplateArrayItems}
        createTemplateValuesAction={createDraftTemplateValues}
        createSchemaFieldAction={createSchemaField}
        createTemplateAction={createTemplate}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type {
  GetToolIn,
  GetToolOut,
  PatchToolDraftIn,
  PatchToolDraftOut,
  SaveToolIn,
  SaveToolOut,
};
