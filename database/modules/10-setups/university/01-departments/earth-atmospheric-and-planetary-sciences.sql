-- Module: Earth, Atmospheric, and Planetary Sciences
-- Category: department
-- Description: Earth, Atmospheric, and Planetary Sciences department
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7459-b42d-b7ee5595e1c7', 'Earth, Atmospheric, and Planetary Sciences', 'EAPS', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eac-7862-b0f3-741f57b46be3', 'EAPS', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea9-7af7-b1de-d2be3e608f87', 'Earth, Atmospheric, and Planetary Sciences', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-12-12T13:26:55.606271+00:00', '019b3be4-3247-7d6c-9453-53b0a7155c04', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-3247-7d6c-9453-53b0a7155c04', '019bb25e-e624-7459-b42d-b7ee5595e1c7', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d6c-9453-53b0a7155c04', '019b995c-8eac-7862-b0f3-741f57b46be3', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d6c-9453-53b0a7155c04', '019be334-bfc3-7c81-b7b6-de11e555da9d', false, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7d6c-9453-53b0a7155c04', '019b995c-8ea9-7af7-b1de-d2be3e608f87', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
