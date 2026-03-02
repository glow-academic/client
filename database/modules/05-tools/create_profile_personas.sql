-- Module: create_profile_personas
-- Category: tool
-- Description: create_profile_personas tool (profile persona creation)
-- ============================================================


-- Resource rows
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-22T23:46:41.084407+00:00', true, false, false, 'fb98d031-edcc-4945-a569-84083134b310', 'create_profile_personas', 'Create a new profile persona assignment', '{}', 'create', '{019c0a2d-fc3b-7e62-bcb0-75124c777dcd,019c4f27-1781-7589-8927-6eb5ddfb1472}', '{}', '{profile_personas}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
