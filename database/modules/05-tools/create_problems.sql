-- Module: create_problems
-- Category: tool
-- Description: create_problems MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('e72287fe-c0df-4c60-9b60-4c76d1e88ffb', 'problems', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('bca0468d-101b-424f-8a0e-ef9dbb5eeb41', 'type', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2637b98c-05d8-479a-b9ab-4f71d244276c', 'bca0468d-101b-424f-8a0e-ef9dbb5eeb41', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3686d0f0-45bb-4448-9e61-062d237d6e50', 'bca0468d-101b-424f-8a0e-ef9dbb5eeb41', 'type', '{{ type }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('03396c5a-86fc-4741-a2e6-e63d9ea744ae', 'message', '', 'string', false, 'No message provided', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ccf8998c-f220-40cf-ba1d-9f2c356d93c8', '03396c5a-86fc-4741-a2e6-e63d9ea744ae', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('718eb21a-b32e-4ca2-a1ca-20065239ecfd', '03396c5a-86fc-4741-a2e6-e63d9ea744ae', 'message', '{{ message }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('67190f0a-8a18-4bf5-bd62-a215299bf371', 'Create a new problems entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('6d48c43a-8f32-4cfa-9687-7776723eea1c', 'create_problems', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('7ebf4488-4a82-4a82-a117-a3cbda3fb2b2', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_problems', 'Create a new problems entry', '{}', 'create', '{bca0468d-101b-424f-8a0e-ef9dbb5eeb41,03396c5a-86fc-4741-a2e6-e63d9ea744ae}', '{3686d0f0-45bb-4448-9e61-062d237d6e50,718eb21a-b32e-4ca2-a1ca-20065239ecfd}', '{}'::text[], '{problems}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '2637b98c-05d8-479a-b9ab-4f71d244276c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', 'ccf8998c-f220-40cf-ba1d-9f2c356d93c8', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', 'bca0468d-101b-424f-8a0e-ef9dbb5eeb41', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '03396c5a-86fc-4741-a2e6-e63d9ea744ae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '3686d0f0-45bb-4448-9e61-062d237d6e50', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '718eb21a-b32e-4ca2-a1ca-20065239ecfd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', 'e72287fe-c0df-4c60-9b60-4c76d1e88ffb', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '67190f0a-8a18-4bf5-bd62-a215299bf371', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '6d48c43a-8f32-4cfa-9687-7776723eea1c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('90bf9409-c298-4e0d-9323-d140b384d63f', '7ebf4488-4a82-4a82-a117-a3cbda3fb2b2', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
