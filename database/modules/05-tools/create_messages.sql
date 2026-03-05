-- Module: create_messages
-- Category: tool
-- Description: create_messages MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('eaea111a-1b91-46ee-83f7-292d54c30206', 'messages', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9c1aa98e-d9c4-4b32-8e5e-e4c264223d6d', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6d03b1db-ace2-450f-8d56-01be6dacbd34', '9c1aa98e-d9c4-4b32-8e5e-e4c264223d6d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('afe40a73-f358-403b-b196-ad0f747bd3f6', '9c1aa98e-d9c4-4b32-8e5e-e4c264223d6d', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('42f91605-8114-4f9d-90f7-71be2048bcd4', 'run_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c1e96204-f43b-483b-be8b-b4c2b2006971', '42f91605-8114-4f9d-90f7-71be2048bcd4', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1000afa5-bcd0-4c3a-810e-d0bee2227d69', '42f91605-8114-4f9d-90f7-71be2048bcd4', 'run_id', '{{ run_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('eebdbfe0-ef9f-4bdf-ba5a-5379e994f178', 'role', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c439f0f5-81b5-4233-b8d2-3be7f0faf009', 'eebdbfe0-ef9f-4bdf-ba5a-5379e994f178', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ac81c8d5-f6d6-425a-952b-1d9d3fc0f1ca', 'eebdbfe0-ef9f-4bdf-ba5a-5379e994f178', 'role', '{{ role }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8a49e70f-85fb-406e-b285-2c8d4261d1cb', 'text_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('df509bbc-4115-4161-8b23-d71aa0b9a0ba', '8a49e70f-85fb-406e-b285-2c8d4261d1cb', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3cd8ad5d-d299-4f0c-882f-49bb9e1ccfb8', '8a49e70f-85fb-406e-b285-2c8d4261d1cb', 'text_id', '{{ text_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('0c57360c-ccdf-4004-84ee-13f2a6b148bc', 'Create a new messages entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('f80c8b62-3ab1-4ecd-8e3c-5a819dbcc7e7', 'create_messages', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('b75d482d-1c5d-4bf4-9427-8f812e081102', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_messages', 'Create a new messages entry', '{}', 'create', '{9c1aa98e-d9c4-4b32-8e5e-e4c264223d6d,42f91605-8114-4f9d-90f7-71be2048bcd4,eebdbfe0-ef9f-4bdf-ba5a-5379e994f178,8a49e70f-85fb-406e-b285-2c8d4261d1cb}', '{afe40a73-f358-403b-b196-ad0f747bd3f6,1000afa5-bcd0-4c3a-810e-d0bee2227d69,ac81c8d5-f6d6-425a-952b-1d9d3fc0f1ca,3cd8ad5d-d299-4f0c-882f-49bb9e1ccfb8}', '{}'::text[], '{messages}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '6d03b1db-ace2-450f-8d56-01be6dacbd34', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'c1e96204-f43b-483b-be8b-b4c2b2006971', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'c439f0f5-81b5-4233-b8d2-3be7f0faf009', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'df509bbc-4115-4161-8b23-d71aa0b9a0ba', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '9c1aa98e-d9c4-4b32-8e5e-e4c264223d6d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '42f91605-8114-4f9d-90f7-71be2048bcd4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'eebdbfe0-ef9f-4bdf-ba5a-5379e994f178', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '8a49e70f-85fb-406e-b285-2c8d4261d1cb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'afe40a73-f358-403b-b196-ad0f747bd3f6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '1000afa5-bcd0-4c3a-810e-d0bee2227d69', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'ac81c8d5-f6d6-425a-952b-1d9d3fc0f1ca', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '3cd8ad5d-d299-4f0c-882f-49bb9e1ccfb8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entries_id, active, created_at, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'eaea111a-1b91-46ee-83f7-292d54c30206', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entries_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '0c57360c-ccdf-4004-84ee-13f2a6b148bc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'f80c8b62-3ab1-4ecd-8e3c-5a819dbcc7e7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('249a51ad-6191-4623-8f2a-eb9c526af503', 'b75d482d-1c5d-4bf4-9427-8f812e081102', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
