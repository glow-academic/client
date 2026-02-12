-- Module: PHYS 172
-- Category: field
-- Description: PHYS 172 field
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e624-745f-85ac-d4c79657d7e1', 'Physics', 'PHYS', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77a6-9093-53f6102b5b0b', 'Modern Mechanics', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-10-31T16:50:58.307484+00:00', true, false, false, '019bb25e-e5f8-7ca7-a23c-03fe824b4e20', 'PHYS 172', 'Modern Mechanics', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79a0-8957-f9b7df6343b7', 'PHYS 172', '2025-10-31T16:50:58.307484+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-31T16:50:58.307484+00:00', '2025-10-31T16:50:58.307484+00:00', '019b3be4-3255-7e85-913c-474e76513957', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-31T16:50:58.307484+00:00', '019bb25e-e624-745f-85ac-d4c79657d7e1', '019b3be4-3255-7e85-913c-474e76513957', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019b995c-8e9e-77a6-9093-53f6102b5b0b', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019bb25e-e5f8-7ca7-a23c-03fe824b4e20', true, '2025-10-31T16:50:58.307484+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7e85-913c-474e76513957', '019b995c-8e9b-79a0-8957-f9b7df6343b7', '2025-10-31T16:50:58.307484+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
