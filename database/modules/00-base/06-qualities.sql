-- Module: qualities
-- Category: base
-- Description: qualities system data
-- ============================================================

-- Table: qualities_resource
INSERT INTO public.qualities_resource (id, quality, created_at, active, generated, mcp) VALUES ('019bbce5-e5ff-7197-bd68-b0ff7b7508af', 'low', '2026-01-14T14:25:41.879499+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.qualities_resource (id, quality, created_at, active, generated, mcp) VALUES ('019bbce5-e600-773a-ac8b-7044ffed731c', 'medium', '2026-01-14T14:25:41.879499+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.qualities_resource (id, quality, created_at, active, generated, mcp) VALUES ('019bbce5-e600-7e7e-9a28-1182423e74a7', 'high', '2026-01-14T14:25:41.879499+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
