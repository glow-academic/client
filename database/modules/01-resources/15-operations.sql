-- Module: operations
-- Category: resources
-- Description: operations resource data
-- ============================================================

-- Table: operations_resource
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000001', 'get', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000002', 'create', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000003', 'link', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000004', 'search', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000005', 'docs', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000006', 'list', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000007', 'duplicate', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000008', 'delete', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000009', 'draft', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.operations_resource (id, operation, created_at, active, generated, mcp) VALUES ('019d0000-0001-7000-8000-000000000010', 'save', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
