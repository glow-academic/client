-- Module: Very Calm (1)
-- Category: field
-- Description: Very Calm (1) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77d3-b806-df2a5814fb89', 'The conversation is relaxed, with no signs of stress or urgency.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e09-9ae0-23cdc02687d3', 'Very Calm (1)', 'The conversation is relaxed, with no signs of stress or urgency.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a2c-8035-db756960c474', 'Very Calm (1)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
