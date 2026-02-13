-- Module: request-limits
-- Category: resources
-- Description: request-limits resource data
-- ============================================================

-- Table: request_limits_resource
INSERT INTO public.request_limits_resource (id, requests_per_day, created_at, active, generated, mcp) VALUES ('019bb553-e77f-797c-ae44-544fbe10351b', 10, '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
