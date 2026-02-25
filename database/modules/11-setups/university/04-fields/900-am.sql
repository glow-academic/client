-- Module: 9:00 AM
-- Category: field
-- Description: 9:00 AM field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-788a-87aa-27b4250bd2d7', 'Early morning session, students may be tired but focused.', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.874255+00:00', true, false, false, '019bb25e-e5f8-7dc6-aac8-1aec8f456e02', '9:00 AM', 'Early morning session, students may be tired but focused.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a0f-a19f-cba50e52b7f7', '9:00 AM', '2025-08-12T12:52:09.874255+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
