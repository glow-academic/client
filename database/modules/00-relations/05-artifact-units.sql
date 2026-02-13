-- Module: artifact-units
-- Category: relations
-- Description: artifact-units relation data
-- ============================================================

-- Table: artifact_units_relation
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('million_text', 'tokens', 1000000, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7acb-afab-19ceef6b410b', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('million_audio', 'tokens', 1000000, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7b0d-b978-c5a8f6729c49', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('200k', 'tokens', 200000, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7b19-a313-ffdaa73b65fe', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('million_image', 'tokens', 1000000, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7b1c-84f7-4e13f220fdb4', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('second', 'seconds', 1, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7b23-a804-0ab3f0dff208', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifact_units_relation (name, unit_category, value, active, created_at, updated_at, id, generated, mcp) VALUES ('image', 'units', 1, true, '2025-12-02T16:56:17.343793+00:00', '2025-12-02T16:56:17.343793+00:00', '019b3be4-3ced-7b2b-8fd2-54556abd3391', false, false) ON CONFLICT (id) DO NOTHING;
