-- Module: create_highlight
-- Category: tool
-- Description: create_highlight MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a124-7187-a6e4-034aac70ac50', 'highlight_strength_id', 'The ID of the strength to add highlight to', 'string', true, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79ef-9e12-69bd48998585', '019c16d8-a124-7187-a6e4-034aac70ac50', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a124-71a8-a5fa-752e0ecae77a', 'highlight_section', 'The text section to highlight', 'string', true, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79f1-ad10-3fa59abbc41a', '019c16d8-a124-71a8-a5fa-752e0ecae77a', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a124-71cb-8d59-cbec8a1daedc', 'highlight_idx', 'The index position of the highlight', 'number', false, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79f5-9350-22c369668c94', '019c16d8-a124-71cb-8d59-cbec8a1daedc', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ee-7edc-b110-a9034ed4abdb', '019c16d8-a124-7187-a6e4-034aac70ac50', 'message_feedback_id', '{{ highlight_strength_id }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ef-7081-890e-32328d093070', '019c16d8-a124-71a8-a5fa-752e0ecae77a', 'section', '{{ highlight_section }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ef-721c-965e-e1d714cc6765', '019c16d8-a124-71cb-8d59-cbec8a1daedc', 'idx', '{{ highlight_idx }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7a12-b14d-edca9df539d9', 'Create a highlight for a strength in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7499-86b1-91ff8c56c55a', 'create_highlight', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c16d8-a124-7d9a-8547-20d809a13daa', '2026-02-01T01:37:01.720364+00:00', false, false, true, 'create_highlight', 'Create a highlight for a strength in the simulation', '{}', 'create', '{019c16d8-a124-7187-a6e4-034aac70ac50,019c16d8-a124-71a8-a5fa-752e0ecae77a,019c16d8-a124-71cb-8d59-cbec8a1daedc}', '{019c24ff-49ee-7edc-b110-a9034ed4abdb,019c24ff-49ef-7081-890e-32328d093070,019c24ff-49ef-721c-965e-e1d714cc6765}', '{}'::text[], '{highlights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c4e6b-2c29-79ef-9e12-69bd48998585', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c4e6b-2c29-79f1-ad10-3fa59abbc41a', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c4e6b-2c29-79f5-9350-22c369668c94', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-7187-a6e4-034aac70ac50', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-71a8-a5fa-752e0ecae77a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-71cb-8d59-cbec8a1daedc', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ee-7edc-b110-a9034ed4abdb', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ef-7081-890e-32328d093070', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ef-721c-965e-e1d714cc6765', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c164d-313e-7b7a-a8f5-ecda6c0eb2ea', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a128-7a12-b14d-edca9df539d9', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a128-7499-86b1-91ff8c56c55a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-7d9a-8547-20d809a13daa', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
