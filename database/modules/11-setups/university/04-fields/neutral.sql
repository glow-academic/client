-- Module: Neutral
-- Category: field
-- Description: Neutral field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7275-905c-ccfbcdd8a5d5', '019bb25e-e621-7030-880f-77ce9fc3a6fd', '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7828-84ab-f486eaaf5bee', 'Personas with neutral roles (Student, Professor, Instructional Staff)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7dd0-b701-64d18af393d9', 'Neutral', 'Personas with neutral roles (Student, Professor, Instructional Staff)', NULL, '{}', '{019c04f5-a160-7275-905c-ccfbcdd8a5d5}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aca-b3bf-1350cd583648', 'Neutral', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12 07:26:55.660542-06', '2025-12-12 07:26:55.660542-06', '019b3be4-3255-7fd9-ae49-680e884c7d5f', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019c04f5-a160-7275-905c-ccfbcdd8a5d5', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019b995c-8e9e-7828-84ab-f486eaaf5bee', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019bb25e-e5f8-7dd0-b701-64d18af393d9', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7fd9-ae49-680e884c7d5f', '019b995c-8e9b-7aca-b3bf-1350cd583648', '2025-12-12 07:26:55.660542-06', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c79-80fa-7ab7ea171647', '019b3be4-3255-7fd9-ae49-680e884c7d5f', '019bb25e-e5f8-7dd0-b701-64d18af393d9', true, '2025-12-12 07:26:55.660542-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
