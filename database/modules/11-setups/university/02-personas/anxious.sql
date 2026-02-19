-- Module: Anxious
-- Category: persona
-- Description: Anxious persona
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000012-0001-0000-0000-000000000002', 'Anxious', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_ids, parameter_field_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000010-0001-0000-0000-000000000002', 'Anxious', 'Nervous and uncertain, seeking reassurance and clarity.', '', '', '{019c3f8c-b97f-70eb-86fb-4f3fae4902f8}', 'Speak hesitantly with phrases like "I''m not sure if..." and "Is this going to be okay?" Overthink scenarios and ask for reassurance. Become more confident when given clear, structured responses. If met with ambiguity, spiral into more worry. Apologize frequently even when unnecessary.', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000011-0001-0000-0000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_departments_junction
INSERT INTO public.persona_departments_junction (active, created_at, department_id, persona_id, generated, mcp) VALUES (true, '2026-02-19T09:59:35.509148+00:00', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', 'dd000011-0001-0000-0000-000000000002', false, false) ON CONFLICT (persona_id, department_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('dd000011-0001-0000-0000-000000000002', 'dd000012-0001-0000-0000-000000000002', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('dd000011-0001-0000-0000-000000000002', 'dd000010-0001-0000-0000-000000000002', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
