-- Module: 5:00 PM
-- Category: field
-- Description: 5:00 PM field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-789c-95f4-f543aea247da', 'End of day session, students eager to finish.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7da8-b4cb-70247c1822cd', '5:00 PM', 'End of day session, students eager to finish.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a29-ac28-0f4e6f1e70b0', '5:00 PM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
