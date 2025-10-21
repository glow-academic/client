/**
 * Breadcrumbs API schemas
 */

import { z } from "zod";

export const BreadcrumbItemSchema = z.object({
  title: z.string(),
  section: z.string().optional().nullable(),
});

export const BreadcrumbsRequestSchema = z.object({
  pathname: z.string(),
});

export const BreadcrumbsResponseSchema = z.object({
  breadcrumbs: z.array(BreadcrumbItemSchema),
});

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;
export type BreadcrumbsRequest = z.infer<typeof BreadcrumbsRequestSchema>;
export type BreadcrumbsResponse = z.infer<typeof BreadcrumbsResponseSchema>;
