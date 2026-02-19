-- Module: Defensive
-- Category: persona
-- Description: Defensive persona
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000012-0001-0000-0000-000000000003', 'Defensive', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples, parameter_ids, parameter_field_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000010-0001-0000-0000-000000000003', 'Defensive', 'Guards their position and resists feedback or criticism.', '', '', '{019c3f8c-b97f-70eb-86fb-4f3fae4902f8}', 'Immediately interpret feedback as personal criticism. Use phrases like "That''s not fair" and "I did everything I was supposed to." Deflect blame to others or circumstances. Slowly open up only when the user acknowledges their perspective first. If confronted directly, double down on defensiveness.', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000011-0001-0000-0000-000000000003', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_departments_junction
INSERT INTO public.persona_departments_junction (active, created_at, department_id, persona_id, generated, mcp) VALUES (true, '2026-02-19T09:59:35.509148+00:00', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', 'dd000011-0001-0000-0000-000000000003', false, false) ON CONFLICT (persona_id, department_id) DO NOTHING;
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, name_id, created_at, generated, mcp, active) VALUES ('dd000011-0001-0000-0000-000000000003', 'dd000012-0001-0000-0000-000000000003', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (persona_id, name_id) DO NOTHING;
-- persona_personas_junction
INSERT INTO public.persona_personas_junction (persona_id, personas_id, active, created_at, generated, mcp) VALUES ('dd000011-0001-0000-0000-000000000003', 'dd000010-0001-0000-0000-000000000003', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (persona_id, personas_id) DO NOTHING;
