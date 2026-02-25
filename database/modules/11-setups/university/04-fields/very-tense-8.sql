-- Module: Very Tense (8)
-- Category: field
-- Description: Very Tense (8) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7775-808c-a787ba16adc5', 'The conversation is highly charged, with strong emotions and little calm.', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.872240+00:00', true, false, false, '019bb25e-e5f8-7e0f-939f-41d5799c4bb3', 'Very Tense (8)', 'The conversation is highly charged, with strong emotions and little calm.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7991-8a26-cf3a2c4c3da2', 'Very Tense (8)', '2025-08-12T12:52:09.872240+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
