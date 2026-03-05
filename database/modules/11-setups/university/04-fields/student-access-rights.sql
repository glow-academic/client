-- Module: Student Access Rights
-- Category: field
-- Description: Student Access Rights field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7725-a5ea-341a3fea5b91', 'Rights students have to access their education records', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', 'Student Access Rights', 'Rights students have to access their education records', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a48-823c-f141c3e84738', 'Student Access Rights', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02 17:06:38.169734-06', '2025-12-02 17:06:38.169734-06', '019b3be4-3255-7ec1-9d9b-654ea70cca34', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019b995c-8e9e-7725-a5ea-341a3fea5b91', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', '2025-12-02 17:06:38.169734-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7ec1-9d9b-654ea70cca34', '019b995c-8e9b-7a48-823c-f141c3e84738', '2025-12-02 17:06:38.169734-06', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7ec1-9d9b-654ea70cca34', '019bb25e-e5f8-7cf7-9bf8-831afbf7b736', true, '2025-12-02 17:06:38.169734-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
