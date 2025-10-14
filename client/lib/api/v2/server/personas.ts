/**
 * Server-side fetcher functions for personas v2 API
 * These are used for server-side prefetching in Next.js pages
 */

import { getApiBase } from "@/lib/api-base";
import { PersonaDetailResponseSchema } from "../schemas/personas";

export async function fetchPersonaDetail(personaId: string, profileId: string) {
  const res = await fetch(`${getApiBase()}/api/v2/personas/detail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ personaId, profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch persona detail");
  }

  const data = await res.json();
  return PersonaDetailResponseSchema.parse(data);
}

export async function fetchPersonaDetailDefault(profileId: string) {
  const res = await fetch(`${getApiBase()}/api/v2/personas/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default persona detail");
  }

  const data = await res.json();
  return PersonaDetailResponseSchema.parse(data);
}
