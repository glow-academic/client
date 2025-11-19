/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type CreateProviderIn = InputOf<"/api/v3/providers/create", "post">;
type CreateProviderOut = OutputOf<"/api/v3/providers/create", "post">;

/** ---- Strongly-typed server action (single source of truth) ---- */
async function createProvider(
  input: CreateProviderIn,
): Promise<CreateProviderOut> {
  "use server";
  const out = await api.post("/providers/create", input);
  revalidateTag("providers");
  return out;
}

export const metadata: Metadata = {
  title: "Providers",
  description: `Create new AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewProviderPage() {
  return (
    <div className="space-y-6">
      <Provider createProviderAction={createProvider} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateProviderIn, CreateProviderOut };
