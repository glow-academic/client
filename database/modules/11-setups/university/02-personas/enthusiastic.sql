-- Module: Enthusiastic
-- Category: persona
-- Description: Enthusiastic persona
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000012-0001-0000-0000-000000000004', 'Enthusiastic', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_ids, parameter_field_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000010-0001-0000-0000-000000000004', 'Enthusiastic', 'Eager and positive, ready to engage and improve.', '', '', '{019c3f8c-b97f-70eb-86fb-4f3fae4902f8}', 'Start upbeat and willing to engage. Use phrases like "Absolutely, let''s do this!" and "I really want to get better at this." Ask probing questions showing genuine interest. If the user is vague, gently press for more detail. Maintain positive energy throughout but don''t be naive — ask smart questions.', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000011-0001-0000-0000-000000000004', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_departments_junction
INSERT INTO public.persona_departments_junction (active, created_at, department_id, persona_id, generated, mcp) VALUES (true, '2026-02-19T09:59:35.509148+00:00', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', 'dd000011-0001-0000-0000-000000000004', false, false) ON CONFLICT (persona_id, department_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('dd000011-0001-0000-0000-000000000004', 'dd000012-0001-0000-0000-000000000004', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('dd000011-0001-0000-0000-000000000004', 'dd000010-0001-0000-0000-000000000004', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
