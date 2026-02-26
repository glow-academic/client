-- Module: Some Students (4)
-- Category: field
-- Description: Some Students (4) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-776f-a2e9-4546257bffb1', 'Several students are present, but it is still easy to get help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d82-98f3-a088341077c2', 'Some Students (4)', 'Several students are present, but it is still easy to get help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7997-8741-065552fa0d5e', 'Some Students (4)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.869197-05', '2025-08-12 07:52:09.869197-05', '019b3be4-3255-7f5c-a207-f0102d63bbf4', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019b995c-8e9e-776f-a2e9-4546257bffb1', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019bb25e-e5f8-7d82-98f3-a088341077c2', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f5c-a207-f0102d63bbf4', '019b995c-8e9b-7997-8741-065552fa0d5e', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b3be4-3255-7f5c-a207-f0102d63bbf4', '019bb25e-e5f8-7d82-98f3-a088341077c2', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
