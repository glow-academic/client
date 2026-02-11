-- Module: all tools
-- Category: tools
-- Description: All MCP tool definitions
-- ============================================================

-- Tool: create_agents (019b9f61-8044-7991-809f-ba04e050729d)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-702b-97ab-7f9e5706ff64', 'Create a new agents resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7f9b-a09c-bd08c0e09b75', 'create_agents', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bde-91ab-92070869fe7f', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_agents', 'Create a new agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bbabc-5a30-702b-97ab-7f9e5706ff64', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bbeb4-5109-7671-b1cc-ed9a018d7c13', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bbabc-5a2f-7f9b-a09c-bd08c0e09b75', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8044-7991-809f-ba04e050729d', '019bebc4-d436-7bde-91ab-92070869fe7f', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_analysis (019c16d8-a126-7a29-8df7-fe06f8483301)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7a8a-bc70-358024b11fe5', 'analyses', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7ccf-b18e-217208ba3671', 'Create detailed analysis for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2d-73f6-95b2-b023574fb6ef', 'create_analysis', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bbb-bd65-5f158fd12e4d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_analysis', 'Create an analysis of audio messages from the conversation. Specify which messages (by their numbers in the conversation history) you want to analyze and what aspects you want to evaluate.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a123-7fb0-9fdb-a7ad98e9ee96', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a123-7fd8-8a2d-9bc685609689', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c24ff-49ef-7df9-a09c-cb548d564fff', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c24ff-49ef-7f77-bea7-67c82142ea36', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c164d-313e-7a8a-bc70-358024b11fe5', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a126-7ccf-b18e-217208ba3671', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019bbabc-5a2d-73f6-95b2-b023574fb6ef', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019bebc4-d436-7bbb-bd65-5f158fd12e4d', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_args (019bbf87-0970-7909-9c58-9364d2ab4ee3)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbf87-0970-7f19-89e2-c06890a6c133', 'Create an argument field for a tool', '2026-01-15T02:40:56.685940+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbf87-0970-797d-b4d7-bb236190b627', 'create_args', '2026-01-15T02:40:56.685940+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d16-8107-8dc0086e3182', '2026-01-15T02:40:56.685940+00:00', false, false, true, 'create_args', 'Create an argument field for a tool', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '2026-01-15T02:40:56.685940+00:00', '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-091e-7c1f-ae3b-6439894e0261', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-091e-7c3e-857c-86b00b58a5d4', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-091e-7c91-a41f-5c9a9219f7b2', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-0972-7bea-849b-024c52c5ae15', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-0972-7dd1-b28f-239775b346f9', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-0970-7f19-89e2-c06890a6c133', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bbf87-0970-797d-b4d7-bb236190b627', '2026-01-15T02:40:56.685940+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbf87-0970-7909-9c58-9364d2ab4ee3', '019bebc4-d436-7d16-8107-8dc0086e3182', true, '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_args_outputs (019bbf87-0974-7af6-abc6-bb91955d26d5)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7ce6-b24d-897cd8bc8d33', 'Create an output template for a tool argument', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7b5c-a7c9-fb7d0d8ae33b', 'create_args_outputs', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d1d-9e14-3299c8677730', '2026-01-15T02:40:56.692128+00:00', false, false, true, 'create_args_outputs', 'Create an output template for a tool argument', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '2026-01-15T02:40:56.692128+00:00', '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-091e-7b6c-9615-1e6c74921f0c', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0975-73f0-982a-48d791b45470', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7ce6-b24d-897cd8bc8d33', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7b5c-a7c9-fb7d0d8ae33b', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_audio (019ba36f-3993-7149-a59f-edcd695310bb)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7677-9602-9009e7f5e56a', 'Create an audio resource. The audio will be linked to the message.', '2026-01-09T15:45:34.098832+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-75e1-970c-b6e01e42bb13', 'create_audio', '2026-01-09T15:45:34.098832+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '2026-01-09T15:45:34.098832+00:00', '2026-01-09T15:45:34.098832+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbabc-5a32-7677-9602-9009e7f5e56a', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbeb4-510b-782f-817d-0077d1d7cef5', true, '2026-01-09T15:45:34.098832+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbabc-5a32-75e1-970c-b6e01e42bb13', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_auth (019b9f61-8045-7528-b157-d96892d96b73)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7122-aa50-825367e08476', 'Create a new auth resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-708c-926a-40efb3254d6e', 'create_auth', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7be1-9553-b722c5a74848', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_auth', 'Create a new auth resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbf87-091f-7106-807a-8c15887af9be', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbf87-091f-70e7-bb38-3aec3e65c691', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbf87-091f-7127-8a0f-e0ff158f148f', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbabc-5a30-7122-aa50-825367e08476', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbeb4-510b-7cb0-b8ff-b817a0f2cbf5', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bbabc-5a30-708c-926a-40efb3254d6e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8045-7528-b157-d96892d96b73', '019bebc4-d436-7be1-9553-b722c5a74848', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_cohorts (019b9f61-8045-7cb0-ae1a-5314a09d0c70)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-721d-857a-999896a0256a', 'Create a new cohorts resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-718d-a2cf-32cd290f2e0a', 'create_cohorts', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7be9-a1d4-e55d4017097e', '2026-01-17T17:57:40.632192+00:00', false, false, true, 'create_cohorts', 'Create a new cohorts resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bbabc-5a30-721d-857a-999896a0256a', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bbeb4-510c-7114-addc-b888b25bdb20', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bbabc-5a30-718d-a2cf-32cd290f2e0a', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8045-7cb0-ae1a-5314a09d0c70', '019bebc4-d436-7be9-a1d4-e55d4017097e', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_colors (019b9f61-8046-7081-8a69-c4d21045facd)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7319-8fe6-1e060e526287', 'Create a new colors resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7288-8046-043307916b37', 'create_colors', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bee-9d95-c252a477881d', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_colors', 'Create a new colors resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-091e-791a-86e3-fc5bef23008a', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbf87-096c-7760-8fb8-7183e16468ac', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbabc-5a30-7319-8fe6-1e060e526287', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbeb4-510c-7526-82cc-55a0480f1215', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bbabc-5a30-7288-8046-043307916b37', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7081-8a69-c4d21045facd', '019bebc4-d436-7bee-9d95-c252a477881d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_conditional_parameters (019bb563-1afa-79c6-9870-823a3f14a483)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7cf2-9ab5-732b3ed0dce7', 'Create a new conditional parameter resource', '2026-01-13T03:25:29.722192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7c4f-b08a-816e421efcc3', 'create_conditional_parameters', '2026-01-13T03:25:29.722192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '2026-01-13T03:25:29.722192+00:00', '2026-01-13T03:25:29.722192+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbf87-091f-73fa-8792-299a4c6e4bc0', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbf87-096c-7e02-bf85-9e4044aaf175', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbabc-5a32-7cf2-9ab5-732b3ed0dce7', '2026-01-13T03:25:29.722192+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T03:25:29.722192+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb563-1afa-79c6-9870-823a3f14a483', '019bbabc-5a32-7c4f-b08a-816e421efcc3', '2026-01-13T03:25:29.722192+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_content (019c16d8-a11e-776a-9db7-908c92e97660)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b16-9c19-0884b8c88542', 'contents', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a11f-7e44-971a-0effdcbb56a8', 'Create a content block for a message in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-72b9-961a-a389f7bc9bc6', 'create_content', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b60-9f57-f7c03f636fac', '2026-01-17T17:57:40.541181+00:00', false, false, true, 'create_content', 'Make a persona speak by calling this tool with the persona name and message. The persona name must match one of the available personas (case-insensitive matching is supported).', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-091e-7a33-aa90-781a6dc10b10', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-091e-768f-9c96-37941363873a', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', '2026-02-04T04:44:07.231669+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-096a-76f9-8b4d-4516886a1626', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c26f6-fecc-7f2a-a62f-d5fe00b4837e', '2026-02-04T04:44:07.231669+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c164d-313e-7b16-9c19-0884b8c88542', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c16d8-a11f-7e44-971a-0effdcbb56a8', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbabc-5a33-72b9-961a-a389f7bc9bc6', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bebc4-d436-7b60-9f57-f7c03f636fac', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_debug_info (019b71cc-0154-7343-b89d-96d865c3b7b8)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-78a5-b005-b2920ea64015', 'Provide debug information about the current state, context, or reasoning. Use this tool to output internal state, debugging details, or diagnostic information.', '2025-12-31T00:25:53.747819+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7779-92f8-5add97837e30', 'create_debug_info', '2025-12-31T00:25:53.747819+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '2025-12-31T00:25:53.747819+00:00', '2026-01-05T23:15:40.134472+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbf87-091e-768f-9c96-37941363873a', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbabc-5a2e-78a5-b005-b2920ea64015', '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbabc-5a2e-7779-92f8-5add97837e30', '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_departments (019b9f61-8046-754a-b616-808dacbb6b9a)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-741b-9908-9f16a872cd93', 'Create a new departments resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7386-8bb6-7b7ffda06ebb', 'create_departments', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbabc-5a30-741b-9908-9f16a872cd93', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbeb4-510c-7daf-9242-deed79a130df', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbabc-5a30-7386-8bb6-7b7ffda06ebb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:58:56.069266+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_descriptions (019b9f61-8046-78d0-9078-2c12eaffbd0d)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7513-b215-0cabd56da888', 'Create a new descriptions resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7483-91da-0a3b10a4dea7', 'create_descriptions', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bbabc-5a30-7513-b215-0cabd56da888', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bbeb4-510c-7ef2-9ede-574bcc96b9aa', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bbabc-5a30-7483-91da-0a3b10a4dea7', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-78d0-9078-2c12eaffbd0d', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_document_fields (019bf207-ca50-7037-ad70-eaa09e165bc4)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca50-796a-9a4a-1c698533717c', 'Create a document field resource for linking document-type parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca50-74d3-98df-24139cfce3d3', 'create_document_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bf207-ca51-72c1-b1ca-e06fd2334952', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_document_fields', 'Create a document field resource for linking document-type parameter fields to scenarios', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca50-796a-9a4a-1c698533717c', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca50-74d3-98df-24139cfce3d3', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca51-72c1-b1ca-e06fd2334952', true, '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_documents (019b9f61-8046-7c13-b2bb-b93b32a85dd5)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-760d-9904-5620e9e42d84', 'Create a new documents resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-757d-8d24-f68bf9f7325f', 'create_documents', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c08-b692-bc9a78583b57', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_documents', 'Create a new documents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bbabc-5a30-760d-9904-5620e9e42d84', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bbeb4-510d-7028-bf31-9136f3e10c9e', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bbabc-5a30-757d-8d24-f68bf9f7325f', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7c13-b2bb-b93b32a85dd5', '019bebc4-d436-7c08-b692-bc9a78583b57', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_emails (019bb553-e748-7d28-9baa-9874247afb73)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7ab9-8430-0c36d76891c6', 'Create a new email resource', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7a20-8257-bf67f764a542', 'create_emails', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cb5-b393-0f9756ccc867', '2026-01-17T17:57:40.632192+00:00', false, false, true, 'create_emails', 'Create a new email resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '2026-01-13T03:08:53.448220+00:00', '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbf87-091f-73ae-8758-02c3bcedd626', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbf87-096a-7898-b11e-0b1e1268c810', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbabc-5a32-7ab9-8430-0c36d76891c6', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbeb4-510d-7167-8c71-f15ede99a090', true, '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbabc-5a32-7a20-8257-bf67f764a542', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bebc4-d436-7cb5-b393-0f9756ccc867', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_endpoints (019ba034-3314-78bf-b711-03c5ebd25953)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7137-af9d-dd3768f1be0d', 'Create a new endpoint', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-70a3-b825-f78046bc3782', 'create_endpoints', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c81-832a-a4a08d2b50f6', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_endpoints', 'Create a new endpoint', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbf87-091f-700d-8c09-4765105cfba7', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbf87-0968-7699-ab4b-ef99310aea44', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019c2f13-4300-7c00-8000-000000000021', '2026-02-10T19:13:36.011239+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbabc-5a32-7137-af9d-dd3768f1be0d', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbeb4-510d-72b0-a995-a5531d642b85', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbabc-5a32-70a3-b825-f78046bc3782', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_evals (019b9f61-8046-7dda-8323-0a5613d30b21)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-77b3-893d-6c9dc1dc92f6', 'Create a new evals resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7677-8013-301236f27296', 'create_evals', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019bbabc-5a30-77b3-893d-6c9dc1dc92f6', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019bbeb4-510d-73ea-9b1d-959f7f8b5cdb', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7dda-8323-0a5613d30b21', '019bbabc-5a30-7677-8013-301236f27296', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_examples (019b9f61-8046-7f89-9e98-55ada7ea06c9)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-78b0-8fd7-7f51d7bd2ca9', 'Create a new examples resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-781c-a223-60afc48d9a4e', 'create_examples', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c0f-9471-cfe52d274678', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_examples', 'Create a new examples resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbf87-091e-7aff-956e-478264bfba4c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbf87-096a-7be8-96c2-0d6165087851', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbabc-5a30-78b0-8fd7-7f51d7bd2ca9', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbeb4-510d-7525-8c1a-349828997019', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbabc-5a30-781c-a223-60afc48d9a4e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bebc4-d436-7c0f-9471-cfe52d274678', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_feedback (019c16d8-a126-715d-9699-0140b7afddad)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b39-94cf-0f8755c0e9a8', 'feedbacks', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7433-8d42-692180a7ea4a', 'Create feedback for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-79b9-85e5-ef4376a017e1', 'create_feedback', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ba4-963e-758c7971447d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_feedback', 'Create a grade for the conversation on a specific standard group. Score should be an integer from 1-5 based on the rubric criteria. Provide brief feedback explaining the score with specific examples.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f0c-8e49-144fd344a1e3', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f65-ace0-006c414bed9c', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f93-b0ed-eccc63b7067c', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ec-7d9d-94b3-4935c374ee23', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ed-72ca-b5bf-2e3e55e3844d', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ed-752a-b110-0827ea43d37c', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c164d-313e-7b39-94cf-0f8755c0e9a8', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a126-7433-8d42-692180a7ea4a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019bbabc-5a2e-79b9-85e5-ef4376a017e1', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019bebc4-d436-7ba4-963e-758c7971447d', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_field (019b484d-9837-75a6-97f2-6cd03cb2bf7c)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7cc1-94c7-8ef9ee428408', 'Classify files as part of a specific parameter item. Provide a list of file numbers (as strings) that should be classified as the specified parameter item.', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7bc1-89a0-a01bd5175324', 'create_field', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b73-a506-0b196bce4ada', '2026-01-17T17:57:40.566652+00:00', false, false, true, 'create_field', 'Classify files as part of a specific parameter item. Provide a list of file numbers (as strings) that should be classified as the specified parameter item.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '2025-12-22T23:03:23.445951+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbabc-5a2e-7cc1-94c7-8ef9ee428408', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbeb4-510d-7790-bb69-2e3f34e2d23b', true, '2025-12-22T23:03:23.445951+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbabc-5a2e-7bc1-89a0-a01bd5175324', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_flags (019b9f61-8047-71c6-8140-a588e6b6c8ee)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-79ee-83f5-f9010455e88c', 'Create a new flags resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7919-9ccd-dce9f5415bf6', 'create_flags', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0965-7033-95af-445ff0be8f46', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbabc-5a30-79ee-83f5-f9010455e88c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbeb4-510d-78c7-8a11-7e2129f665df', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbabc-5a30-7919-9ccd-dce9f5415bf6', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_group_positions (019bbdce-83fe-76ad-8956-8ebb2b3d59a9)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-83ff-7399-a0f3-6c33163aa1a4', 'Create a new group_positions resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-79a4-8312-55da1341fdef', 'create_group_positions', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cd5-9cfb-f52df7b3d47d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_group_positions', 'Create a new group_positions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-7642-aa72-3507ef41149c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-7621-82c2-3fba8dc1a434', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0966-7a4f-9f39-c3832c18b46a', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0966-7aee-96c7-e5f169218818', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbdce-83ff-7399-a0f3-6c33163aa1a4', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbeb4-510f-7e91-8964-26fc754aaccc', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbdce-83fe-79a4-8312-55da1341fdef', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_groups (019bbdce-8401-7285-b3cb-a6a4cc61163d)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8401-755e-aa44-f1f1a9c0067c', 'Create a new groups resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8401-733b-ad45-c338847a5788', 'create_groups', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cdb-9b0e-0d85b487bde8', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_groups', 'Create a new groups resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbf87-091f-7642-aa72-3507ef41149c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbf87-0966-7aee-96c7-e5f169218818', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbdce-8401-755e-aa44-f1f1a9c0067c', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbeb4-5110-7549-b7cc-d1dfa7fadce1', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bbdce-8401-733b-ad45-c338847a5788', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8401-7285-b3cb-a6a4cc61163d', '019bebc4-d436-7cdb-9b0e-0d85b487bde8', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_groups_rubric_grade_agents (019bbdce-8403-7263-882c-cdc0fce2012b)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8403-74f0-9da1-572a2a8d08e6', 'Create a new groups_rubric_grade_agents resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8403-730a-b3f4-aa63f877a110', 'create_groups_rubric_grade_agents', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ce3-babd-f4ea7d97e54c', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_groups_rubric_grade_agents', 'Create a new groups_rubric_grade_agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-091f-7363-a53b-59c0c5d9656b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-091f-733e-8921-a259f7a4a804', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-0966-70de-ae41-beb4dd620fe1', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-0966-7185-b960-c6c580ea7096', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbdce-8403-74f0-9da1-572a2a8d08e6', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bbdce-8403-730a-b3f4-aa63f877a110', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8403-7263-882c-cdc0fce2012b', '019bebc4-d436-7ce3-babd-f4ea7d97e54c', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_highlight (019c16d8-a128-7352-b010-39432de8e0dc)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b7a-a8f5-ecda6c0eb2ea', 'highlights', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7a12-b14d-edca9df539d9', 'Create a highlight for a strength in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a128-7499-86b1-91ff8c56c55a', 'create_highlight', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c16d8-a124-7d9a-8547-20d809a13daa', '2026-02-01T01:37:01.720364+00:00', false, false, true, 'create_highlight', 'Create a highlight for a strength in the simulation', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-7187-a6e4-034aac70ac50', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-71a8-a5fa-752e0ecae77a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-71cb-8d59-cbec8a1daedc', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ee-7edc-b110-a9034ed4abdb', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ef-7081-890e-32328d093070', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c24ff-49ef-721c-965e-e1d714cc6765', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c164d-313e-7b7a-a8f5-ecda6c0eb2ea', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a128-7a12-b14d-edca9df539d9', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a128-7499-86b1-91ff8c56c55a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7352-b010-39432de8e0dc', '019c16d8-a124-7d9a-8547-20d809a13daa', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_hint (019c16d8-a123-7040-9a24-0fed772143a1)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b86-8d98-e5b0b959266b', 'hints', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a123-735a-97bb-02658124651d', 'Create a hint for a message in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7db7-a230-390bd0ff9a90', 'create_hint', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ba3-9c29-c24f308f6e56', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_hint', 'Create a strategic hint for the GTA. This is one of multiple hints that should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach). Call this tool multiple times to create multiple hints.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-091e-7a33-aa90-781a6dc10b10', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-091e-72cb-b3b5-5e90e16254b2', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-096a-76f9-8b4d-4516886a1626', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-0965-7d8c-b246-dd3411515aca', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019c164d-313e-7b86-8d98-e5b0b959266b', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019c16d8-a123-735a-97bb-02658124651d', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbabc-5a2e-7db7-a230-390bd0ff9a90', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bebc4-d436-7ba3-9c29-c24f308f6e56', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_html (019b8bf2-abb3-7f6d-ac6a-9032d1256c79)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7179-bc7b-53f2f6aacf53', 'Generate the Jinja template HTML for the document.', '2026-01-05T02:18:15.346868+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7046-ab29-7be1a681f3b1', 'create_html', '2026-01-05T02:18:15.346868+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bcc-b38a-2799877eb259', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_html', 'Generate the Jinja template HTML for the document.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '2026-01-05T02:18:15.346868+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbabc-5a2f-7179-bc7b-53f2f6aacf53', '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bbabc-5a2f-7046-ab29-7be1a681f3b1', '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b8bf2-abb3-7f6d-ac6a-9032d1256c79', '019bebc4-d436-7bcc-b38a-2799877eb259', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_icons (019b9f61-8047-7438-8acc-be622d119c23)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7aeb-bd23-5f3aaf543c49', 'Create a new icons resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7a59-ae39-a88e584ca51b', 'create_icons', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c1f-a77b-1140f364e2ef', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_icons', 'Create a new icons resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbabc-5a30-7aeb-bd23-5f3aaf543c49', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbeb4-5111-70d0-920d-65f36aa57797', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbabc-5a30-7a59-ae39-a88e584ca51b', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bebc4-d436-7c1f-a77b-1140f364e2ef', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_image (019b6ba0-df00-7bd2-b407-5171d2160010)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-72f4-8b5f-5d78ce295084', 'Create an image for this scenario. The image will be saved and linked to the scenario after generation completes.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7262-9160-03a9f5b74605', 'create_image', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b8d-adb8-3b17bafdda99', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_image', 'Create an image for this scenario. The image will be saved and linked to the scenario after generation completes.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbabc-5a2f-72f4-8b5f-5d78ce295084', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbeb4-5111-722e-a5fb-892e598293ac', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bbabc-5a2f-7262-9160-03a9f5b74605', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7bd2-b407-5171d2160010', '019bebc4-d436-7b8d-adb8-3b17bafdda99', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_improvement (019c16d8-a127-7a68-852f-bfcef6c0c4c4)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7b92-8e3c-113fa02e8ed0', 'improvements', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a127-7d18-a625-df9c533d3971', 'Create an improvement entry for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7373-9153-39a55562dee3', 'create_improvement', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bb7-964b-e3ad705be38d', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_improvement', 'Create improvement feedback for a specific message. Suggest improvements for this message in the conversation. You can optionally provide strikethrough/replace suggestions.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c16d8-a124-708b-8851-29cd4866002f', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c16d8-a124-70ad-b5a7-b380744c9db3', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c16d8-a124-70d6-bc1f-70888d53b9a2', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c16d8-a124-70f7-bb76-743aa9aae464', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c24ff-49ee-7630-8f04-db2b2fdccb6b', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c24ff-49ee-77c2-8c82-b90dd6fbab59', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c24ff-49ee-793b-8373-a80db875d497', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c24ff-49ee-7aa6-9c6b-bef6c3fa5bf4', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c164d-313e-7b92-8e3c-113fa02e8ed0', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019c16d8-a127-7d18-a625-df9c533d3971', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019bbabc-5a2f-7373-9153-39a55562dee3', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a127-7a68-852f-bfcef6c0c4c4', '019bebc4-d436-7bb7-964b-e3ad705be38d', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_instructions (019b9f61-8047-76b0-89c6-cfc77fe86861)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7c37-9d30-eab4c42a9a8e', 'Create a new instructions resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7ba1-b023-c6c20c8eb613', 'create_instructions', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c20-b35a-73c9819b708a', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_instructions', 'Create a new instructions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbf87-091e-7b6c-9615-1e6c74921f0c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbf87-0967-7186-9cad-d4af39fd98f9', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbabc-5a30-7c37-9d30-eab4c42a9a8e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbeb4-5111-74d0-9786-60cef5204f41', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbabc-5a30-7ba1-b023-c6c20c8eb613', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_items (019ba034-3316-70ea-971d-082721b6d2d9)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7247-863a-244c6f4cd7e4', 'Create a new item', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-71ad-a475-644065247b0f', 'create_items', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c8f-9f19-28ba6dc8519f', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_items', 'Create a new item', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091f-703e-9eaf-f12c50e333b6', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-7c5d-a34a-879167cadd9f', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-096a-71c8-9043-5abf3f80a0d0', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-096a-726f-808b-b9bf633dd02d', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbabc-5a32-7247-863a-244c6f4cd7e4', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbeb4-5111-762b-a56e-d0f80b5b3dc2', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbabc-5a32-71ad-a475-644065247b0f', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bebc4-d436-7c8f-9f19-28ba6dc8519f', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_keys (019b9f61-8047-78d2-a5fe-0d48dbacd10f)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7d38-9396-1f1b957c5e8a', 'Create a new keys resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7ca5-ae82-6cc3695c1ae0', 'create_keys', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c28-b7bf-f89de16c64d0', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_keys', 'Create a new keys resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbf87-091f-77de-b8e9-1160c499a3e7', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbf87-0969-7d40-b671-1bdfae5c96af', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbabc-5a30-7d38-9396-1f1b957c5e8a', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbeb4-5111-777c-8185-c318f7219be3', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bbabc-5a30-7ca5-ae82-6cc3695c1ae0', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-78d2-a5fe-0d48dbacd10f', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_modalities (019bbdce-8405-7075-a5fd-c72fc1d9d836)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8405-72e1-926d-e762f8d678dd', 'Create a new modalities resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8405-7105-bd58-c4b4f4bcacc3', 'create_modalities', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ce4-83f1-2299dc3bbd35', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_modalities', 'Create a new modalities resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbf87-091f-757c-916a-3921398ab373', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbf87-0969-7b09-902c-3f48e2fbff16', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbdce-8405-72e1-926d-e762f8d678dd', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbeb4-5111-7c8a-b167-11514bc1e2fa', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bbdce-8405-7105-bd58-c4b4f4bcacc3', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8405-7075-a5fd-c72fc1d9d836', '019bebc4-d436-7ce4-83f1-2299dc3bbd35', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_models (019b9f61-8047-7a87-a2f9-a6dc91777744)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7e39-8004-8d028b178fa4', 'Create a new models resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7da5-acf4-36b1c4099f22', 'create_models', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c2e-af8f-40ed4aa3edaf', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_models', 'Create a new models resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbabc-5a30-7e39-8004-8d028b178fa4', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbeb4-5111-7de9-bf6e-964d147895a4', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bbabc-5a30-7da5-acf4-36b1c4099f22', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7a87-a2f9-a6dc91777744', '019bebc4-d436-7c2e-af8f-40ed4aa3edaf', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_names (019b9f61-8047-7c3f-aa8a-8f5ea051145f)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7f5f-bcdc-78c31ab2e8d2', 'Create a new names resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7ea2-8b7e-918195899a91', 'create_names', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bbabc-5a30-7f5f-bcdc-78c31ab2e8d2', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bbeb4-5111-7f3e-9db1-41fffe130b8c', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bbabc-5a30-7ea2-8b7e-918195899a91', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7c3f-aa8a-8f5ea051145f', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_objective (019b6ba0-df00-79f5-9e03-1e507b91adfd)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7501-b98f-772b38484aa8', 'Create a learning objective for this scenario. Objectives should be specific, measurable, relate to pedagogical skills or subject matter knowledge, and be achievable within a single chat interaction. Call this tool multiple times to create multiple objectives.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7472-9202-f6a6d9729723', 'create_objective', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b8b-8443-f82efdfd5790', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_objective', 'Create a learning objective for this scenario. Objectives should be specific, measurable, relate to pedagogical skills or subject matter knowledge, and be achievable within a single chat interaction. Call this tool multiple times to create multiple objectives.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbf87-091e-7778-8b79-b9c01c9861cd', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbf87-0966-77df-9c22-cee11b4f4d31', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbabc-5a2f-7501-b98f-772b38484aa8', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbeb4-5112-708a-806d-7d695f766105', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbabc-5a2f-7472-9202-f6a6d9729723', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bebc4-d436-7b8b-8443-f82efdfd5790', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_options (019b914c-a3ea-713a-887e-99bcbfb9559a)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-75f6-a1d1-b118a72f3b90', 'Create options for questions. Options can be reused across multiple questions.', '2026-01-06T03:14:37.673953+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-756c-b920-779fb0231d5f', 'create_options', '2026-01-06T03:14:37.673953+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bd2-b670-e4c1b24b1a9c', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_options', 'Create options for questions. Options can be reused across multiple questions.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '2026-01-06T03:14:37.673953+00:00', '2026-01-06T03:14:37.673953+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-091e-77b5-92b4-feb05ac43179', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-091e-7799-8255-23920ae8e5d4', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-0969-730a-a621-2bf047d7f1ac', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-0969-73a6-b096-1b124b50944a', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbabc-5a2f-75f6-a1d1-b118a72f3b90', '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbeb4-5112-71e5-8c71-64f004201157', true, '2026-01-06T03:14:37.673953+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbabc-5a2f-756c-b920-779fb0231d5f', '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bebc4-d436-7bd2-b670-e4c1b24b1a9c', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_parameter_fields (019bf207-ca51-76d3-a977-6a923e5d077d)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca51-7c58-9d6d-006956cceba8', 'Create a parameter field resource for linking general parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca51-78e3-9180-7137e464c932', 'create_parameter_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_parameter_fields', 'Create a parameter field resource for linking general parameter fields to scenarios', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c06a8-2afd-75f5-bc5e-84761794a3d6', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c06a8-2afd-7619-95b4-0c0252b8e5ee', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c48f5-89d8-76c3-a4f8-56bad0f21043', '2026-02-10T19:09:37.107316+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c48f5-89d9-7414-a395-bd6c07cbf197', '2026-02-10T19:09:37.107316+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca51-7c58-9d6d-006956cceba8', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca51-78e3-9180-7137e464c932', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_parameters (019b9f61-8047-7e34-af40-233fa28bb85b)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-705e-90a6-5911ba105865', 'Create a new parameters resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7fca-b7b7-950e65c6b4cb', 'create_parameters', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c3e-b71d-a48e787dafc1', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_parameters', 'Create a new parameters resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bbabc-5a31-705e-90a6-5911ba105865', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bbeb4-5112-7322-9f99-432c193ef502', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bbabc-5a30-7fca-b7b7-950e65c6b4cb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7e34-af40-233fa28bb85b', '019bebc4-d436-7c3e-b71d-a48e787dafc1', true, '2026-01-17T17:58:56.069266+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_persona_fields (019bf207-ca32-790d-921f-005560cc0942)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca45-7ac5-9a3a-e16046a16eb2', 'Create a persona field resource for linking persona-type parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca33-73b2-9ad0-8eccbb02e690', 'create_persona_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bf207-ca4b-7fcd-8c58-15d372105878', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_persona_fields', 'Create a persona field resource for linking persona-type parameter fields to scenarios', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca45-7ac5-9a3a-e16046a16eb2', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca33-73b2-9ad0-8eccbb02e690', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca4b-7fcd-8c58-15d372105878', true, '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_personas (019b9f61-8047-7fdd-b6b8-e534e56424a9)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-715e-a209-6881379f0228', 'Create a new personas resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-70c8-aea6-27f51144a393', 'create_personas', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c46-a65d-2b9f3dc7776d', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_personas', 'Create a new personas resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bbabc-5a31-715e-a209-6881379f0228', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bbeb4-5112-745f-9ae9-c8e64ca14d91', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bbabc-5a31-70c8-aea6-27f51144a393', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7fdd-b6b8-e534e56424a9', '019bebc4-d436-7c46-a65d-2b9f3dc7776d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_points (019b9f61-8048-719b-a6ab-b1b122c0eb49)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-725e-a959-bcc0f6db87d5', 'Create a new points resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-71cb-b2f2-17c8eed33688', 'create_points', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c48-bbb0-2700d1deb830', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_points', 'Create a new points resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbabc-5a31-725e-a959-bcc0f6db87d5', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbeb4-5112-7598-af4d-23b2c7581e1c', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbabc-5a31-71cb-b2f2-17c8eed33688', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bebc4-d436-7c48-bbb0-2700d1deb830', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_pricing (019bbdce-8407-7072-acff-f9e6ec5cd57c)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8407-73c6-a1ef-e3fc35fe6497', 'Create a new pricing resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7169-b1ab-973299ca2fca', 'create_pricing', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cec-b8a7-a31628d74ae4', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_pricing', 'Create a new pricing resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75e9-9af5-7d2da24c2050', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75a4-9e6c-d441e8dd9326', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75ca-aab8-283cc10f1b5b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-7826-a67e-a8786d4f3811', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-7950-a100-a0954e8a7beb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-79f7-9d76-32153a640f21', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbdce-8407-73c6-a1ef-e3fc35fe6497', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbeb4-5112-7a00-bd3a-06796620f457', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbdce-8407-7169-b1ab-973299ca2fca', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bebc4-d436-7cec-b8a7-a31628d74ae4', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_profiles (019b9f61-8048-73d3-8482-a93ceeefc5e1)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7363-af70-0a2d2917cd38', 'Create a new profiles resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-72ca-916c-e80d7fb3fd79', 'create_profiles', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c57-8749-ec4eb700f078', '2026-01-17T17:57:40.639882+00:00', false, false, true, 'create_profiles', 'Create a new profiles resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bbabc-5a31-7363-af70-0a2d2917cd38', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bbeb4-5112-7c71-835b-15a300ba3d2a', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bbabc-5a31-72ca-916c-e80d7fb3fd79', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-73d3-8482-a93ceeefc5e1', '019bebc4-d436-7c57-8749-ec4eb700f078', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_prompt (019b8a99-244b-70fe-a17c-a689c3356a67)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-76ee-8364-040eb6a93539', 'Set system prompt', '2026-01-04T20:00:50.761743+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7662-9662-3386644a6029', 'create_prompt', '2026-01-04T20:00:50.761743+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bc7-a392-37e8b4549478', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_prompt', 'Set system prompt', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '2026-01-04T20:00:50.761743+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-77db-8e1b-386592353bee', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0968-7e95-904a-7416c06e0117', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbabc-5a2f-76ee-8364-040eb6a93539', '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbeb4-5112-7db2-87d9-0f26b04d3ffe', true, '2026-01-04T20:00:50.761743+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbabc-5a2f-7662-9662-3386644a6029', '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bebc4-d436-7bc7-a392-37e8b4549478', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_protocols (019ba034-3316-767a-a5de-ba418c62676c)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-734a-8e28-618edc0c51e2', 'Create a new protocol', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-72b5-803c-5115bb8e3496', 'create_protocols', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c96-b29a-80cc1f4d73b1', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_protocols', 'Create a new protocol', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbabc-5a32-734a-8e28-618edc0c51e2', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbeb4-5112-7eee-9fad-3bd63f172a5c', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbabc-5a32-72b5-803c-5115bb8e3496', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bebc4-d436-7c96-b29a-80cc1f4d73b1', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_providers (019b9f61-8048-75a3-8fba-9d76171470ed)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-745f-b7b4-08d348f45b7c', 'Create a new providers resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-73cf-8b21-4178b7b8e3a4', 'create_providers', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c5e-b441-5b0c8673e4db', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_providers', 'Create a new providers resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-091f-7713-8183-d5f81f342c75', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-0966-7981-9b50-b7ac4f8bbb63', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbabc-5a31-745f-b7b4-08d348f45b7c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbeb4-5113-7030-b93a-5ab053c805e3', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbabc-5a31-73cf-8b21-4178b7b8e3a4', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_qualities (019bbdce-8407-78da-ba4b-34de4d253d09)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7b8d-afdc-42fd4a3b935c', 'Create a new qualities resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8407-793e-8532-3de81e0e8bb6', 'create_qualities', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cf0-9617-f44d4e7a6d71', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_qualities', 'Create a new qualities resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbf87-091f-754c-898b-d84a77ff7109', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbf87-096d-7363-8bfb-2816be51eddd', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbdce-8407-7b8d-afdc-42fd4a3b935c', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbeb4-5113-7474-82ad-730fbdf768cc', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bbdce-8407-793e-8532-3de81e0e8bb6', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-78da-ba4b-34de4d253d09', '019bebc4-d436-7cf0-9617-f44d4e7a6d71', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_question (019b6ba0-df00-7ee6-bc44-ff4838882638)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-77e1-8793-470ee1640456', 'Create a question for this scenario. Call this tool multiple times to create multiple questions. Each question should have question_text, allow_multiple (bool), and options (list of dicts with option_text, type, is_correct).', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-775a-a1ae-0812ed786ea0', 'create_question', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b9b-b92c-009fbdb67144', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_question', 'Create a question for this scenario. Call this tool multiple times to create multiple questions. Each question should have question_text, allow_multiple (bool), and options (list of dicts with option_text, type, is_correct).', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-714c-996e-354ec1bfe55c', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-782d-a354-e241b501acf0', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-780f-bf1c-471c78396711', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-75d9-9f22-1a7168fe0cda', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-767c-98b2-9124ff0b40cb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-771d-b1fd-cd7999e7fa59', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbabc-5a2f-77e1-8793-470ee1640456', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbeb4-5113-75c6-a321-30581b6e8b9c', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbabc-5a2f-775a-a1ae-0812ed786ea0', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bebc4-d436-7b9b-b92c-009fbdb67144', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_reasoning_levels (019bb58e-0ada-7886-8db7-c68c05efa549)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7e01-bb91-df3b8be71c02', 'Create a new reasoning level resource', '2026-01-13T04:12:23.642151+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7d65-b8b3-404c1b91280f', 'create_reasoning_levels', '2026-01-13T04:12:23.642151+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cc0-a482-5c0fad4f04e9', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_reasoning_levels', 'Create a new reasoning level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '2026-01-13T04:12:23.642151+00:00', '2026-01-13T04:12:23.642151+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-7463-ac69-28fe806f87bd', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0967-7b32-bb96-972e1ea88687', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0967-7bf2-b5ab-6d792c04add7', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbabc-5a32-7e01-bb91-df3b8be71c02', '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbeb4-5113-77a6-82d8-be8928536557', true, '2026-01-13T04:12:23.642151+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbabc-5a32-7d65-b8b3-404c1b91280f', '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_replacement (019c16d8-a128-7f6f-a6f8-c9c5aa236504)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7be3-a5b9-4d6f68c68dd6', 'replacements', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a129-71ef-9cd4-eb0aefbf637e', 'Create a replacement suggestion for an improvement in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a129-70c3-802d-49c1ae883e63', 'create_replacement', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c16d8-a125-7364-8818-8035df41de53', '2026-02-01T01:37:01.720364+00:00', false, false, true, 'create_replacement', 'Create a replacement suggestion for an improvement in the simulation', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a124-71f7-9577-af43b8f435c2', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a124-7228-988e-a69fc1de46f5', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a124-724f-af64-0b725e117645', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a124-726e-bdd2-87bf7d5813a4', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c24ff-49ef-761e-963a-16e0c0f71aad', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c24ff-49ef-7793-8206-9c445038845f', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c24ff-49ef-7907-90f3-79b220cf4be3', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c24ff-49ef-7a9e-823f-403a0f1d03d7', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c164d-313e-7be3-a5b9-4d6f68c68dd6', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a129-71ef-9cd4-eb0aefbf637e', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a129-70c3-802d-49c1ae883e63', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a128-7f6f-a6f8-c9c5aa236504', '019c16d8-a125-7364-8818-8035df41de53', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_request_limits (019bb553-e74c-7cb6-8868-d9bace1610dd)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7bc1-9d27-945bcfb9e408', 'Create a new request limit resource', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7b2b-a01d-8db087986591', 'create_request_limits', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cbe-a7bf-4b364674f3e0', '2026-01-17T17:57:40.632192+00:00', false, false, true, 'create_request_limits', 'Create a new request limit resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '2026-01-13T03:08:53.448220+00:00', '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbf87-091f-73d5-a8ad-732972c98ac4', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbf87-096b-7282-bdf7-f2c69c7c928c', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbabc-5a32-7bc1-9d27-945bcfb9e408', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbeb4-5113-7921-8e56-c68491eeb0ff', true, '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbabc-5a32-7b2b-a01d-8db087986591', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bebc4-d436-7cbe-a7bf-4b364674f3e0', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_response (019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-78e7-b6f3-3662dd69cf19', 'Create a response linking a question to an option. Responses represent user selections in quizzes.', '2026-01-06T03:53:12.392779+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7858-8b1a-51d774212a65', 'create_response', '2026-01-06T03:53:12.392779+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bd9-a072-6590e24dbc21', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_response', 'Create a response linking a question to an option. Responses represent user selections in quizzes.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '2026-01-06T03:53:12.392779+00:00', '2026-01-06T03:53:12.392779+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-091e-784e-8a7c-562ef0c4725d', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-091e-786e-bbff-3e50b51a7cd1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-0968-7995-8f2b-285611270c53', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-0968-7a39-8b5d-8ab0e285f6f6', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbabc-5a2f-78e7-b6f3-3662dd69cf19', '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbabc-5a2f-7858-8b1a-51d774212a65', '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bebc4-d436-7bd9-a072-6590e24dbc21', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_rubrics (019b9f61-8048-7749-8eb0-e30ab8ecb358)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-755d-8003-f2e3b9e3d747', 'Create a new rubrics resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-74cd-94d2-8e2153783ce5', 'create_rubrics', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbabc-5a31-755d-8003-f2e3b9e3d747', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbeb4-5113-7d68-9619-8da923c04169', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbabc-5a31-74cd-94d2-8e2153783ce5', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_run_positions (019bbdce-8407-7e9e-8950-f113ffb9cc95)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7fd7-92c8-561d993c8cb0', 'Create a new run_positions resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7ee1-bd30-83ea7680a3f8', 'create_run_positions', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cfa-abc2-0b12c8166a91', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_run_positions', 'Create a new run_positions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-091f-76bc-b6e2-a34bca37f12d', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-091f-7621-82c2-3fba8dc1a434', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-0966-7a4f-9f39-c3832c18b46a', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-0967-72eb-9d83-366f75833a50', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbdce-8407-7fd7-92c8-561d993c8cb0', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbeb4-5114-7034-9626-af787df74d5d', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bbdce-8407-7ee1-bd30-83ea7680a3f8', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7e9e-8950-f113ffb9cc95', '019bebc4-d436-7cfa-abc2-0b12c8166a91', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_runs (019bbdce-8408-75ce-81b3-c505baefbe9f)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8408-771b-b51f-702aa4aec91b', 'Create a new runs resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7615-89fc-f48339014eb0', 'create_runs', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cfd-9d16-5083f373be80', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_runs', 'Create a new runs resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-091f-76bc-b6e2-a34bca37f12d', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-0967-72eb-9d83-366f75833a50', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbdce-8408-771b-b51f-702aa4aec91b', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbeb4-5114-72d4-b96a-9fd8355f0946', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbdce-8408-7615-89fc-f48339014eb0', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bebc4-d436-7cfd-9d16-5083f373be80', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_runs_rubric_grade_agents (019bbdce-8408-7a57-a6ec-eed48ba6f201)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7b8d-80ca-2458e4e93155', 'Create a new runs_rubric_grade_agents resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7a91-b042-5e2d961d381d', 'create_runs_rubric_grade_agents', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d07-9685-efb55bdcac10', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_runs_rubric_grade_agents', 'Create a new runs_rubric_grade_agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-091f-733e-8921-a259f7a4a804', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-091f-7363-a53b-59c0c5d9656b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-0966-70de-ae41-beb4dd620fe1', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-0966-7185-b960-c6c580ea7096', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbdce-8408-7b8d-80ca-2458e4e93155', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bbdce-8408-7a91-b042-5e2d961d381d', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-7a57-a6ec-eed48ba6f201', '019bebc4-d436-7d07-9685-efb55bdcac10', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_scenario_flags (019bbdce-8408-7e3b-83eb-98c7d8953380)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7f66-8f29-a70fc93f092e', 'Create a new scenario_flags resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e72-b506-c305a516479d', 'create_scenario_flags', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d09-a5fb-d51eae133785', '2026-01-17T17:57:40.541885+00:00', false, false, true, 'create_scenario_flags', 'Create a new scenario_flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0965-7033-95af-445ff0be8f46', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbdce-8408-7f66-8f29-a70fc93f092e', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbeb4-5114-7893-8560-ee7cb288b34b', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbdce-8408-7e72-b506-c305a516479d', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bebc4-d436-7d09-a5fb-d51eae133785', true, '2026-01-17T17:57:40.541885+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_scenario_positions (019bb544-12d5-7ea5-9c7b-0d6082a02d61)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-79b3-8fa1-ddb6a2056a31', 'Create a new scenario position resource to set ordering of scenarios within simulations', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-791a-8eee-2372b2ca5924', 'create_scenario_positions', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cb0-a120-7762b81276c3', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_scenario_positions', 'Create a new scenario position resource to set ordering of scenarios within simulations', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '2026-01-13T02:51:36.016365+00:00', '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091f-781f-adab-974beb4f0386', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-096b-74ae-a967-e642fef0a546', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbabc-5a32-79b3-8fa1-ddb6a2056a31', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbeb4-5114-79ea-bfe0-901d3d172d9c', true, '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbabc-5a32-791a-8eee-2372b2ca5924', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bebc4-d436-7cb0-a120-7762b81276c3', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_scenario_rubric_grade_agents (019bb544-12d5-79bb-a26d-d2c112eb55bd)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-78ac-b274-cc12ae3a5ee1', 'Create a new scenario rubric grade agent resource', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-780e-acaf-b9543028ab5b', 'create_scenario_rubric_grade_agents', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ca5-9162-a03a395231f4', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_scenario_rubric_grade_agents', 'Create a new scenario rubric grade agent resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '2026-01-13T02:51:36.016365+00:00', '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-733e-8921-a259f7a4a804', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-7363-a53b-59c0c5d9656b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-70de-ae41-beb4dd620fe1', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-7185-b960-c6c580ea7096', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbabc-5a32-78ac-b274-cc12ae3a5ee1', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbabc-5a32-780e-acaf-b9543028ab5b', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bebc4-d436-7ca5-9162-a03a395231f4', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_scenarios (019b9f61-8048-7b88-9b5a-abdf0cde7814)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7684-bc95-3f9927f24e2c', 'Create a new scenarios resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-75ca-a8e0-96777e237d5a', 'create_scenarios', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c64-bb24-5aaac29b8481', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_scenarios', 'Create a new scenarios resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bbabc-5a31-7684-bc95-3f9927f24e2c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bbeb4-5114-7d6f-b639-917c2d4e0b9b', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bbabc-5a31-75ca-a8e0-96777e237d5a', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-7b88-9b5a-abdf0cde7814', '019bebc4-d436-7c64-bb24-5aaac29b8481', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_schema (019b8bf2-abb4-7208-86bd-df0b31626e01)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-79e0-8c0a-fc4437730710', 'Generate the TemplateSchema JSON for template context.', '2026-01-05T02:18:15.346868+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7950-ab10-b8daa314523b', 'create_schema', '2026-01-05T02:18:15.346868+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b8bf2-abb4-7208-86bd-df0b31626e01', '2026-01-05T02:18:15.346868+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb4-7208-86bd-df0b31626e01', '019bbabc-5a2f-79e0-8c0a-fc4437730710', '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b8bf2-abb4-7208-86bd-df0b31626e01', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b8bf2-abb4-7208-86bd-df0b31626e01', '019bbabc-5a2f-7950-ab10-b8daa314523b', '2026-01-05T02:18:15.346868+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_schema_field_items (019b9f61-8048-7d2e-8b98-2270c1387871)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7796-83f6-e5027d68aac9', 'Create a new schema_field_items resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-76f5-bea0-da5e61578461', 'create_schema_field_items', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbf87-091e-7bd3-aaa1-c5059798f2a0', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbf87-091e-7b9f-a4e5-e1663a397139', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbf87-0966-7ecc-bc09-b15e5976cffd', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbf87-096c-755e-8004-3a44c4a0d278', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbabc-5a31-7796-83f6-e5027d68aac9', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7d2e-8b98-2270c1387871', '019bbabc-5a31-76f5-bea0-da5e61578461', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_schema_fields (019b9f61-8048-7f8c-8512-6bb25057f090)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7899-af34-be5ae32fe99e', 'Create a new schema_fields resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7805-b65f-ac4302e6daa8', 'create_schema_fields', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7c3e-857c-86b00b58a5d4', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7b6c-9615-1e6c74921f0c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7c1f-ae3b-6439894e0261', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7c5d-a34a-879167cadd9f', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7bf0-a5c2-4836f9e822cf', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-7c91-a41f-5c9a9219f7b2', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-096b-79be-a1fb-611b5e58dc33', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-096b-7b2c-a211-1aa2a6c8cf45', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-096b-7bcd-9d8c-58b7baf1df30', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-096a-726f-808b-b9bf633dd02d', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-0967-7186-9cad-d4af39fd98f9', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbf87-096b-7e7c-aa35-f2422382f8e9', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbabc-5a31-7899-af34-be5ae32fe99e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7f8c-8512-6bb25057f090', '019bbabc-5a31-7805-b65f-ac4302e6daa8', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_settings (019b9f61-8049-73bf-88ba-d087f26a1e3a)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-799c-8a01-d20edd68cd4b', 'Create a new settings resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7904-86d3-4e0ccbf83ad0', 'create_settings', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c69-983a-589b59713462', '2026-01-17T17:57:40.636093+00:00', false, false, true, 'create_settings', 'Create a new settings resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bbabc-5a31-799c-8a01-d20edd68cd4b', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bbeb4-5115-7282-b3e6-f07cde27cb35', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bbabc-5a31-7904-86d3-4e0ccbf83ad0', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-73bf-88ba-d087f26a1e3a', '019bebc4-d436-7c69-983a-589b59713462', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_simulation_positions (019bd836-3ae3-71a0-990d-b5c0fa015cd0)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bd836-3ae4-7267-af9c-380b1cebb553', 'Create a new simulation position resource to set ordering of simulations within cohorts', '2026-01-19T21:43:11.312843+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bd836-3ae3-73c8-901f-24564dff13a4', 'create_simulation_positions', '2026-01-19T21:43:11.312843+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d28-8f22-23d852477486', '2026-01-19T21:43:11.312843+00:00', false, false, true, 'create_simulation_positions', 'Create a new simulation position resource to set ordering of simulations within cohorts', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '2026-01-19T21:43:11.312843+00:00', '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-091f-781f-adab-974beb4f0386', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-096b-74ae-a967-e642fef0a546', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019c48f6-4a52-73c5-9e33-08bdb39628b8', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae4-7267-af9c-380b1cebb553', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae2-703b-9d67-f64fab2b69d0', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae3-73c8-901f-24564dff13a4', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_simulation_scenario_flags (019bb544-12d1-7a6e-976c-26746e49cc96)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7780-8efc-5b3bdae8cc32', 'Create a new simulation scenario flag resource', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-76e4-a0a8-69f64ae2d595', 'create_simulation_scenario_flags', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ca1-9745-8839ef7b8951', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_simulation_scenario_flags', 'Create a new simulation scenario flag resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '2026-01-13T02:51:36.016365+00:00', '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbf87-0965-7033-95af-445ff0be8f46', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbabc-5a32-7780-8efc-5b3bdae8cc32', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bbabc-5a32-76e4-a0a8-69f64ae2d595', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb544-12d1-7a6e-976c-26746e49cc96', '019bebc4-d436-7ca1-9745-8839ef7b8951', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_simulations (019b9f61-8049-757d-b7fb-cc27ec2cd3de)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7a9b-93ac-3917d43d0042', 'Create a new simulations resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7a0b-b41b-e0de78db399c', 'create_simulations', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c72-8184-67ecec04e62e', '2026-01-17T17:57:40.639882+00:00', false, false, true, 'create_simulations', 'Create a new simulations resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bbabc-5a31-7a9b-93ac-3917d43d0042', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bbeb4-5115-74f5-9179-657359c788b8', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bbabc-5a31-7a0b-b41b-e0de78db399c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-757d-b7fb-cc27ec2cd3de', '019bebc4-d436-7c72-8184-67ecec04e62e', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_slugs (019ba034-3316-7baa-8ec9-8324497eb095)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-744f-b38c-6449dfbf49be', 'Create a new slug', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-73b5-aabd-3d739bbc7b93', 'create_slugs', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c99-9c5d-1d6d7e0aeb46', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_slugs', 'Create a new slug', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbabc-5a32-744f-b38c-6449dfbf49be', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbeb4-5115-7637-981c-4731d894b7c9', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbabc-5a32-73b5-aabd-3d739bbc7b93', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bebc4-d436-7c99-9c5d-1d6d7e0aeb46', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_standard_group (019b71cc-0154-771a-a2b6-1c69ada73003)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7aee-88c0-fcf257a293b6', 'Create a standard description for a rubric standard group. This tool generates detailed descriptions for rubric grid cells based on standard groups and standards.', '2025-12-31T00:25:53.748345+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7a51-8f7f-e90d14c5f53f', 'create_standard_group', '2025-12-31T00:25:53.748345+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bc3-aadf-8fb01ebadfdb', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_standard_group', 'Create a standard description for a rubric standard group. This tool generates detailed descriptions for rubric grid cells based on standard groups and standards.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '2025-12-31T00:25:53.748345+00:00', '2026-01-05T23:15:40.134472+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-091e-7990-bfc1-b8d3af60d137', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-091e-718e-ac0e-bd9b33b4e4fd', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-091e-7895-9f2e-46eea761d7e2', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-096a-7fb2-828d-8ecd49404ace', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-096b-7104-81f2-bef158001bef', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbf87-096b-71a3-9900-f15cd40781ae', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbabc-5a2f-7aee-88c0-fcf257a293b6', '2025-12-31T00:25:53.748345+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbeb4-5115-7781-89d8-cbe428c51618', true, '2025-12-31T00:25:53.748345+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-31T00:25:53.748345+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bbabc-5a2f-7a51-8f7f-e90d14c5f53f', '2025-12-31T00:25:53.748345+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b71cc-0154-771a-a2b6-1c69ada73003', '019bebc4-d436-7bc3-aadf-8fb01ebadfdb', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_statement (019b6ba0-deff-7909-a5b6-2315ae440d83)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7be6-ad42-d5c803ce2f7b', 'Create the problem statement for this scenario. The statement should be 1-2 sentences and subtly demonstrate the student''s persona without stating it directly.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7b5b-90a6-af47a48c37e6', 'create_statement', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b81-9555-1d88249b6d78', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_statement', 'Create the problem statement for this scenario. The statement should be 1-2 sentences and subtly demonstrate the student''s persona without stating it directly.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbf87-091e-7971-b066-945bf89e4bbf', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbf87-0966-74cb-9170-23849b47d719', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbabc-5a2f-7be6-ad42-d5c803ce2f7b', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbeb4-5112-7b3a-9110-1ad839c946b2', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bbabc-5a2f-7b5b-90a6-af47a48c37e6', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-deff-7909-a5b6-2315ae440d83', '019bebc4-d436-7b81-9555-1d88249b6d78', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_strength (019c16d8-a127-71ab-833e-f4d9273033a8)
INSERT INTO public.bindings_resource (id, entry, active, generated, mcp, created_at) VALUES ('019c164d-313e-7c23-8153-c16547f18d3a', 'strengths', true, false, false, '2026-01-31T23:04:43.581941+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a127-7455-abb2-3d1a6d0172df', 'Create a strength entry for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7c4d-a2a0-99de03bf9bbd', 'create_strength', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bac-88c6-8d40538bcb49', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_strength', 'Create strength feedback for a specific message. Highlight what was strong about this message in the conversation. You can optionally highlight specific sections.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c16d8-a124-7002-98bc-8d85766d98a3', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c16d8-a124-7022-8725-7350d3322d28', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c16d8-a124-7042-9411-d301e1f9154a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c16d8-a124-7062-a2b0-54377f200e63', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c24ff-49ed-7ba1-8a91-f2ff8c2f8587', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c24ff-49ed-7d86-9949-3e3f1a78f4c7', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c24ff-49ed-7f0c-83a7-592260b57fea', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c24ff-49ee-7192-9874-60e554e5eb07', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c164d-313e-7c23-8153-c16547f18d3a', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019c16d8-a127-7455-abb2-3d1a6d0172df', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019bbabc-5a2f-7c4d-a2a0-99de03bf9bbd', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a127-71ab-833e-f4d9273033a8', '019bebc4-d436-7bac-88c6-8d40538bcb49', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_temperature_levels (019bb58e-0adc-7b62-8d56-5fa73f84383c)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7f0a-88fa-787a3fdb5ccc', 'Create a new temperature level resource', '2026-01-13T04:12:23.644533+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7e6f-88a7-b240fa333952', 'create_temperature_levels', '2026-01-13T04:12:23.644533+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccb-b52a-fa65793c95ce', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_temperature_levels', 'Create a new temperature level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '2026-01-13T04:12:23.644533+00:00', '2026-01-13T04:12:23.644533+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-091f-748d-877c-acad536b0f97', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-091f-74b7-9dd4-18e70a7d5b26', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-091f-74db-a000-a7413e140770', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-0968-7bd1-b208-e127713943b2', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-0968-7c7b-bfdc-5bc38a8a2055', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-0968-7d1b-9e34-9ffd5a4b1700', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbabc-5a32-7f0a-88fa-787a3fdb5ccc', '2026-01-13T04:12:23.644533+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbeb4-5115-7a1a-928e-4701bb4a634d', true, '2026-01-13T04:12:23.644533+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T04:12:23.644533+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bbabc-5a32-7e6f-88a7-b240fa333952', '2026-01-13T04:12:23.644533+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb58e-0adc-7b62-8d56-5fa73f84383c', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_template (019b484d-9836-7bda-bf51-5911c1efcc98)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7e37-8d17-ece4f210ea57', 'Create a dynamic document using a template. The template schema defines the required fields and their types. This tool accepts template-specific arguments based on the template schema.', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7d9c-b5a0-cba5d956119b', 'create_template', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-78e3-ae05-f12509f43557', '2026-01-17T17:57:40.542955+00:00', false, false, true, 'create_template', 'Create a dynamic document using a template. The template schema defines the required fields and their types. This tool accepts template-specific arguments based on the template schema.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '2025-12-22T23:03:23.445951+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bbabc-5a2f-7e37-8d17-ece4f210ea57', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bbeb4-5115-7e13-bf7f-0b1ef8e58e7f', true, '2025-12-22T23:03:23.445951+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bbabc-5a2f-7d9c-b5a0-cba5d956119b', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b484d-9836-7bda-bf51-5911c1efcc98', '019bebc4-d436-78e3-ae05-f12509f43557', true, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_template_array_items (019b9f61-8049-7733-a972-16da449fe06a)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7bee-9c41-8aecab336c3b', 'Create a new template_array_items resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7b5a-a8d3-b8bf93545a48', 'create_template_array_items', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-091e-7b9f-a4e5-e1663a397139', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-091e-7cb7-91f8-df30e243b6e4', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-091e-7ce3-8ef6-53da7f97de14', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-091e-7c5d-a34a-879167cadd9f', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-0966-7df6-bc74-45c69b1d866f', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-0966-7ecc-bc09-b15e5976cffd', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-096d-7649-83cf-6ad69a7eeabb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbf87-096a-726f-808b-b9bf633dd02d', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbabc-5a31-7bee-9c41-8aecab336c3b', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7733-a972-16da449fe06a', '019bbabc-5a31-7b5a-a8d3-b8bf93545a48', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_template_values (019b9f61-8049-7a63-8fb0-5385e7e0b93e)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7cf5-995b-d0cd72b8d3ae', 'Create a new template_values resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7c5e-ba74-da0851c9bc0b', 'create_template_values', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-091e-7cb7-91f8-df30e243b6e4', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-091e-7b9f-a4e5-e1663a397139', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-091e-7d41-a2c1-af4317da1242', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-091e-7d20-b806-ad49a7e4a07c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-091e-7faa-83db-298fe04372f0', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-0966-7df6-bc74-45c69b1d866f', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-0966-7ecc-bc09-b15e5976cffd', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-0966-7f75-8aa9-47f879ba992b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-0967-7016-b82e-b96ab6a46ccb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbf87-0967-70b5-a18d-03d87854980c', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbabc-5a31-7cf5-995b-d0cd72b8d3ae', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7a63-8fb0-5385e7e0b93e', '019bbabc-5a31-7c5e-ba74-da0851c9bc0b', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_text (019ba36f-3984-7616-9358-67765fc492e4)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7574-a90f-53d805c4f2d9', 'Create a text resource with content. The text will be linked to the message.', '2026-01-09T15:45:34.081783+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-74bd-a1f0-946b57dccf83', 'create_text', '2026-01-09T15:45:34.081783+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '2026-01-09T15:45:34.081783+00:00', '2026-01-09T15:45:34.081783+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-091e-768f-9c96-37941363873a', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbabc-5a32-7574-a90f-53d805c4f2d9', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba36f-3984-7616-9358-67765fc492e4', '019bbabc-5a32-74bd-a1f0-946b57dccf83', '2026-01-09T15:45:34.081783+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_thresholds (019b9f61-8049-7e34-a086-cab534909572)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7e32-80b0-dc311dc309e8', 'Create a new thresholds resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7d80-bca1-35b72f0a69a1', 'create_thresholds', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c75-ad20-e10da932e60b', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_thresholds', 'Create a new thresholds resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bbabc-5a31-7e32-80b0-dc311dc309e8', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bbeb4-5116-74af-ad84-68ec66b96bcd', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bbabc-5a31-7d80-bca1-35b72f0a69a1', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8049-7e34-a086-cab534909572', '019bebc4-d436-7c75-ad20-e10da932e60b', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_times (019b9f61-804a-7035-8e24-ae6bd4c7ddb8)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7039-b3a9-d51296dd346f', 'Create a new times resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7fa6-bdeb-f9909b1cd4c2', 'create_times', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_times', 'Create a new times resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-091e-7fe7-be5c-f809786ca7ff', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-096a-7997-80ef-78cc7a63cb2b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbabc-5a32-7039-b3a9-d51296dd346f', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbabc-5a31-7fa6-bdeb-f9909b1cd4c2', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_tools (019bb774-4bc0-744a-baee-7dc728df344f)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-7118-ab5b-f7e8236cb93c', 'Create a new tools resource entry', '2026-01-13T13:03:30.752087+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8409-7360-8d06-53f00fb49ba4', 'Create a new tools resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-707c-a1b8-8f96094da038', 'create_tools', '2026-01-13T13:03:30.752087+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '2026-01-13T13:03:30.752087+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-091f-7797-98f8-1c70a7deb847', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-091f-7642-aa72-3507ef41149c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-096b-756d-ba42-ea14c51071a1', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbf87-0966-7aee-96c7-e5f169218818', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbabc-5a33-7118-ab5b-f7e8236cb93c', '2026-01-13T13:03:30.752087+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbdce-8409-7360-8d06-53f00fb49ba4', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T13:03:30.752087+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb774-4bc0-744a-baee-7dc728df344f', '019bbabc-5a33-707c-a1b8-8f96094da038', '2026-01-13T13:03:30.752087+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;

-- Tool: create_uploads (019bcc94-efdc-7baa-b653-bc57c229d70c)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcc94-efdc-7de3-8e38-67841033ab51', 'create_uploads', '2026-01-17T15:31:11.448636+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d20-945d-557447e427bd', '2026-01-17T17:57:40.542460+00:00', false, false, true, 'create_uploads', NULL, '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '2026-01-17T15:31:11.448636+00:00', '2026-01-17T15:31:11.448636+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bcc94-efdc-7de3-8e38-67841033ab51', '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bebc4-d436-7d20-945d-557447e427bd', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_values (019bbdce-8409-75e3-965d-7f2066a996bc)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8409-7707-8d13-048c1e10bd5c', 'Create a new values resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8409-761d-bb43-371c2822682a', 'create_values', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d12-8233-8e29598e4620', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_values', 'Create a new values resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019c2f13-4300-7c00-8000-000000000022', '2026-02-10T19:13:36.011239+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbdce-8409-7707-8d13-048c1e10bd5c', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbeb4-5117-72d1-b20c-991cc1922f25', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bbdce-8409-761d-bb43-371c2822682a', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8409-75e3-965d-7f2066a996bc', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_video (019b6ba0-df00-7d50-a92c-fffc24d64012)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7f2f-b1bc-ccb95b102a57', 'Create a video for this scenario. The video should visually represent the scenario described in the problem statement. Include details about the setting, characters, and key actions.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7e9c-a071-9e35169d4cc8', 'create_video', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b96-b622-c512f3a418da', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_video', 'Create a video for this scenario. The video should visually represent the scenario described in the problem statement. Include details about the setting, characters, and key actions.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-79c6-9b3e-d5b2865e3956', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-096c-7c49-8340-67b41f71b130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbabc-5a2f-7f2f-b1bc-ccb95b102a57', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbeb4-5117-741b-aa3c-9c953d7554f9', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbabc-5a2f-7e9c-a071-9e35169d4cc8', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bebc4-d436-7b96-b622-c512f3a418da', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: create_voices (019bb58e-0ade-7a67-ab34-102bdfba34f3)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-7016-9ebf-70bef136f762', 'Create a new voice resource', '2026-01-13T04:12:23.646486+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7f7b-83c2-dc9fb54eb87f', 'create_voices', '2026-01-13T04:12:23.646486+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_voices', 'Create a new voice resource', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '2026-01-13T04:12:23.646486+00:00', '2026-01-13T04:12:23.646486+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-7522-aff7-504c504c64c0', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-7506-a258-7c1e4bf24a41', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-096c-7f84-9de3-3633a716c6be', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-096d-702e-a3af-4518928bca79', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbabc-5a33-7016-9ebf-70bef136f762', '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbeb4-5117-755b-bd86-1217918c1a46', true, '2026-01-13T04:12:23.646486+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbabc-5a32-7f7b-83c2-dc9fb54eb87f', '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: end_conversation (019b484d-9837-760c-aa73-2421c6d107c0)
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7f35-a956-ba65b1639fb4', 'End the conversation. This tool signals that the conversation should be terminated.', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7e9e-8e1d-07839a547584', 'end_conversation', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b79-9a9b-f4ca94396178', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'end_conversation', 'End the conversation. This tool signals that the conversation should be terminated.', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '2025-12-22T23:03:23.445951+00:00', '2026-01-05T23:48:58.177470+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbf87-091e-76bb-aea5-9b1811fde09d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbf87-0969-7918-baff-8a6aea670506', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbabc-5a31-7f35-a956-ba65b1639fb4', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbabc-5a31-7e9e-8e1d-07839a547584', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bebc4-d436-7b79-9a9b-f4ca94396178', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_colors (019c06a8-2afc-7051-8212-4be68125ebd4)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af7-72c7-bed1-ec07e4bea469', 'use_colors', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-765d-abe4-dc47e392ad30', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_colors', 'Use an existing color resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2afc-7e58-a1d2-3724e2b70dd3', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '1d4b9314-bd8e-43fa-9f91-3cab63d2a6fe', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2af7-72c7-bed1-ec07e4bea469', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_departments (019c06a8-2afc-780e-954b-d9fd7f86f3c3)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7bfb-be4c-a3a0772e15ab', 'use_departments', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_departments', 'Use an existing department resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', '019c06a8-2afd-74bb-9398-ecf0bd964ade', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', 'a9e673dc-514e-4f3a-816c-41dc9350dbde', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', '019c06a8-2af8-7bfb-be4c-a3a0772e15ab', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-780e-954b-d9fd7f86f3c3', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_descriptions (019c06a8-2afa-7fd6-a8e5-f3f1b1aef023)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7cf3-80c2-78a27a837e00', 'use_descriptions', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2afd-74e6-86e4-1a0e5915a04c', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', 'dd1476d4-c3ef-48aa-9651-af7096929e22', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2af8-7cf3-80c2-78a27a837e00', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_documents (019c0a2d-fc39-718f-a4ad-c92f335718e8)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-7376-ac5d-0766d75f240a', 'use_documents', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_documents', 'Use an existing document resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc3b-7713-bd61-06feccddfcc8', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', 'fe4a69ea-eb46-41db-a4c2-1b0d3fc23490', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc39-7376-ac5d-0766d75f240a', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_examples (019c06a8-2afc-78f8-9d56-e65951e652c4)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7da2-80e7-86545543e250', 'use_examples', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-747f-a440-a2a60dd205e1', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_examples', 'Use an existing example resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2afd-7507-b94b-e23a4f7629cb', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', 'dda071e7-f216-436c-90ce-2ab8023e0322', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2af8-7da2-80e7-86545543e250', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2af5-747f-a440-a2a60dd205e1', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_flags (019c06a8-2afc-73f9-9e95-476669b9bbe0)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7dd5-ab5a-e056fac9daed', 'use_flags', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', '019c06a8-2afd-7525-a220-6e48dc0863e2', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', 'fabd979f-9ece-49ed-b1ab-93510b28085a', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', '019c06a8-2af8-7dd5-ab5a-e056fac9daed', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-73f9-9e95-476669b9bbe0', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_icons (019c06a8-2afc-7628-a34c-ae7690793a97)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7e10-9f3b-fa61e1018dc8', 'use_icons', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-7b5d-9491-b53823a821c7', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_icons', 'Use an existing icon resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2afd-7549-ac35-bc1e31b6c6d4', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', 'ee773399-c6c9-480c-9513-3ab2a93a90cd', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2af8-7e10-9f3b-fa61e1018dc8', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2af5-7b5d-9491-b53823a821c7', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_images (019c0a2d-fc3a-77a0-b233-29833ae9c1e1)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7816-8027-078125a36824', 'use_images', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-770a-b18d-af61cdf0f908', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_images', 'Use an existing image resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '019c0a2d-fc3b-7e9a-b0a1-485413199ea7', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '513fb867-9ca5-4f33-a4dc-c071f1090d4e', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '019c0a2d-fc3a-7816-8027-078125a36824', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-77a0-b233-29833ae9c1e1', '019c0a2d-fc36-770a-b18d-af61cdf0f908', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_instructions (019c06a8-2afc-7229-9772-4bd487410b5f)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7e4a-a6d1-f0f8494c3695', 'use_instructions', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_instructions', 'Use an existing instruction resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2afd-7572-a3ef-6b0e480ee806', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '14005258-e2ef-4958-bc6f-50d8690a6fe8', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2af8-7e4a-a6d1-f0f8494c3695', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_names (019c06a8-2afb-7e49-a2e9-9559d4659b19)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7e81-aa75-8c775f2e2513', 'use_names', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '019c06a8-2afd-7590-89aa-81ae6b3daaef', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '2b843f8b-d4f6-480c-a6a7-e9551d62ce68', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '019c06a8-2af8-7e81-aa75-8c775f2e2513', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afb-7e49-a2e9-9559d4659b19', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_objectives (019c0a2d-fc3a-7f3c-b722-c1d9f679bb89)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7f6c-bfeb-e4d8fe48b7f7', 'use_objectives', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-785a-9b6d-02eca12bb6e6', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_objectives', 'Use an existing objective resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', 'fd340494-667f-46da-8437-d1062b446449', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc3a-7f6c-bfeb-e4d8fe48b7f7', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc36-785a-9b6d-02eca12bb6e6', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_options (019c0a2d-fc3b-7180-8086-8ba217a12457)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-71a4-8278-ce579cbdad08', 'use_options', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7997-bdca-92935994cb93', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_options', 'Use an existing option resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', '019bbf87-091e-784e-8a7c-562ef0c4725d', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', 'd33ca9ba-69d3-49ce-884b-05995e1b95e5', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', '019c0a2d-fc3b-71a4-8278-ce579cbdad08', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3b-7180-8086-8ba217a12457', '019c0a2d-fc36-7997-bdca-92935994cb93', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_parameter_fields (019c06a8-2afc-7722-b6b9-cbbbc05a4fcd)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7eee-b873-ab6548a7615e', 'use_parameter_fields', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7609-9bc5-2782eb639be2', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameter_fields', 'Use an existing parameter field resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2afd-75d2-b632-0b14d929ce51', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '80914706-baaa-47a1-bf0d-b9d169964343', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2af8-7eee-b873-ab6548a7615e', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_parameters (019c06a8-2afb-7b0e-bb33-b3d4d68b638d)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7eb6-8207-f2ba700b05b9', 'use_parameters', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7439-b8fb-2a083dd49848', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameters', 'Use an existing parameter resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2afd-75ae-9a19-792e5677514b', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', 'cb9be910-a159-4695-9ae1-23e394391ce3', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2af8-7eb6-8207-f2ba700b05b9', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_personas (019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7ca0-85b7-2806158ae88f', 'use_personas', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-756e-b50e-a5987eb4f0d5', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_personas', 'Use an existing persona resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '86ad0489-0a8c-4e2f-b8a0-c2db397a23de', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc3a-7ca0-85b7-2806158ae88f', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc36-756e-b50e-a5987eb4f0d5', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_problem_statements (019c0a2d-fc3a-73ee-8aaf-807ec1e2feec)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7491-8919-790cc6e686a7', 'use_problem_statements', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7c0c-80c1-098a75897197', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_problem_statements', 'Use an existing problem statement resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '019c0a2d-fc3b-7f11-89b0-3ed69b5c6760', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '78849cf4-d4a2-4ada-85b0-64f5522f1fe3', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '019c0a2d-fc3a-7491-8919-790cc6e686a7', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-73ee-8aaf-807ec1e2feec', '019c0a2d-fc36-7c0c-80c1-098a75897197', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_questions (019c0a2d-fc39-7e15-8242-834b5133a8bb)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-7e8b-86f1-81e24a46cdcc', 'use_questions', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7ace-adde-c1e47bc14a89', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_questions', 'Use an existing question resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019bbf87-091e-786e-bbff-3e50b51a7cd1', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '0e366f8e-b831-4ecf-bc12-e29bdd9375e3', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019c0a2d-fc39-7e8b-86f1-81e24a46cdcc', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019c0a2d-fc36-7ace-adde-c1e47bc14a89', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_scenario_flags (019c0cd8-ad76-7cdf-be1b-991a987e2cd3)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad76-7d65-a139-219b90f7d111', 'use_scenario_flags', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0cd8-ad73-7621-b92d-91764faa013e', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_flags', 'Use an existing scenario flag configuration instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad78-744b-9c53-a823ab2682be', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '44ab4560-1387-47dd-84f6-79dce5859a72', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad76-7d65-a139-219b90f7d111', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad73-7621-b92d-91764faa013e', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_scenario_positions (019c0cd8-ad76-7f5f-9bbb-3f9c025e1625)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-71f6-93d6-1d92a72c4383', 'use_scenario_positions', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0cd8-ad73-781f-a3aa-1f1049dd213c', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_positions', 'Use an existing scenario position configuration instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad78-7a5d-a14b-81019cf711ba', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '5dae5401-6bec-40ff-9cdc-8bfdd02576be', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad77-71f6-93d6-1d92a72c4383', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad73-781f-a3aa-1f1049dd213c', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_scenario_rubrics (019c0cd8-ad77-73c2-b9c0-2795004879ee)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-741f-8f04-35bc6f1bc17e', 'use_scenario_rubrics', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0cd8-ad73-7a10-805f-28e22f591d29', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_rubrics', 'Use an existing scenario rubric assignment instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', '019c0cd8-ad78-7a8f-a152-23252169ffea', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', 'efe913ef-fddd-4906-8a50-f46b5658b81e', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', '019c0cd8-ad77-741f-8f04-35bc6f1bc17e', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad77-73c2-b9c0-2795004879ee', '019c0cd8-ad73-7a10-805f-28e22f591d29', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_scenario_time_limits (019c0cd8-ad77-78c3-bb8b-4c4430166f56)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-7921-a5f1-aa80a6332bc0', 'use_scenario_time_limits', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0cd8-ad73-7b6f-b393-86ceeddd1beb', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_time_limits', 'Use an existing scenario time limit configuration instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad78-7ab6-8d92-f0cdef967fd8', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '550fdadd-cdfb-4f81-8b63-fea58d068c1b', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad77-7921-a5f1-aa80a6332bc0', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad73-7b6f-b393-86ceeddd1beb', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_scenarios (019c0cd8-ad75-7d9c-a481-f29ca2da6fd0)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad75-7f4e-acf1-b8d5ce99fd48', 'use_scenarios', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0cd8-ad73-72dd-8a41-ea5b247384db', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenarios', 'Use an existing scenario resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '1974e228-f025-490a-a974-6d2bf9b8ef44', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019c0cd8-ad75-7f4e-acf1-b8d5ce99fd48', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019c0cd8-ad73-72dd-8a41-ea5b247384db', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_templates (019c0a2d-fc3a-7a19-8606-6c99644852e5)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7a72-96c0-0c5b8e26139b', 'use_templates', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_templates', 'Use an existing template resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019bbf87-091e-7cb7-91f8-df30e243b6e4', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '4ab492c3-52b5-4cd3-940c-06611d307d23', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019c0a2d-fc3a-7a72-96c0-0c5b8e26139b', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;

-- Tool: use_videos (019c0a2d-fc3b-7066-913e-5aaf3fa11bd9)
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-708d-9620-29f6965d5a22', 'use_videos', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c0a2d-fc36-7e78-9083-05afa0c8e4d8', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_videos', 'Use an existing video resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', '019c0a2d-fc3b-7f40-aa9e-df41c3b68717', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', 'e4789a8b-5de9-4f7b-99cf-cc1c9ec96d32', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', '019c0a2d-fc3b-708d-9620-29f6965d5a22', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3b-7066-913e-5aaf3fa11bd9', '019c0a2d-fc36-7e78-9083-05afa0c8e4d8', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
