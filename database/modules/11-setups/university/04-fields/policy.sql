-- Module: policy
-- Category: field
-- Description: policy field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a160-7251-b0bc-33dbff8e66a0', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7751-87fd-edc2107801de', 'Policy documents, guidelines, and regulations', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-04T13:22:00.014150+00:00', true, false, false, '019bb25e-e5f8-7cfd-bb05-98a1d9bcd20b', 'policy', 'Policy documents, guidelines, and regulations', NULL, '{}', '{019c04f5-a160-7251-b0bc-33dbff8e66a0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ef-b5c4-96edebab8aa9', 'policy', '2025-12-04T13:22:00.014150+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
