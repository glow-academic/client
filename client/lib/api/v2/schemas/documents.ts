/**
 * Documents V2 API Schemas
 * Schema definitions for documents v2 endpoints
 */

import { z } from "zod";
import { DepartmentMappingSchema, ScenarioMappingSchema } from "./personas"; // Reuse centralized types

// Tag mapping (reusable)
export const TagMappingSchema = z.record(z.string(), z.string()); // tag_id -> name
export type TagMapping = z.infer<typeof TagMappingSchema>;

// ============================================================================
// LIST ENDPOINT
// ============================================================================

export const DocumentsFiltersSchema = z.object({
  departmentIds: z.array(z.string()),
  profileId: z.string(),
});

export type DocumentsFilters = z.infer<typeof DocumentsFiltersSchema>;

export const DocumentItemSchema = z.object({
  document_id: z.string(),
  name: z.string(),
  type: z.string(),
  updatedAt: z.string(),
  tag_ids: z.array(z.string()),
  extension: z.string(),
  scenario_ids: z.array(z.string()),
  can_edit: z.boolean(),
  can_delete: z.boolean(),
  active: z.boolean(),
  department_id: z.string(),
});

export const DocumentsListResponseSchema = z.object({
  documents: z.array(DocumentItemSchema),
  tag_mapping: TagMappingSchema,
  scenario_mapping: ScenarioMappingSchema,
});

export type DocumentsListResponse = z.infer<typeof DocumentsListResponseSchema>;
export type DocumentItem = z.infer<typeof DocumentItemSchema>;

// ============================================================================
// DETAIL ENDPOINT
// ============================================================================

export const DocumentDetailRequestSchema = z.object({
  documentId: z.string(),
  profileId: z.string(),
});

export type DocumentDetailRequest = z.infer<typeof DocumentDetailRequestSchema>;

export const DocumentDetailResponseSchema = z.object({
  name: z.string(),
  active: z.boolean(),
  type: z.string(),
  document_type_options: z.array(z.string()),
  tag_ids: z.array(z.string()),
  valid_tag_ids: z.array(z.string()),
  department_id: z.string(),
  valid_department_ids: z.array(z.string()),
});

export type DocumentDetailResponse = z.infer<
  typeof DocumentDetailResponseSchema
>;

// ============================================================================
// DETAIL-BULK ENDPOINT
// ============================================================================

export const DocumentDetailBulkRequestSchema = z.object({
  documentIds: z.array(z.string()),
  profileId: z.string(),
});

export type DocumentDetailBulkRequest = z.infer<
  typeof DocumentDetailBulkRequestSchema
>;

export const DocumentDetailBulkResponseSchema = z.object({
  document_type_options: z.array(z.string()),
  type: z.string().nullable(), // Common type if all same, else null
  tag_ids: z.array(z.string()), // Union of all tag_ids
  valid_tag_ids: z.array(z.string()),
  department_ids: z.array(z.string()), // Union of all department_ids
  valid_department_ids: z.array(z.string()),
  tag_mapping: TagMappingSchema,
  department_mapping: DepartmentMappingSchema,
});

export type DocumentDetailBulkResponse = z.infer<
  typeof DocumentDetailBulkResponseSchema
>;

// ============================================================================
// UPDATE ENDPOINTS
// ============================================================================

export const UpdateDocumentRequestSchema = z.object({
  documentId: z.string(),
  type: z.string(),
  tag_ids: z.array(z.string()),
  department_id: z.string(),
});

export type UpdateDocumentRequest = z.infer<typeof UpdateDocumentRequestSchema>;

export const BulkUpdateDocumentsRequestSchema = z.object({
  documentIds: z.array(z.string()),
  type: z.string(),
  tag_ids: z.array(z.string()),
  department_id: z.string(),
});

export type BulkUpdateDocumentsRequest = z.infer<
  typeof BulkUpdateDocumentsRequestSchema
>;

export const UpdateDocumentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateDocumentResponse = z.infer<
  typeof UpdateDocumentResponseSchema
>;

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

export const DeleteDocumentRequestSchema = z.object({
  documentId: z.string(),
});

export type DeleteDocumentRequest = z.infer<typeof DeleteDocumentRequestSchema>;

export const BulkDeleteDocumentsRequestSchema = z.object({
  documentIds: z.array(z.string()),
});

export type BulkDeleteDocumentsRequest = z.infer<
  typeof BulkDeleteDocumentsRequestSchema
>;

export const DeleteDocumentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteDocumentResponse = z.infer<
  typeof DeleteDocumentResponseSchema
>;
