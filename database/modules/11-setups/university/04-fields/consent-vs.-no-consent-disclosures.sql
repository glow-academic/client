-- Module: Consent vs. No-Consent Disclosures
-- Category: field
-- Description: Consent vs. No-Consent Disclosures field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-784f-bccc-d6e92c15dcee', 'Understanding when consent is required vs. when disclosure is allowed without consent', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e5f8-7cee-88ca-ae96d7297994', 'Consent vs. No-Consent Disclosures', 'Understanding when consent is required vs. when disclosure is allowed without consent', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aee-9f2b-74ff78ff910e', 'Consent vs. No-Consent Disclosures', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
