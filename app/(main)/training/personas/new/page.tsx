/**
 * app/(main)/training/personas/new/page.tsx
 * New persona page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Persona from "@/components/artifacts/persona/Persona";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetPersonaIn = InputOf<"/persona/get", "post">;
type GetPersonaOut = OutputOf<"/persona/get", "post">;
type CreatePersonaIn = InputOf<"/persona/create", "post">;
type CreatePersonaOut = OutputOf<"/persona/create", "post">;
type PatchPersonaDraftIn = InputOf<"/persona/draft", "patch">;
type PatchPersonaDraftOut = OutputOf<"/persona/draft", "patch">;
type GroupPersonaIn = InputOf<"/persona/group", "post">;
type GroupPersonaOut = OutputOf<"/persona/group", "post">;
type ProblemPersonaIn = InputOf<"/persona/problem", "post">;
type ProblemPersonaOut = OutputOf<"/persona/problem", "post">;
type ContextIn = InputOf<"/persona/context", "post">;
type ContextOut = OutputOf<"/persona/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getPersonaDefault = async (
  input: GetPersonaIn
): Promise<GetPersonaOut> => {
  return api.post("/persona/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createPersona(input: CreatePersonaIn): Promise<CreatePersonaOut> {
  "use server";
  return api.post("/persona/create", input);
}

async function patchPersonaDraft(
  input: PatchPersonaDraftIn
): Promise<PatchPersonaDraftOut> {
  "use server";
  return api.post("/persona/draft", input);
}

async function createPersonaProblem(input: ProblemPersonaIn): Promise<ProblemPersonaOut> {
  "use server";
  return api.post("/persona/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/persona/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Personas" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewPersonaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers (until /personas/context returns full profile)
    const context = await api.post("/persona/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);

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

    const personaSearchParams = {
      draftId: parseAsString,
      colorSearch: parseAsString,
      iconSearch: parseAsString,
      descriptionSearch: parseAsString,
      instructionsSearch: parseAsString,
      fieldSearch: parseAsString,
      colorShowSelected: parseAsBoolean,
      iconShowSelected: parseAsBoolean,
      fieldShowSelected: parseAsBoolean,
      parameterIds: parseAsArrayOf(parseAsString),
    };
    const loadPersonaSearchParams = createLoader(personaSearchParams);
    const q = loadPersonaSearchParams(searchParamsObj);

    // SSR data fetches
    const input: GetPersonaIn = {
      body: {
        id: null,
        draft_id: q.draftId ?? null,
        colors: q.colorSearch || q.colorShowSelected ? {
          search: q.colorSearch ?? undefined,
          selected: q.colorShowSelected ?? undefined,
        } : undefined,
        icons: q.iconSearch || q.iconShowSelected ? {
          search: q.iconSearch ?? undefined,
          selected: q.iconShowSelected ?? undefined,
        } : undefined,
        descriptions: q.descriptionSearch ? {
          search: q.descriptionSearch,
        } : undefined,
        instructions: q.instructionsSearch ? {
          search: q.instructionsSearch,
        } : undefined,
        parameter_fields: q.fieldSearch || q.fieldShowSelected || q.parameterIds ? {
          search: q.fieldSearch ?? undefined,
          selected: q.fieldShowSelected ?? undefined,
          parameter_ids: q.parameterIds ?? undefined,
        } : undefined,
      } as GetPersonaIn["body"],
    };

    const [personaDetailDefault, draftsResult, groupResult] = await Promise.all([
      getPersonaDefault(input),
      api.post("/persona/drafts", {}),
      api.post("/persona/group", { body: {} } as GroupPersonaIn),
    ]);

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "persona",
            createFeedback: createPersonaProblem,
          }}
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Personas", section: "personas", url: "/training/personas" },
            { title: "New Persona" },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "persona",
            groupId: (groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null,
            operations: ["draft", "get", "group"],
            prompts: context.prompts?.prompts,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="persona-new"
            aria-label="Create new persona page"
          >
            <Persona
              key={q.draftId || "no-draft"}
              groupId={(groupResult as GroupPersonaOut & { group_id?: string })?.group_id ?? null}
              personaData={personaDetailDefault}
              createPersonaAction={createPersona}
              patchPersonaDraftAction={patchPersonaDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/training/personas/new"
        />
      );
    }
    throw error;
  }
}
