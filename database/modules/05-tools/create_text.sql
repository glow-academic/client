-- Module: create_text
-- Category: tool
-- Description: create_text MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-768f-9c96-37941363873a', 'content', 'The text content of the assistant response message', 'string', true, '', '2026-01-06T15:55:22.222790+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-780c-a3bf-31d0b0f33fdf', '019bbf87-091e-768f-9c96-37941363873a', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7811-a6b2-43b02a96cb12', '019bbf87-091f-741e-9750-ffa018c4a030', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7327-b2a1-f5fbde584a12', '019bbf87-091e-768f-9c96-37941363873a', 'content', '{{ content }}', '2026-01-06T15:55:22.222222+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7574-a90f-53d805c4f2d9', 'Create a text resource with content. The text will be linked to the message.', '2026-01-09T15:45:34.081783+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-74bd-a1f0-946b57dccf83', 'create_text', '2026-01-09T15:45:34.081783+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '2026-01-09T15:45:34.081783+00:00', '2026-01-09T15:45:34.081783+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019c4e6b-2c29-780c-a3bf-31d0b0f33fdf', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019c4e6b-2c29-7811-a6b2-43b02a96cb12', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-091e-768f-9c96-37941363873a', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbabc-5a32-7574-a90f-53d805c4f2d9', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019c4f27-1793-77e5-b514-13a4367ea529', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbabc-5a32-74bd-a1f0-946b57dccf83', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
