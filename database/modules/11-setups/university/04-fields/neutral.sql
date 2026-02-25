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

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
