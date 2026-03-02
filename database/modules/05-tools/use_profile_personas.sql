-- Module: use_profile_personas
-- Category: tool
-- Description: use_profile_personas tool (profile persona assignment)
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-22T23:46:41.084407+00:00', true, false, false, '00a47b46-e1a2-4ac4-be19-8416200778cb', 'profile_persona_id', '', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-22T23:46:41.084407+00:00', true, false, false, '98dfa8d8-31e9-4917-8c59-43fb8eedd84b', 'use_profile_personas', 'Use an existing profile persona assignment by its ID', '{}', 'link', '{00a47b46-e1a2-4ac4-be19-8416200778cb}', '{}', '{profile_personas}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
