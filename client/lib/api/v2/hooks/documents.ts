/**
 * Documents hooks for v2 API
 * These hooks call client-side BFF routes at /api/v2/documents/*
 * which then proxy to the FastAPI server
 */

import { api } from "@/lib/api/fetcher";
import {
  documentsDetailBulkKeys,
  documentsDetailKeys,
  documentsListKeys,
} from "@/lib/api/v2/keys";
import {
  BulkDeleteDocumentsRequest,
  BulkUpdateDocumentsRequest,
  DeleteDocumentRequest,
  DeleteDocumentResponseSchema,
  DocumentDetailBulkResponseSchema,
  DocumentDetailResponseSchema,
  DocumentsFilters,
  DocumentsListResponseSchema,
  UpdateDocumentRequest,
  UpdateDocumentResponseSchema,
} from "@/lib/api/v2/schemas/documents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type for documents hook options
type DocumentsHookOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useDocumentsList(
  filters: DocumentsFilters,
  options: DocumentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: documentsListKeys.list(filters),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/documents/list", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return DocumentsListResponseSchema.parse(res);
    },
  });
}

export function useDocumentDetail(
  documentId: string,
  profileId: string,
  options: DocumentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: documentsDetailKeys.detail(documentId, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/documents/detail", {
        method: "POST",
        body: JSON.stringify({ documentId, profileId }),
      });
      return DocumentDetailResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && !!documentId && !!profileId,
  });
}

export function useDocumentDetailBulk(
  documentIds: string[],
  profileId: string,
  options: DocumentsHookOptions | boolean = true
) {
  const queryOptions =
    typeof options === "boolean"
      ? { enabled: options }
      : { enabled: true, ...options };

  return useQuery({
    queryKey: documentsDetailBulkKeys.detail(documentIds, profileId),
    ...queryOptions,
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/documents/detail-bulk", {
        method: "POST",
        body: JSON.stringify({ documentIds, profileId }),
      });
      return DocumentDetailBulkResponseSchema.parse(res);
    },
    enabled: queryOptions.enabled && documentIds.length > 0 && !!profileId,
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: UpdateDocumentRequest) => {
      const res = await api<unknown>("/api/v2/documents/update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateDocumentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("documents:v2:list")) ||
            (typeof key === "string" && key.startsWith("documents:v2:detail"))
          );
        },
      });
    },
  });
}

export function useBulkUpdateDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkUpdateDocumentsRequest) => {
      const res = await api<unknown>("/api/v2/documents/bulk-update", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return UpdateDocumentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            (typeof key === "string" && key.startsWith("documents:v2:list")) ||
            (typeof key === "string" && key.startsWith("documents:v2:detail"))
          );
        },
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DeleteDocumentRequest) => {
      const res = await api<unknown>("/api/v2/documents/delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteDocumentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("documents:v2:list");
        },
      });
    },
  });
}

export function useBulkDeleteDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BulkDeleteDocumentsRequest) => {
      const res = await api<unknown>("/api/v2/documents/bulk-delete", {
        method: "POST",
        body: JSON.stringify(request),
      });
      return DeleteDocumentResponseSchema.parse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("documents:v2:list");
        },
      });
    },
  });
}
