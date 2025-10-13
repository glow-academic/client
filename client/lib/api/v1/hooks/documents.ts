// AUTO-GENERATED minimal hooks for documents
// Safe to edit: generator will SKIP unless --force-hooks
import { api } from "@/lib/api/fetcher";
import { documentKeys, documentKeysByDepartmentId } from "@/lib/api/v1/keys";
import type {
  Document,
  DocumentCreate,
  DocumentUpdate,
} from "@/lib/repos/documentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDocuments(filters?: unknown) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => api<Document[]>("/api/v1/documents"),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentCreate) =>
      api<Document>("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDocument(id: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api<Document>(`/api/v1/documents/${id}`),
    enabled: enabled && id !== undefined && id !== null && id !== "",
  });
}

export function useUpdateDocument(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DocumentUpdate & { id?: string }) => {
      const resolvedId = id ?? (patch as unknown as { id?: string })?.id;
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for update");
      }
      const { id: _omit, ...body } = (patch as Record<string, unknown>) ?? {};
      return api<Document>(`/api/v1/documents/${resolvedId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      const resolvedId = id ?? (variables as { id?: string } | undefined)?.id;
      if (resolvedId && resolvedId !== "") {
        qc.invalidateQueries({ queryKey: documentKeys.detail(resolvedId) });
      } else {
        qc.invalidateQueries({ queryKey: documentKeys.all });
      }
    },
  });
}

export function useDeleteDocument(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arg?: { id?: string } | string) => {
      const resolvedId = id ?? (typeof arg === "object" ? arg?.id : arg);
      if (
        resolvedId === undefined ||
        resolvedId === null ||
        resolvedId === ""
      ) {
        throw new Error("Missing id for delete");
      }
      return api<void>(`/api/v1/documents/${resolvedId}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDocumentsByDepartmentId(id: string) {
  return useQuery<Document[]>({
    queryKey: documentKeysByDepartmentId.one(id),
    queryFn: () => api<Document[]>(`/api/v1/documents/by/departmentId/${id}`),
    enabled: id !== undefined && id !== null && id !== "",
  });
}

export function useDocumentsByDepartmentIdBatch(ids: string[]) {
  return useQuery<Document[]>({
    queryKey: documentKeysByDepartmentId.many(ids),
    queryFn: () =>
      api<Document[]>(`/api/v1/documents/by/departmentId/batch`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    enabled: Array.isArray(ids) && ids.length > 0,
  });
}

export function useUpdateDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      updates: Array<{ id: string } & DocumentUpdate>;
    }) =>
      api<Document[]>(`/api/v1/documents/bulk-update`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDeleteDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids: string[] }) =>
      api<Document[]>(`/api/v1/documents/bulk-delete`, {
        method: "DELETE",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
