-- Module: delete_cohort
-- Category: tool
-- Description: delete_cohort MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521d0-0003-7000-8000-000000000001', 'cohort_ids', 'Comma-separated UUIDs of cohorts to delete', 'string', true, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019521d0-0032-7000-8000-000000000001', 'delete_cohort', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019521d0-0022-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true, 'delete_cohort', 'Delete one or more cohorts by ID. Cohorts that are in use cannot be deleted. Supports bulk deletion (all-or-nothing transaction).', '{}', 'delete', '{019521d0-0003-7000-8000-000000000001}', '{}', '{}'::text[], '{}'::text[], '{cohort}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019521d0-0012-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', '2026-02-24T01:53:57.278464+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521d0-0012-7000-8000-000000000001', '019521d0-0003-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifacts_id, active, generated, mcp, created_at) VALUES ('019521d0-0012-7000-8000-000000000001', '019c8d5a-6426-7bd8-b8d2-e129a934f053', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (tool_id, artifacts_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019521d0-0012-7000-8000-000000000001', '019d0000-0001-7000-8000-000000000008', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019521d0-0012-7000-8000-000000000001', '019521d0-0032-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019521d0-0012-7000-8000-000000000001', '019521d0-0022-7000-8000-000000000001', true, '2026-02-24T01:53:57.278464+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
