-- Module: End of week
-- Category: field
-- Description: End of week field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7784-b13b-beb8f523ed47', 'Deadline is at the end of the week. Ample time remains; stress is minimal.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d9a-8829-428958099860', 'End of week', 'Deadline is at the end of the week. Ample time remains; stress is minimal.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79fc-9115-b11bbbf2ee54', 'End of week', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b14-aa50-f3909de0706a', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019b995c-8e9e-7784-b13b-beb8f523ed47', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019bb25e-e5f8-7d9a-8829-428958099860', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b14-aa50-f3909de0706a', '019b995c-8e9b-79fc-9115-b11bbbf2ee54', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
