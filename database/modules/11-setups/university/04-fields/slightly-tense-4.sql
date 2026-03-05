-- Module: Slightly Tense (4)
-- Category: field
-- Description: Slightly Tense (4) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-774e-9a55-f7b572d7c6b3', 'There is some urgency or emotional energy, but it remains manageable.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85', 'Slightly Tense (4)', 'There is some urgency or emotional energy, but it remains manageable.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79c0-b5d1-e627b54c1cfa', 'Slightly Tense (4)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.87224-05', '2025-08-12 07:52:09.87224-05', '019b3be4-3255-7fa7-b257-52e79bf08459', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019b995c-8e9e-774e-9a55-f7b572d7c6b3', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fa7-b257-52e79bf08459', '019b995c-8e9b-79c0-b5d1-e627b54c1cfa', '2025-08-12 07:52:09.87224-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85', true, '2025-08-12 07:52:09.87224-05', false, false) ON CONFLICT (parameter_id, fields_id) DO NOTHING;
