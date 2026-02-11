-- Module: Purdue Chem
-- Category: department
-- Description: Purdue Chem department
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7450-8897-a72c55c26107', 'Purdue Chem', 'CHM', '{}', '{019b3be4-3c61-7714-9370-0ca874d1aff4}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eac-7866-a3ee-5acdbcd39192', 'CHM', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea9-7b04-9e0e-078bf5859bd2', 'Purdue Chem', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-12-12T13:26:55.606271+00:00', '019b3be4-3247-7d5e-a958-5b9fb4e2725b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-3247-7d5e-a958-5b9fb4e2725b', '019bb25e-e624-7450-8897-a72c55c26107', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d5e-a958-5b9fb4e2725b', '019b995c-8eac-7866-a3ee-5acdbcd39192', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d5e-a958-5b9fb4e2725b', '019be334-bfc3-7c81-b7b6-de11e555da9d', false, '2026-02-08T23:18:33.076220+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d5e-a958-5b9fb4e2725b', '019b995c-8ea9-7b04-9e0e-078bf5859bd2', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
-- department_settings_junction
INSERT INTO public.department_settings_junction (active, created_at, department_id, settings_id, generated, mcp) VALUES (true, '2025-12-12T13:26:55.664826+00:00', '019b3be4-3247-7d5e-a958-5b9fb4e2725b', '019b3be4-3c61-7714-9370-0ca874d1aff4', false, false) ON CONFLICT (department_id, settings_id) DO NOTHING;
