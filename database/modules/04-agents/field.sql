-- Module: Field
-- Category: agent
-- Description: Field system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-03T19:33:56.323152+00:00', true, false, false, '019c24ff-49e3-7512-8173-2ea2ac8c3670', 'Grade Agent', 'Agent responsible for providing detailed feedback on student performance in educational simulations', '{}', NULL, NULL, '{019bebc4-d436-7bac-88c6-8d40538bcb49,019bebc4-d436-7bb7-964b-e3ad705be38d,019bebc4-d436-7bbb-bd65-5f158fd12e4d,019c16d8-a124-7d9a-8547-20d809a13daa,019c16d8-a125-7364-8818-8035df41de53,019bebc4-d436-7ba4-963e-758c7971447d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c16d8-a12e-7c64-89a1-74ced40a25f5', '{019bcd1c-3357-7009-a18c-55604e211cac,019c16d8-a12e-7da6-ba14-f0c2cd75a4eb}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-728b-aa5b-4687e69e40e9', 'AI agent for generating and managing field resources including names, descriptions, flags, departments, and conditional parameters using GPT-5.1', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-701e-b254-b80e6423ffab', 'Field', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.069266+00:00', '2026-01-17T17:58:56.069266+00:00', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c24ff-49e3-7512-8173-2ea2ac8c3670', true, '2026-02-03T19:33:56.324006+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-728b-aa5b-4687e69e40e9', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-701e-b254-b80e6423ffab', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c3e-b71d-a48e787dafc1', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
