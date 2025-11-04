/**
 * Personas hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/personas/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/v2/fetcher";
import {
  personasDetailDefaultKeys,
  personasDetailKeys,
  personasListKeys,
} from "@/lib/api/v2/keys";
import {
  CreatePersonaRequest,
  CreatePersonaResponseSchema,
  DeletePersonaPromptRequest,
  DeletePersonaPromptResponseSchema,
  DeletePersonaRequest,
  DeletePersonaResponseSchema,
  DuplicatePersonaRequest,
  DuplicatePersonaResponseSchema,
  PersonaDetailResponseSchema,
  PersonasFilters,
  PersonasListResponseSchema,
  UpdatePersonaRequest,
  UpdatePersonaResponseSchema,
} from "@/lib/api/v2/schemas/personas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for personas hook options
type PersonasHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function usePersonasList(
  filters: PersonasFilters,
  options: PersonasHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: personasListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/personas/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PersonasListResponseSchema.parse(res);
    },
  });
}

export function useDuplicatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DuplicatePersonaRequest) => {
      const res = await api<unknown>("/api/v2/personas/duplicate", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DuplicatePersonaResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate all personas list queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("personas:v2:list");
        },
      });
    },
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeletePersonaRequest) => {
      const res = await api<unknown>("/api/v2/personas/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeletePersonaResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate all personas list queries
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("personas:v2:list");
        },
      });
    },
  });
}

export function usePersonaDetail(
  personaId: string,
  profileId: string,
  options: PersonasHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: personasDetailKeys.detail(personaId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/personas/detail", {
        method: "POST",
        body: JSON.stringify({ personaId, profileId }),
      });
      return PersonaDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!personaId && !!profileId,
  });
}

export function usePersonaDetailDefault(
  profileId: string,
  options: PersonasHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: personasDetailDefaultKeys.detail(profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/personas/detail-default", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      });
      return PersonaDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!profileId,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreatePersonaRequest) => {
      const res = await api<unknown>("/api/v2/personas/create", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return CreatePersonaResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate all personas queries (list, detail, and default detail)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" &&
            (key.startsWith("personas:v2:list") ||
              key.startsWith("personas:v2:detail"))
          );
        },
      });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdatePersonaRequest) => {
      const res = await api<unknown>("/api/v2/personas/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdatePersonaResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate all personas queries (list, detail, and default detail)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" &&
            (key.startsWith("personas:v2:list") ||
              key.startsWith("personas:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDeletePersonaPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeletePersonaPromptRequest) => {
      const res = await api<unknown>("/api/v2/personas/delete-prompt", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeletePersonaPromptResponseSchema.parse(res);
    },
    onSuccess: () => {
      // Invalidate all personas queries (list, detail, and default detail)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" &&
            (key.startsWith("personas:v2:list") ||
              key.startsWith("personas:v2:detail"))
          );
        },
      });
    },
  });
}
