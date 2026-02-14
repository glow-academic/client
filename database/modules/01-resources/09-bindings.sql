-- Module: bindings
-- Category: resources
-- Description: bindings resource data
-- ============================================================

-- Table: bindings_resource
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b7a-a8f5-ecda6c0eb2ea', 'highlights', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7be3-a5b9-4d6f68c68dd6', 'replacements', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
