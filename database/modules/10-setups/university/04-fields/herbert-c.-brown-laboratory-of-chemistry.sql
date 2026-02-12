-- Module: Herbert C. Brown Laboratory of Chemistry
-- Category: field
-- Description: Herbert C. Brown Laboratory of Chemistry field
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-7450-8897-a72c55c26107', 'Purdue Chem', 'CHM', '{}', '{019bb25e-e615-7963-be87-7904de26729c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-775e-a657-5735185205a9', 'Departmental space.', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7d4a-8c27-a3231f31d512', 'Herbert C. Brown Laboratory of Chemistry', 'Departmental space.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a57-b7dd-0af8c925542f', 'Herbert C. Brown Laboratory of Chemistry', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e08-9a41-393e311c8598', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-7450-8897-a72c55c26107', '019b3be4-3255-7e08-9a41-393e311c8598', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019b995c-8e9e-775e-a657-5735185205a9', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019bb25e-e5f8-7d4a-8c27-a3231f31d512', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e08-9a41-393e311c8598', '019b995c-8e9b-7a57-b7dd-0af8c925542f', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
