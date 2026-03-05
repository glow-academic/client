-- Module: Few hours
-- Category: field
-- Description: Few hours field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-772c-b672-55746dc53d17', 'Deadline is in a few hours. Immediate help is required; this is a high-stress situation.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7da6-bbe0-b96d4d72d25f', 'Few hours', 'Deadline is in a few hours. Immediate help is required; this is a high-stress situation.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a59-a437-be6020817dab', 'Few hours', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.877101-05', '2025-08-12 07:52:09.877101-05', '019b3be4-3255-7afc-85a8-e40f75ff26c0', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019b995c-8e9e-772c-b672-55746dc53d17', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019bb25e-e5f8-7da6-bbe0-b96d4d72d25f', true, '2025-08-12 07:52:09.877101-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7afc-85a8-e40f75ff26c0', '019b995c-8e9b-7a59-a437-be6020817dab', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c54-a911-f90c2cd8bf71', '019b3be4-3255-7afc-85a8-e40f75ff26c0', '019bb25e-e5f8-7da6-bbe0-b96d4d72d25f', true, '2025-08-12 07:52:09.877101-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
