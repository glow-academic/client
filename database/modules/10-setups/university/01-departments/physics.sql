-- Module: Physics
-- Category: department
-- Description: Physics department
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-745f-85ac-d4c79657d7e1', 'Physics', 'PHYS', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eac-786f-83f3-c3198739560b', 'PHYS', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea9-7b00-b11c-34953c171432', 'Physics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-12-12T13:26:55.606271+00:00', '019b3be4-3247-7d75-b682-fd462e133f6c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-3247-7d75-b682-fd462e133f6c', '019bb25e-e624-745f-85ac-d4c79657d7e1', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d75-b682-fd462e133f6c', '019b995c-8eac-786f-83f3-c3198739560b', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d75-b682-fd462e133f6c', '019be334-bfc3-7c81-b7b6-de11e555da9d', false, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d75-b682-fd462e133f6c', '019b995c-8ea9-7b00-b11c-34953c171432', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
