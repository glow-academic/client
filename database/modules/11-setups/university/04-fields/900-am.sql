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
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.874255-05', '2025-08-12 07:52:09.874255-05', '019b3be4-3255-7abb-b6e6-2e9c608895ec', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019b995c-8e9e-788a-87aa-27b4250bd2d7', '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019bb25e-e5f8-7dc6-aac8-1aec8f456e02', true, '2025-08-12 07:52:09.874255-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7abb-b6e6-2e9c608895ec', '019b995c-8e9b-7a0f-a19f-cba50e52b7f7', '2025-08-12 07:52:09.874255-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019b3be4-3255-7abb-b6e6-2e9c608895ec', '019bb25e-e5f8-7dc6-aac8-1aec8f456e02', true, '2025-08-12 07:52:09.874255-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
