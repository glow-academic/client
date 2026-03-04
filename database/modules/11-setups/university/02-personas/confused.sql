-- Module: Confused
-- Category: persona
-- Description: Confused persona
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9a-77a8-a9dd-5f5f56922e12', 'Seeks to understand by asking questions and exploring ideas', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'I don''t understand', '019b3be4-3253-7e83-ac1f-d7a31815004f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'Can you explain that again?', '019b3be4-3253-7e89-ae1b-1b91df6b9789', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.examples_resource (created_at, example, id, generated, mcp) VALUES ('2025-12-10T15:04:04.378076+00:00', 'What does that mean?', '019b3be4-3253-7e8d-970d-729fc83f82c0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019b9bab-8a06-77a0-9952-4882df960ad7', 'Your defining feature: a fundamental misunderstanding of the concept. You must stick to your wrong interpretation until the user corrects you. Mildly frustrated, but not angry. Say things like: "I thought it worked like ___? But maybe I''m wrong?" "Does it… have to do with ___? I''m honestly not sure." Become more confused when the user is vague. Only progress when the user explicitly states course terms tying to your last message.', true, '2025-08-12T12:52:09.801431+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-785b-9fa2-bd32bc0588c4', 'Confused', '2025-08-12T12:52:09.801431+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('282ab22f-8bbf-44ba-be3d-43023d502aec', '019bb25e-e5f8-7ddd-907f-b62487ee2e2f', true, false, '2025-12-12T13:26:55.660542+00:00', '2026-01-28T14:15:32.407116+00:00', '019bb25e-e621-702e-a7ba-81fd751a9c61') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_ids, parameter_field_ids) VALUES ('2025-08-12T12:52:09.801431+00:00', true, false, false, '019bb25e-e60c-7345-ac6d-50d29df6deb3', 'Confused', 'Seeks to understand by asking questions and exploring ideas', 'HelpCircle', '#eab308', '{}', 'Your defining feature: a fundamental misunderstanding of the concept. You must stick to your wrong interpretation until the user corrects you. Mildly frustrated, but not angry. Say things like: "I thought it worked like ___? But maybe I''m wrong?" "Does it… have to do with ___? I''m honestly not sure." Become more confused when the user is vague. Only progress when the user explicitly states course terms tying to your last message.', '{"I don''t understand","Can you explain that again?","What does that mean?"}', '{019bb25e-e621-702e-a7ba-81fd751a9c61}', '{282ab22f-8bbf-44ba-be3d-43023d502aec}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.801431+00:00', '2025-12-02T13:15:01.975503+00:00', '019b3be4-36e2-770b-af4e-96c8cfa80851', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_colors_junction
INSERT INTO public.persona_colors_junction (persona_id, color_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019b995b-52f6-7759-98be-647af770b92b', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, color_id) DO NOTHING;
-- persona_descriptions_junction
INSERT INTO public.persona_descriptions_junction (persona_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019b995c-8e9a-77a8-a9dd-5f5f56922e12', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, description_id) DO NOTHING;
-- persona_examples_junction
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (0, '2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e83-ac1f-d7a31815004f', '019b3be4-36e2-770b-af4e-96c8cfa80851', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (1, '2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e89-ae1b-1b91df6b9789', '019b3be4-36e2-770b-af4e-96c8cfa80851', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
INSERT INTO public.persona_examples_junction (idx, created_at, example_id, persona_id, active, generated, mcp) VALUES (2, '2025-12-10T15:04:04.378076+00:00', '019b3be4-3253-7e8d-970d-729fc83f82c0', '019b3be4-36e2-770b-af4e-96c8cfa80851', true, false, false) ON CONFLICT (persona_id, example_id) DO NOTHING;
-- persona_flags_junction
INSERT INTO public.persona_flags_junction (persona_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019be334-bfc3-7998-9dcf-a00d3d137da5', true, '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, flag_id) DO NOTHING;
-- persona_icons_junction
INSERT INTO public.persona_icons_junction (persona_id, icon_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019b995b-52f7-7520-8f5c-41db263f89ba', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, icon_id) DO NOTHING;
-- persona_instructions_junction
INSERT INTO public.persona_instructions_junction (persona_id, instruction_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019b9bab-8a06-77a0-9952-4882df960ad7', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, instruction_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019b995c-8e99-785b-9fa2-bd32bc0588c4', '2025-08-12T12:52:09.801431+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_parameter_fields_junction
INSERT INTO public.persona_parameter_fields_junction (persona_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '282ab22f-8bbf-44ba-be3d-43023d502aec', true, false, false, '2025-12-12T13:26:55.660542+00:00') ON CONFLICT (persona_id, parameter_field_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('019b3be4-36e2-770b-af4e-96c8cfa80851', '019bb25e-e60c-7345-ac6d-50d29df6deb3', true, '2025-08-12T12:52:09.801431+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
