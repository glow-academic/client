-- Module: Couple of days
-- Category: field
-- Description: Couple of days field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7760-8c10-32ed822168ed', 'Deadline is in a couple of days. Some urgency, but stress is low.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d9e-ad3f-a6eb897d8839', 'Couple of days', 'Deadline is in a couple of days. Some urgency, but stress is low.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a3d-b6c6-a081909c0a5c', 'Couple of days', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.877101-05', '2025-08-12 07:52:09.877101-05', '019b3be4-3255-7b0d-a2dd-3bfa70e86acf', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019b995c-8e9e-7760-8c10-32ed822168ed', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019bb25e-e5f8-7d9e-ad3f-a6eb897d8839', '2025-08-12 07:52:09.877101-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019b995c-8e9b-7a3d-b6c6-a081909c0a5c', '2025-08-12 07:52:09.877101-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c54-a911-f90c2cd8bf71', '019b3be4-3255-7b0d-a2dd-3bfa70e86acf', '019bb25e-e5f8-7d9e-ad3f-a6eb897d8839', true, '2025-08-12 07:52:09.877101-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
