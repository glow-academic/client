-- Module: Record Amendment Process
-- Category: field
-- Description: Record Amendment Process field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-784b-9c58-1a4070f7f9d6', 'Process for students to request amendment of education records', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cf0-8ebd-24767ba27236', 'Record Amendment Process', 'Process for students to request amendment of education records', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a9e-9a91-39e32cab5a55', 'Record Amendment Process', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
