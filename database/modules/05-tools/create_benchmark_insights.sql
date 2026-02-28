-- Module: create_benchmark_insights
-- Category: tool
-- Description: create_benchmark_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('4b6e535a-a6f0-4ec3-8a54-99985151c2b2', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bc29427c-a058-424a-a55f-aaab18f679ca', '4b6e535a-a6f0-4ec3-8a54-99985151c2b2', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('cd448861-d8a3-4c1b-a61e-7126274412d6', '4b6e535a-a6f0-4ec3-8a54-99985151c2b2', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('a7b99863-f54c-4488-9631-0445a9abe8db', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c5fda15c-e42a-44e3-9611-6973f1d9b2ee', 'a7b99863-f54c-4488-9631-0445a9abe8db', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8cd51820-5147-4930-a542-ba7cfaa79cfd', 'a7b99863-f54c-4488-9631-0445a9abe8db', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('006009ef-7130-4f03-aa54-301323018878', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('482e0594-66c9-44b4-b4bd-a66bc2b68c24', '006009ef-7130-4f03-aa54-301323018878', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('35e2526b-ad5c-409b-8890-66b6448450b3', '006009ef-7130-4f03-aa54-301323018878', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('1b5ffaed-5b73-41ce-b101-90f9337d0516', 'Create a new benchmark insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('e03ea082-9184-446d-bbe0-9355eb0f3dcc', 'create_benchmark_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('6f728737-8402-4601-a7a0-8fc435caccba', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_benchmark_insights', 'Create a new benchmark insights entry', '{}', 'create', '{4b6e535a-a6f0-4ec3-8a54-99985151c2b2,a7b99863-f54c-4488-9631-0445a9abe8db,006009ef-7130-4f03-aa54-301323018878}', '{cd448861-d8a3-4c1b-a61e-7126274412d6,8cd51820-5147-4930-a542-ba7cfaa79cfd,35e2526b-ad5c-409b-8890-66b6448450b3}', '{}'::text[], '{benchmark_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', 'bc29427c-a058-424a-a55f-aaab18f679ca', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', 'c5fda15c-e42a-44e3-9611-6973f1d9b2ee', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '482e0594-66c9-44b4-b4bd-a66bc2b68c24', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '4b6e535a-a6f0-4ec3-8a54-99985151c2b2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', 'a7b99863-f54c-4488-9631-0445a9abe8db', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '006009ef-7130-4f03-aa54-301323018878', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', 'cd448861-d8a3-4c1b-a61e-7126274412d6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '8cd51820-5147-4930-a542-ba7cfaa79cfd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '35e2526b-ad5c-409b-8890-66b6448450b3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '018f0004-0001-7000-8000-000000000003', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '1b5ffaed-5b73-41ce-b101-90f9337d0516', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', 'e03ea082-9184-446d-bbe0-9355eb0f3dcc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('67da1bf7-ff8b-41fe-a177-4d56b3762fb6', '6f728737-8402-4601-a7a0-8fc435caccba', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
