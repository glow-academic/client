-- Module: use_simulations
-- Category: tool
-- Description: use_simulations MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-781f-adab-974beb4f0386', 'simulation_id', '', 'string', true, '', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1784-79bf-864c-20472205f520', '019bbf87-091f-781f-adab-974beb4f0386', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1784-76d5-9eef-ce9079f403a2', 'Use an existing simulation resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1784-763e-8bed-395ba0ecde5b', 'use_simulations', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c4f27-1784-75b1-964f-dd416213ce49', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_simulations', 'Use an existing simulation resource instead of creating a new one', '{}', false, '{019bbf87-091f-781f-adab-974beb4f0386}', '{}', 'simulations') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019c4f27-1784-79bf-864c-20472205f520', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019bbf87-091f-781f-adab-974beb4f0386', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019c4f27-1784-76d5-9eef-ce9079f403a2', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019bbeb4-5115-74f5-9179-657359c788b8', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019c4f27-1784-763e-8bed-395ba0ecde5b', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-75d0-9950-598180128ba4', '019c4f27-1784-75b1-964f-dd416213ce49', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
