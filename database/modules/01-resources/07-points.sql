-- Module: points
-- Category: resources
-- Description: points resource data
-- ============================================================

-- Table: points_resource
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ec-7b7b-baf4-2c7b3162100b', 25, '2025-08-12T12:52:09.660796+00:00', true, false, false, 'total') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ed-7233-bdaf-88cbcc29083e', 20, '2025-08-12T12:52:09.660796+00:00', true, false, false, 'pass') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ec-7b7e-9cc6-35aae7c0fe5f', 20, '2025-12-03T14:42:00.746284+00:00', true, false, false, 'pass') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ed-7224-85a6-2fe8ff7b0c32', 16, '2025-12-03T14:42:00.746284+00:00', true, false, false, 'total') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ec-7b66-9bd8-f1c13b810392', 10, '2025-12-03T14:42:00.747703+00:00', true, false, false, 'total') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.points_resource (id, value, created_at, active, generated, mcp, type) VALUES ('019b995b-52ed-7236-9af7-2d462ea8f059', 8, '2025-12-03T14:42:00.747703+00:00', true, false, false, 'total') ON CONFLICT (id) DO NOTHING;
