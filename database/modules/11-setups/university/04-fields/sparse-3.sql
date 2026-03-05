-- Module: Sparse (3)
-- Category: field
-- Description: Sparse (3) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77ca-98f7-468911790298', 'A few students scattered around; very short or no wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d87-a4b1-bcd3fc820916', 'Sparse (3)', 'A few students scattered around; very short or no wait.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79a4-a0b5-14d7c295394b', 'Sparse (3)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.869197-05', '2025-08-12 07:52:09.869197-05', '019b3be4-3255-7f51-bdd6-846d84426500', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019b995c-8e9e-77ca-98f7-468911790298', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019bb25e-e5f8-7d87-a4b1-bcd3fc820916', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f51-bdd6-846d84426500', '019b995c-8e9b-79a4-a0b5-14d7c295394b', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b3be4-3255-7f51-bdd6-846d84426500', '019bb25e-e5f8-7d87-a4b1-bcd3fc820916', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
