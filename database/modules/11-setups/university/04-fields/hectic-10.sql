-- Module: Hectic (10)
-- Category: field
-- Description: Hectic (10) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7780-b5ef-5ed31b2cc8d3', 'The room is overflowing with students, with a hectic atmosphere and a very long wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d6d-8546-2d286f9becbe', 'Hectic (10)', 'The room is overflowing with students, with a hectic atmosphere and a very long wait.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a70-9f2e-9ae666250cbb', 'Hectic (10)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.869197-05', '2025-08-12 07:52:09.869197-05', '019b3be4-3255-7f81-980c-cff2da3f3e6b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019b995c-8e9e-7780-b5ef-5ed31b2cc8d3', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019bb25e-e5f8-7d6d-8546-2d286f9becbe', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f81-980c-cff2da3f3e6b', '019b995c-8e9b-7a70-9f2e-9ae666250cbb', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b3be4-3255-7f81-980c-cff2da3f3e6b', '019bb25e-e5f8-7d6d-8546-2d286f9becbe', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
