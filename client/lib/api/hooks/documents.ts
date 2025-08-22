// AUTO-GENERATED minimal hooks for documents
// Safe to edit: generator will SKIP unless --force-hooks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/fetcher";
import type { Document, DocumentCreate, DocumentUpdate } from "@/lib/repos/documentRepo";
import { documentKeys  } from "@/lib/api/keys";

export function useDocuments(filters?: unknown) {
  return useQuery({
    queryKey: documentKeys.list(filters),
    queryFn: () => api<Document[]>("/api/v1/documents"),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentCreate) => api<Document>("/api/v1/documents", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useDocument(id: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api<Document>(`/api/v1/documents/${id}`),
    enabled,
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DocumentUpdate) => api<Document>(`/api/v1/documents/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.detail(id) }),
  });
}

export function useDeleteDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

